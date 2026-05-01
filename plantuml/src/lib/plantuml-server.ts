import { spawn } from "child_process";
import { access, mkdir, writeFile } from "fs/promises";
import { get as httpGet } from "http";
import { get as httpsGet } from "https";
import { createServer } from "net";
import type { DataAdapter } from "obsidian";
import {
	PLANTUML_DIR,
	PLANTUML_JAR_PATH,
	PLANTUML_READY_SOURCE,
	PLANTUML_SERVER_CONFIG_PATH,
} from "../const";
import type { KimsPlantUmlPluginSettings } from "../settings";
import { createPlantUmlImageUrl } from "./plantuml-client";

interface PlantUmlServerConfig {
	url: string;
	pid?: number;
}

export async function ensurePlantUmlServer(
	adapter: DataAdapter,
	pluginDir: string | undefined,
	settings: Pick<
		KimsPlantUmlPluginSettings,
		"javaDownloadCheck"
		| "plantUmlJarDownloadUrl"
		| "plantUmlReadyTimeoutMs"
		| "plantUmlReadyPollMs"
	>,
): Promise<string> {
	if (!pluginDir) {
		throw new Error("Cannot ensure PlantUML server without a plugin directory.");
	}

	const serverConfig = await readServerConfig(adapter, pluginDir);
	if (serverConfig?.url && await checkServerStatus(serverConfig.url, settings.plantUmlReadyPollMs)) {
		return serverConfig.url;
	}

	const jarPath = await ensurePlantUmlJar(adapter, pluginDir, settings);

	if (serverConfig?.pid) {
		killServer(serverConfig.pid);
	}

	const nextServerConfig = await startServer(
		jarPath,
		settings.plantUmlReadyTimeoutMs,
		settings.plantUmlReadyPollMs,
	);
	await writeServerConfig(adapter, pluginDir, nextServerConfig);

	return nextServerConfig.url;
}

async function startServer(
	jarPath: string,
	readyTimeoutMs: number,
	readyPollMs: number,
): Promise<PlantUmlServerConfig> {
	const port = await new Promise<number>((resolve, reject) => {
		const server = createServer();

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

	const url = `http://localhost:${port}`;
	const child = spawn("java", ["-jar", jarPath, `--http-server:${port}`], {
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (child.pid === undefined) {
		throw new Error("Failed to start PlantUML server.");
	}

	child.stdout.on("data", (chunk: Buffer) => {
		process.stdout.write(chunk);
	});

	child.stderr.on("data", (chunk: Buffer) => {
		process.stderr.write(chunk);
	});

	const deadline = Date.now() + readyTimeoutMs;
	while (Date.now() < deadline) {
		if (await checkServerStatus(url, readyPollMs)) {
			return {
				url,
				pid: child.pid,
			};
		}

		await new Promise((resolve) => {
			setTimeout(resolve, readyPollMs);
		});
	}

	child.kill("SIGTERM");
	throw new Error("Timed out waiting for PlantUML server to become ready.");
}

function killServer(pid: number): void {
	try {
		process.kill(pid, "SIGTERM");
	} catch (error) {
		if (
			typeof error === "object"
			&& error !== null
			&& "code" in error
			&& error.code === "ESRCH"
		) {
			return;
		}

		throw error;
	}
}

async function checkServerStatus(serverUrl: string, timeoutMs = 100): Promise<boolean> {
	const healthUrl = createPlantUmlImageUrl(
		{
			serverUrl,
			useSmetanaLayout: false,
		},
		PLANTUML_READY_SOURCE,
	);

	return new Promise((resolve) => {
		const request = httpGet(healthUrl, (response) => {
			response.resume();
			resolve(response.statusCode === 200);
		});

		request.on("error", () => {
			resolve(false);
		});
		request.setTimeout(timeoutMs, () => {
			request.destroy();
			resolve(false);
		});
	});
}

async function downloadLocalPlantUmlJarIfNotExist(jarPath: string, downloadUrl: string): Promise<void> {
	try {
		await access(jarPath);
		return;
	} catch {
		// Download below.
	}

	let currentUrl = downloadUrl;
	let redirectsRemaining = 5;

	while (true) {
		const result = await new Promise<
			| { kind: "jar"; bytes: ArrayBuffer }
			| { kind: "redirect"; location: string }
		>((resolve, reject) => {
			const request = httpsGet(currentUrl, (response) => {
				const statusCode = response.statusCode ?? 0;
				const location = response.headers.location;

				if (statusCode >= 300 && statusCode < 400 && location) {
					response.resume();
					resolve({
						kind: "redirect",
						location: new URL(location, currentUrl).toString(),
					});
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
					resolve({
						kind: "jar",
						bytes: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
					});
				});
			});

			request.on("error", reject);
		});

		if (result.kind === "jar") {
			await writeFile(jarPath, Buffer.from(result.bytes));
			return;
		}

		if (redirectsRemaining <= 0) {
			throw new Error("Too many redirects while downloading PlantUML jar.");
		}

		currentUrl = result.location;
		redirectsRemaining -= 1;
	}
}

async function ensurePlantUmlJar(
	adapter: DataAdapter,
	pluginDir: string,
	settings: Pick<KimsPlantUmlPluginSettings, "javaDownloadCheck" | "plantUmlJarDownloadUrl">,
): Promise<string> {
	const fileSystemAdapter = adapter as DataAdapter & {
		getFullPath?: (path: string) => string;
	};

	if (typeof fileSystemAdapter.getFullPath !== "function") {
		throw new Error("PlantUML server requires a filesystem-backed Obsidian adapter.");
	}

	const normalizedPlantUmlDir = `${pluginDir}/${PLANTUML_DIR}`;
	const normalizedJarPath = `${pluginDir}/${PLANTUML_JAR_PATH}`;
	const plantUmlDir = fileSystemAdapter.getFullPath(normalizedPlantUmlDir);
	const jarPath = fileSystemAdapter.getFullPath(normalizedJarPath);

	await mkdir(plantUmlDir, { recursive: true });

	if (!settings.javaDownloadCheck) {
		try {
			await access(jarPath);
			return jarPath;
		} catch {
			throw new Error("PlantUML jar is missing and Java download check is disabled.");
		}
	}

	await downloadLocalPlantUmlJarIfNotExist(jarPath, settings.plantUmlJarDownloadUrl);

	return jarPath;
}

async function writeServerConfig(
	adapter: DataAdapter,
	pluginDir: string,
	serverConfig: PlantUmlServerConfig,
): Promise<void> {
	await adapter.write(
		`${pluginDir}/${PLANTUML_SERVER_CONFIG_PATH}`,
		`${JSON.stringify(serverConfig, null, "\t")}\n`,
	);
}

async function readServerConfig(
	adapter: DataAdapter,
	pluginDir: string,
): Promise<PlantUmlServerConfig | null> {
	try {
		const rawConfig = await adapter.read(`${pluginDir}/${PLANTUML_SERVER_CONFIG_PATH}`);
		const parsedConfig: unknown = JSON.parse(rawConfig);

		if (typeof parsedConfig !== "object" || parsedConfig === null) {
			return null;
		}

		const serverConfig = parsedConfig as Record<string, unknown>;
		if (typeof serverConfig.url !== "string" || serverConfig.url.length === 0) {
			return null;
		}

		if (serverConfig.pid !== undefined && typeof serverConfig.pid !== "number") {
			return null;
		}

		return {
			url: serverConfig.url.replace(/\/$/, ""),
			pid: serverConfig.pid,
		};
	} catch {
		return null;
	}
}
