import axios from 'axios';
import { error } from 'console';

const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
const ANKI_CONNECT_VERSION = 6;

type AnkiConnectActionParams = Record<string, unknown>;

interface AnkiConnectRequest<TParams extends AnkiConnectActionParams | undefined = AnkiConnectActionParams> {
	action: string;
	version: number;
	key?: string;
	params?: TParams;
}

interface AnkiConnectResponse<TResult> {
	error: string | null;
	result: TResult;
}

interface AnkiFieldValue {
	order: number;
	value: string;
}

interface RequestPermissionResultGranted {
	permission: 'granted';
	requireApiKey: boolean;
	version: number;
}

interface RequestPermissionResultDenied {
	permission: 'denied';
}

type RequestPermissionResult = RequestPermissionResultGranted | RequestPermissionResultDenied;

interface NoteMedia {
	filename: string;
	data?: string;
	path?: string;
	url?: string;
	skipHash?: string;
	fields?: string[];
}

interface AddNoteOptions {
	allowDuplicate?: boolean;
	duplicateScope?: 'deck' | 'collection';
	duplicateScopeOptions?: {
		deckName?: string | null;
		checkChildren?: boolean;
		checkAllModels?: boolean;
	};
}

interface UpdateNoteInput {
	id: number;
	fields: Record<string, string>;
	tags?: string[];
	audio?: NoteMedia[];
	video?: NoteMedia[];
	picture?: NoteMedia[];
}

interface UpdateNoteModelInput {
	id: number;
	modelName: string;
	fields: Record<string, string>;
	tags?: string[];
}

export interface NoteInfo {
	noteId: number;
	profile?: string;
	cards?: number[];
	modelName?: string;
	tags?: string[];
	mod?: number;
	fields?: Record<string, AnkiFieldValue>;
}

export interface AddNoteInput {
	deckName: string;
	modelName: string;
	fields: Record<string, string>;
	tags?: string[];
	options?: AddNoteOptions;
	audio?: NoteMedia[];
	video?: NoteMedia[];
	picture?: NoteMedia[];
}

export interface AnkiClientOptions {
	apiKey?: string;
	url?: string;
	timeoutMs?: number;
}

class AnkiConnectClient {
	private readonly apiKey?: string;
	private readonly timeoutMs: number;
	private readonly url: string;
	private permissionCheck: Promise<RequestPermissionResultGranted> | null = null;

	constructor(options: AnkiClientOptions = {}) {
		this.apiKey = options.apiKey;
		this.timeoutMs = options.timeoutMs ?? 5000;
		this.url = options.url ?? ANKI_CONNECT_URL;
	}

	private async request<TResult, TParams extends AnkiConnectActionParams | undefined = AnkiConnectActionParams>(
		action: string,
		params?: TParams,
	): Promise<TResult> {
		const body: AnkiConnectRequest<TParams> = {
			action,
			version: ANKI_CONNECT_VERSION,
			params,
		};

		if (this.apiKey) {
			body.key = this.apiKey;
		}

		const response = await axios.post<AnkiConnectResponse<TResult>>(this.url, body, {
			headers: {
				'Content-Type': 'application/json',
			},
			timeout: this.timeoutMs,
		});

		const payload = response.data;

		if (Object.keys(payload).length !== 2) {
			throw new Error('AnkiConnect response has an unexpected number of fields');
		}

		if (!Object.prototype.hasOwnProperty.call(payload, 'error')) {
			throw new Error('AnkiConnect response is missing required error field');
		}

		if (!Object.prototype.hasOwnProperty.call(payload, 'result')) {
			throw new Error('AnkiConnect response is missing required result field');
		}

		if (payload.error) {
			throw new Error(payload.error);
		}

		return payload.result;
	}

	private async ensurePermission(): Promise<RequestPermissionResultGranted> {
		if (!this.permissionCheck) {
			this.permissionCheck = (async () => {
				const permission = await this.request<RequestPermissionResult>('requestPermission');

				if (permission.permission !== 'granted') {
					throw new Error('AnkiConnect permission was denied for this origin.');
				}

				if (permission.version < ANKI_CONNECT_VERSION) {
					throw new Error(
						`AnkiConnect API version ${permission.version} is too old; version ${ANKI_CONNECT_VERSION} is required.`,
					);
				}

				if (permission.requireApiKey && !this.apiKey) {
					throw new Error('AnkiConnect requires an API key, but none was configured.');
				}

				return permission;
			})();
		}

		try {
			return await this.permissionCheck;
		} catch (error) {
			this.permissionCheck = null;
			throw error;
		}
	}

	async invoke<TResult, TParams extends AnkiConnectActionParams | undefined = AnkiConnectActionParams>(
		action: string,
		params?: TParams,
	): Promise<TResult> {
		if (action !== 'requestPermission') {
			await this.ensurePermission();
		}

		return this.request<TResult, TParams>(action, params);
	}

	async requestPermission(): Promise<RequestPermissionResult> {
		return this.request<RequestPermissionResult>('requestPermission');
	}

	async getVersion(): Promise<number> {
		return this.invoke<number>('version');
	}
}

export function parseAnkiNoteId(noteId: string): number {
	if (!/^\d+$/.test(noteId)) {
		throw new Error(`Invalid Anki note ID: ${noteId}`);
	}

	const parsed = Number(noteId);

	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new Error(`Invalid Anki note ID: ${noteId}`);
	}

	return parsed;
}

const ankiClient = new AnkiConnectClient();

export function createAnkiClient(options?: AnkiClientOptions): AnkiConnectClient {
	return new AnkiConnectClient(options);
}

export async function requestPermission(): Promise<RequestPermissionResult> {
	return ankiClient.requestPermission();
}

export async function getVersion(): Promise<number> {
	return ankiClient.getVersion();
}

export async function getDeckNames(): Promise<string[]> {
	return ankiClient.invoke<string[]>('deckNames');
}

export async function getNote(noteId: string): Promise<NoteInfo | undefined> {
	const parsedNoteId = parseAnkiNoteId(noteId);

	const notes = await ankiClient.invoke<NoteInfo[], { notes: number[] }>('notesInfo', {
		notes: [parsedNoteId],
	});

	// special check because Anki API is special like that
	// API returns {}
	if (Object.keys(notes[0] ?? {}).length == 0) {
		return undefined
	}

	return notes[0];
}

export async function addNote(note: AddNoteInput): Promise<number | null> {
	return ankiClient.invoke<number | null, { note: AddNoteInput }>('addNote', { note });
}

export async function updateNote(note: UpdateNoteInput): Promise<void> {
	await ankiClient.invoke<null, { note: UpdateNoteInput }>('updateNote', { note });
}

export async function updateNoteModel(note: UpdateNoteModelInput): Promise<void> {
	await ankiClient.invoke<null, { note: UpdateNoteModelInput }>('updateNoteModel', { note });
}

export async function setNoteField(noteId: string, fields: Record<string, string>): Promise<void> {
	await updateNote({
		id: parseAnkiNoteId(noteId),
		fields,
	});
}

export async function deckExists(deckName: string): Promise<boolean> {
	const decks = await getDeckNames();

	return decks.includes(deckName);
}

export async function addDeck(deckName: string): Promise<number> {
	return ankiClient.invoke<number, { deck: string }>('createDeck', {
		deck: deckName,
	});
}

export async function getDecks(cards: number[]): Promise<Record<string, number[]>> {
	return ankiClient.invoke<Record<string, number[]>, { cards: number[] }>('getDecks', {
		cards,
	});
}

export async function changeDeck(cards: number[], deckName: string): Promise<void> {
	await ankiClient.invoke<null, { cards: number[]; deck: string }>('changeDeck', {
		cards,
		deck: deckName,
	});
}
