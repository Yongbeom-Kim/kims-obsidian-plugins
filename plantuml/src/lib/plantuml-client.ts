import { deflateRaw } from "pako";
import type { KimsPlantUmlPluginSettings } from "../settings";
import { SMETANA_LAYOUT_PRAGMA } from "../const";

type PlantUmlImageUrlSettings = Pick<KimsPlantUmlPluginSettings, "useSmetanaLayout"> & {
	serverUrl: string;
};

export function createPlantUmlImageUrl(settings: PlantUmlImageUrlSettings, rawSource: string): string {
	const source = transformSource(rawSource, settings.useSmetanaLayout);
	const compressedSource = deflateSource(source)
	const encodedSource = encodeSourceBytes(compressedSource)

	return `${normalizeServerUrl(settings.serverUrl)}/plantuml/svg/${encodedSource}`;
}

function normalizeServerUrl(url: string): string {
	return url.replace(/\/$/, "");
}

function transformSource(source: string, useSmetanaLayout: boolean): string {
	if (!useSmetanaLayout) {
		return source;
	}

	const lines = source.split("\n");
	if (lines[0]?.trim() === SMETANA_LAYOUT_PRAGMA) {
		return source;
	}

	return `${SMETANA_LAYOUT_PRAGMA}\n${source}`;
}

/**
 * Compresses the PlantUML source using the exact "raw DEFLATE" format expected by the
 * PlantUML server URL encoding scheme (no zlib/gzip wrapper bytes).
 *
 * The server-side decoder inflates these bytes before parsing the diagram source.
 */
function deflateSource(source: string) {
	return deflateRaw(source, { level: 9 });
}

/**
 * Encodes the compressed byte stream into PlantUML's URL-safe, base64-like alphabet.
 *
 * PlantUML groups bytes into 24-bit chunks (3 bytes), slices them into 4 x 6-bit values,
 * then maps each 6-bit value to a single character in the PlantUML alphabet.
 *
 * Any missing bytes at the tail are treated as zero (effectively padding with 0 bits),
 * matching PlantUML's reference implementation.
 */
function encodeSourceBytes(bytes: Uint8Array): string {
	let result = "";

	for (let index = 0; index < bytes.length; index += 3) {
		const byte1 = bytes[index] ?? 0;
		const byte2 = bytes[index + 1] ?? 0;
		const byte3 = bytes[index + 2] ?? 0;

		result += appendPlantUmlBytes(byte1, byte2, byte3);
	}

	return result;
}

/**
 * Packs 3 bytes (24 bits) into 4 x 6-bit values (each in the range 0..63) and encodes them.
 *
 * Bit layout:
 * - char1: bits 23..18 (byte1 >> 2)
 * - char2: bits 17..12 ((byte1 & 0b11) << 4 | byte2 >> 4)
 * - char3: bits 11..6  ((byte2 & 0b1111) << 2 | byte3 >> 6)
 * - char4: bits 5..0   (byte3 & 0b111111)
 */
function appendPlantUmlBytes(byte1: number, byte2: number, byte3: number): string {
	const char1 = byte1 >> 2;
	const char2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
	const char3 = ((byte2 & 0xF) << 2) | (byte3 >> 6);
	const char4 = byte3 & 0x3F;

	return `${encodePlantUml6Bit(char1)}${encodePlantUml6Bit(char2)}${encodePlantUml6Bit(char3)}${encodePlantUml6Bit(char4)}`;
}

/**
 * Maps a 6-bit value (0..63) to PlantUML's URL-safe encoding alphabet:
 * - 0..9   -> "0".."9"
 * - 10..35 -> "A".."Z"
 * - 36..61 -> "a".."z"
 * - 62     -> "-"
 * - 63     -> "_"
 */
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
