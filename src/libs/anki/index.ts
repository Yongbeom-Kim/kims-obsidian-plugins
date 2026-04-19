import {
	addDeck,
	addNote,
	changeDeck,
	deckExists,
	getDecks,
	getNote,
	parseAnkiNoteId,
	updateNote,
} from './api';

export type UpsertNoteInput = {
	fields: Record<string, string>;
	id?: string;
	deckName: string;
	cardType: string;
	tags?: string[];
};
const ensureDeckExistsForNewNote = async (deckName: string): Promise<void> => {
	if (await deckExists(deckName)) {
		return;
	}

	await addDeck(deckName);
};

const moveNoteToDeckIfNeeded = async (noteId: string, deckName: string): Promise<void> => {
	const note = await getNote(noteId);
	const cards = note?.cards ?? [];

	if (cards.length === 0) {
		return;
	}

	const decksByName = await getDecks(cards);
	const isAlreadyInDeck = Object.entries(decksByName).some(([name, deckCards]) => (
		name === deckName && deckCards.length === cards.length
	));

	if (!isAlreadyInDeck) {
		await changeDeck(cards, deckName);
	}
};

export const upsertNote = async (info: UpsertNoteInput): Promise<string> => {
	const existingNote = info.id ? await getNote(info.id) : undefined;

	if (!info.id || !existingNote) {
		await ensureDeckExistsForNewNote(info.deckName);

		const noteId = await addNote({
			deckName: info.deckName,
			modelName: info.cardType,
			fields: info.fields,
			tags: info.tags,
		});

		if (noteId === null) {
			throw new Error('AnkiConnect failed to create the note.');
		}

		return String(noteId);
	}

	if (existingNote.modelName && existingNote.modelName !== info.cardType) {
		throw new Error(
			`Changing note type is not implemented via AnkiConnect wrapper: ${existingNote.modelName} -> ${info.cardType}`,
		);
	}

	await moveNoteToDeckIfNeeded(info.id, info.deckName);
	await updateNote({
		id: parseAnkiNoteId(info.id),
		fields: info.fields,
		tags: info.tags,
	});

	return info.id;
};
