import { spawn } from "child_process";
import { writeFile, mkdir, unlink } from "fs/promises";
import { get as httpGet } from "http";
import { get as httpsGet } from "https";
import { createServer } from "net";
import type { DataAdapter } from "obsidian";
import { createPlantUmlSvgUrl } from "./plantuml-client";

export const DEFAULT_PLANTUML_SERVER_URL = "http://localhost:8080";
export const PLANTUML_SERVER_CONFIG_FILE = "plantuml-server.json";

const PLANTUML_JAR_DOWNLOAD_URL = "https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar";
const PLANTUML_DIR = ".plantuml";
const PLANTUML_JAR_FILE = "plantuml.jar";
const LOCAL_PLANTUML_JAR_PATH = ".plantuml/plantuml.jar";
const LOCAL_PLANTUML_SERVER_CONFIG_PATH = PLANTUML_SERVER_CONFIG_FILE;
const PLANTUML_READY_TIMEOUT_MS = 10_000;
const PLANTUML_READY_POLL_MS = 100;
const PLANTUML_READY_SOURCE = "@startuml\nAlice -> Bob: Ready\n@enduml";

interface PlantUmlServerConfig {
	url: string;
	port?: number;
	pid?: number;
	startedAt?: string;
}

interface StartPlantUmlServerOptions {
	javaDownloadCheck: boolean;
}

export async function loadPlantUmlServerUrl(adapter: DataAdapter, pluginDir?: string): Promise<string> {
	const config = await loadPlantUmlServerConfig(adapter, pluginDir);

	if (config) {
		return normalizeServerUrl(config.url);
	}

	return DEFAULT_PLANTUML_SERVER_URL;
}

export async function shutdownPlantUmlServer(adapter: DataAdapter, pluginDir?: string): Promise<boolean> {
	debugLog("shutdown: loading server config", { pluginDir });
	const config = await loadPlantUmlServerConfig(adapter, pluginDir);
	if (!config?.pid) {
		debugLog("shutdown: no server PID found");
		return false;
	}

	try {
		debugLog("shutdown: sending SIGTERM", { pid: config.pid });
		process.kill(config.pid, "SIGTERM");
	} catch (error) {
		if (!isProcessNotFoundError(error)) {
			debugLog("shutdown: failed to send SIGTERM", error);
			throw error;
		}
		debugLog("shutdown: process already gone", { pid: config.pid });
	}

	await removePlantUmlServerConfig(adapter, pluginDir);
	debugLog("shutdown: removed server config");

	return true;
}

export async function startPlantUmlServer(
	adapter: DataAdapter,
	pluginDir: string | undefined,
	options: StartPlantUmlServerOptions,
): Promise<string> {
	if (!pluginDir) {
		throw new Error("Cannot start PlantUML server without a plugin directory.");
	}

	debugLog("start: ensuring PlantUML jar", {
		pluginDir,
		javaDownloadCheck: options.javaDownloadCheck,
	});
	const jarPath = await ensurePlantUmlJar(adapter, pluginDir, options);
	debugLog("start: PlantUML jar ready", { jarPath });
	const port = await reserveEphemeralPort(createServer);
	const serverUrl = `http://localhost:${port}`;
	debugLog("start: reserved port", { port, serverUrl });
	const child = spawn("java", ["-jar", jarPath, `--http-server:${port}`], {
		stdio: ["ignore", "pipe", "pipe"],
	});
	debugLog("start: spawned Java process", { pid: child.pid });

	try {
		debugLog("start: waiting for server readiness", { serverUrl });
		await waitForPlantUmlServer(serverUrl);
	} catch (error) {
		debugLog("start: readiness failed; killing Java process", {
			pid: child.pid,
			error,
		});
		child.kill("SIGTERM");
		throw error;
	}
	debugLog("start: server is ready", { serverUrl });

	await writePlantUmlServerConfig(adapter, pluginDir, {
		url: serverUrl,
		port,
		pid: child.pid,
		startedAt: new Date().toISOString(),
	});
	debugLog("start: wrote server config");

	child.stdout.on("data", (chunk: Buffer) => {
		debugLog("java stdout", chunk.toString());
		process.stdout.write(chunk);
	});

	child.stderr.on("data", (chunk: Buffer) => {
		debugLog("java stderr", chunk.toString());
		process.stderr.write(chunk);
	});

	child.on("exit", () => {
		debugLog("java exit: removing server config", { pid: child.pid });
		void removePlantUmlServerConfig(adapter, pluginDir);
	});

	return serverUrl;
}

export async function serveLocalPlantUmlServer(): Promise<void> {
	const port = await reserveEphemeralPort(createServer);
	const serverUrl = `http://localhost:${port}`;
	const child = spawn("java", ["-jar", LOCAL_PLANTUML_JAR_PATH, `--http-server:${port}`], {
		stdio: ["ignore", "pipe", "pipe"],
	});

	try {
		await waitForPlantUmlServer(serverUrl);
	} catch (error) {
		child.kill("SIGTERM");
		throw error;
	}

	await writeFile(
		LOCAL_PLANTUML_SERVER_CONFIG_PATH,
		`${JSON.stringify({
			url: serverUrl,
			port,
			pid: child.pid,
			startedAt: new Date().toISOString(),
		}, null, "\t")}\n`,
	);

	process.stdout.write(`PlantUML server URL: ${serverUrl}\n`);

	child.stdout.on("data", (chunk: Buffer) => {
		process.stdout.write(chunk);
	});

	child.stderr.on("data", (chunk: Buffer) => {
		process.stderr.write(chunk);
	});

	child.on("exit", (code, signal) => {
		void unlink(LOCAL_PLANTUML_SERVER_CONFIG_PATH).catch((error: unknown) => {
			if (!isFileNotFoundError(error)) {
				throw error;
			}
		});

		if (signal) {
			process.kill(process.pid, signal);
			return;
		}

		process.exit(code ?? 0);
	});

	process.on("SIGINT", () => {
		child.kill("SIGINT");
	});

	process.on("SIGTERM", () => {
		child.kill("SIGTERM");
	});
}

export async function downloadLocalPlantUmlJar(): Promise<void> {
	const jarBytes = await downloadPlantUmlJar();

	await mkdir(PLANTUML_DIR, { recursive: true });
	await writeFile(LOCAL_PLANTUML_JAR_PATH, Buffer.from(jarBytes));
}

async function loadPlantUmlServerConfig(
	adapter: DataAdapter,
	pluginDir?: string,
): Promise<PlantUmlServerConfig | null> {
	if (!pluginDir) {
		return null;
	}

	try {
		const rawConfig = await adapter.read(`${pluginDir}/${PLANTUML_SERVER_CONFIG_FILE}`);
		const config: unknown = JSON.parse(rawConfig);

		if (isPlantUmlServerConfig(config)) {
			return config;
		}
	} catch {
		// Fall back to the conventional PlantUML pico web port if no runtime config exists.
	}

	return null;
}

async function removePlantUmlServerConfig(adapter: DataAdapter, pluginDir?: string): Promise<void> {
	if (!pluginDir) {
		return;
	}

	await adapter.remove(`${pluginDir}/${PLANTUML_SERVER_CONFIG_FILE}`).catch((error: unknown) => {
		if (!isFileNotFoundError(error)) {
			throw error;
		}
	});
}

async function ensurePlantUmlJar(
	adapter: DataAdapter,
	pluginDir: string,
	options: StartPlantUmlServerOptions,
): Promise<string> {
	const plantUmlDir = `${pluginDir}/${PLANTUML_DIR}`;
	const plantUmlJar = `${plantUmlDir}/${PLANTUML_JAR_FILE}`;

	debugLog("jar: checking directory", { plantUmlDir });
	if (!await adapter.exists(plantUmlDir)) {
		debugLog("jar: creating directory", { plantUmlDir });
		await adapter.mkdir(plantUmlDir);
	}

	debugLog("jar: checking jar", { plantUmlJar });
	if (!await adapter.exists(plantUmlJar)) {
		if (!options.javaDownloadCheck) {
			debugLog("jar: missing and download check disabled");
			throw new Error("PlantUML jar is missing and Java download check is disabled.");
		}

		debugLog("jar: downloading PlantUML jar");
		const jarBytes = await downloadPlantUmlJar();
		debugLog("jar: download complete", { bytes: jarBytes.byteLength });
		await adapter.writeBinary(plantUmlJar, jarBytes);
		debugLog("jar: wrote jar", { plantUmlJar });
	}

	return getAdapterFullPath(adapter, plantUmlJar);
}

async function downloadPlantUmlJar(): Promise<ArrayBuffer> {
	debugLog("download: start", { url: PLANTUML_JAR_DOWNLOAD_URL });
	return downloadUrl(PLANTUML_JAR_DOWNLOAD_URL);
}

async function writePlantUmlServerConfig(
	adapter: DataAdapter,
	pluginDir: string,
	config: PlantUmlServerConfig,
): Promise<void> {
	await adapter.write(
		`${pluginDir}/${PLANTUML_SERVER_CONFIG_FILE}`,
		`${JSON.stringify(config, null, "\t")}\n`,
	);
}

function getAdapterFullPath(adapter: DataAdapter, normalizedPath: string): string {
	const fileSystemAdapter = adapter as DataAdapter & {
		getFullPath?: (path: string) => string;
	};

	if (typeof fileSystemAdapter.getFullPath === "function") {
		return fileSystemAdapter.getFullPath(normalizedPath);
	}

	return normalizedPath;
}

async function downloadUrl(url: string, redirectsRemaining = 5): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		debugLog("download: request", { url, redirectsRemaining });
		const request = httpsGet(url, (response) => {
			const statusCode = response.statusCode ?? 0;
			debugLog("download: response", {
				url,
				statusCode,
				location: response.headers.location,
			});

			if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
				response.resume();

				if (redirectsRemaining <= 0) {
					reject(new Error("Too many redirects while downloading PlantUML jar."));
					return;
				}

				void downloadUrl(response.headers.location, redirectsRemaining - 1).then(resolve, reject);
				return;
			}

			if (statusCode < 200 || statusCode >= 300) {
				response.resume();
				reject(new Error(`Failed to download PlantUML jar: HTTP ${statusCode}`));
				return;
			}

			const chunks: Buffer[] = [];

			response.on("data", (chunk: Buffer) => {
				chunks.push(chunk);
			});

			response.on("end", () => {
				const buffer = Buffer.concat(chunks);
				debugLog("download: response complete", {
					url,
					bytes: buffer.byteLength,
				});
				resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
			});
		});

		request.on("error", (error) => {
			debugLog("download: request error", error);
			reject(error);
		});
	});
}

async function waitForPlantUmlServer(serverUrl: string): Promise<void> {
	const deadline = Date.now() + PLANTUML_READY_TIMEOUT_MS;
	const healthUrl = createPlantUmlSvgUrl(serverUrl, PLANTUML_READY_SOURCE);
	let attempts = 0;
	debugLog("ready: polling", { healthUrl });

	while (Date.now() < deadline) {
		attempts += 1;
		if (await isPlantUmlServerReady(healthUrl)) {
			debugLog("ready: success", { attempts });
			return;
		}

		await sleep(PLANTUML_READY_POLL_MS);
	}

	debugLog("ready: timeout", { attempts });
	throw new Error("Timed out waiting for PlantUML server to become ready.");
}

async function isPlantUmlServerReady(url: string): Promise<boolean> {
	return new Promise((resolve) => {
		const request = httpGet(url, (response) => {
			response.resume();
			debugLog("ready: health response", { statusCode: response.statusCode });
			resolve(response.statusCode === 200);
		});

		request.on("error", () => {
			debugLog("ready: health request error");
			resolve(false);
		});
		request.setTimeout(PLANTUML_READY_POLL_MS, () => {
			debugLog("ready: health request timeout");
			request.destroy();
			resolve(false);
		});
	});
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function normalizeServerUrl(url: string): string {
	return url.replace(/\/$/, "");
}

function isPlantUmlServerConfig(value: unknown): value is PlantUmlServerConfig {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	return typeof candidate.url === "string"
		&& candidate.url.length > 0
		&& (candidate.pid === undefined || typeof candidate.pid === "number");
}

function isFileNotFoundError(error: unknown): boolean {
	return typeof error === "object"
		&& error !== null
		&& "code" in error
		&& error.code === "ENOENT";
}

function isProcessNotFoundError(error: unknown): boolean {
	return typeof error === "object"
		&& error !== null
		&& "code" in error
		&& error.code === "ESRCH";
}

async function reserveEphemeralPort(
	createServerFn: typeof createServer,
): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServerFn();

		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (typeof address !== "object" || address === null) {
				server.close(() => reject(new Error("Failed to reserve an ephemeral port.")));
				return;
			}

			server.close(() => resolve(address.port));
		});
	});
}

if (process.argv.some((argument) => argument.endsWith("plantuml-server.ts"))) {
	if (process.argv.includes("--download")) {
		void downloadLocalPlantUmlJar();
	} else {
		void serveLocalPlantUmlServer();
	}
}

function debugLog(message: string, data?: unknown): void {
	// eslint-disable-next-line no-console
	console.log(`[kims-plantuml] ${message}`, data ?? "");
}
