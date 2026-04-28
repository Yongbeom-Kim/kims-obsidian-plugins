import { deflateRaw } from "pako";

const SMETANA_LAYOUT_PRAGMA = "!pragma layout smetana";

interface CreatePlantUmlSvgUrlOptions {
	useSmetanaLayout: boolean;
}

export function createPlantUmlSvgUrl(serverUrl: string, source: string): string {
	return `${normalizeServerUrl(serverUrl)}/plantuml/svg/${encodePlantUml(source)}`;
}

export function preparePlantUmlSource(source: string, options: CreatePlantUmlSvgUrlOptions): string {
	if (!options.useSmetanaLayout) {
		return source;
	}

	const lines = source.split("\n");
	if (lines[0]?.trim() === SMETANA_LAYOUT_PRAGMA) {
		return source;
	}

	return `${SMETANA_LAYOUT_PRAGMA}\n${source}`;
}

function normalizeServerUrl(url: string): string {
	return url.replace(/\/$/, "");
}

function encodePlantUml(source: string): string {
	const compressed = deflateRaw(source, { level: 9 });

	return encodePlantUmlBytes(compressed);
}

function encodePlantUmlBytes(bytes: Uint8Array): string {
	let result = "";

	for (let index = 0; index < bytes.length; index += 3) {
		const byte1 = bytes[index] ?? 0;
		const byte2 = bytes[index + 1] ?? 0;
		const byte3 = bytes[index + 2] ?? 0;

		result += appendPlantUmlBytes(byte1, byte2, byte3);
	}

	return result;
}

function appendPlantUmlBytes(byte1: number, byte2: number, byte3: number): string {
	const char1 = byte1 >> 2;
	const char2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
	const char3 = ((byte2 & 0xF) << 2) | (byte3 >> 6);
	const char4 = byte3 & 0x3F;

	return `${encodePlantUml6Bit(char1)}${encodePlantUml6Bit(char2)}${encodePlantUml6Bit(char3)}${encodePlantUml6Bit(char4)}`;
}

function encodePlantUml6Bit(value: number): string {
	if (value < 10) {
		return String.fromCharCode(48 + value);
	}

	const uppercaseValue = value - 10;
	if (uppercaseValue < 26) {
		return String.fromCharCode(65 + uppercaseValue);
	}

	const lowercaseValue = uppercaseValue - 26;
	if (lowercaseValue < 26) {
		return String.fromCharCode(97 + lowercaseValue);
	}

	return lowercaseValue === 26 ? "-" : "_";
}
