import { App, Modal, Notice, Plugin, TFile, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, KimsAnkiPluginSettingTab, KimsAnkiPluginSettings } from "./settings";
import { getCurrentEditorContents, setCurrentEditorContents } from 'libs/obsidian/editor';
import { upsertNote } from 'libs/anki';
import { markdownToHtml } from 'libs/md-transform/html-transform';
import { transformMarkdownToCloze } from 'libs/md-transform/cloze-transform';
import {
	generateAnkiNoteIdMarker,
	getUserNoteBetweenDelimiters,
	hasGeneratedCloze,
	hasGeneratedNoteDelimiters,
	hasUserNoteDelimiters,
	parseAnkiCardType,
	parseAnkiNoteId,
	parseAnkiTargetDeck,
	regenerateGeneratedNoteSection,
} from 'libs/obsidian/file-parser';

class NoteSyncError extends Error {}

type SyncMarkdownNoteResult = {
	updatedMarkdown: string;
	noteId: string;
};

type BulkSyncResult = {
	syncedCount: number;
	skippedCount: number;
	failedFiles: string[];
};

const syncMarkdownNoteWithAnki = async (
	markdown: string,
	vaultName: string,
	includePromptCloze: boolean,
): Promise<SyncMarkdownNoteResult> => {
	if (!hasUserNoteDelimiters(markdown) || !hasGeneratedNoteDelimiters(markdown)) {
		throw new NoteSyncError('Missing user note or generated note delimiters');
	}

	const userNote = getUserNoteBetweenDelimiters(markdown);
	const transformedNote = transformMarkdownToCloze(userNote, {
		includePromptCloze,
	});

	if (!hasGeneratedCloze(transformedNote)) {
		throw new NoteSyncError('No cloze deletions were generated; skipping Anki sync');
	}

	const ankiTargetDeck = parseAnkiTargetDeck(markdown);
	const ankiCardType = parseAnkiCardType(markdown);
	const ankiNoteId = parseAnkiNoteId(markdown);

	if (!ankiCardType || !ankiTargetDeck) {
		throw new NoteSyncError('Missing Anki target deck or card type');
	}

	const noteId = await upsertNote({
		fields: {
			text: await markdownToHtml(transformedNote, vaultName),
		},
		id: ankiNoteId,
		deckName: ankiTargetDeck,
		cardType: ankiCardType,
		tags: ['from-obsidian'],
	});

	return {
		noteId,
		updatedMarkdown: regenerateGeneratedNoteSection(
			markdown,
			generateAnkiNoteIdMarker(noteId) + '\n' + transformedNote,
		),
	};
};

const isMarkdownFileInDirectory = (file: TFile, directory: string): boolean => {
	if (file.extension !== 'md') {
		return false;
	}

	if (!directory) {
		return true;
	}

	return file.path === directory || file.path.startsWith(`${directory}/`);
};

export default class KimsAnkiPlugin extends Plugin {
	settings: KimsAnkiPluginSettings;

	private getNormalizedSyncDirectory(): string {
		return normalizePath(this.settings.syncDirectory).replace(/^\.$/, '');
	}

	private async syncVaultFileWithAnki(file: TFile): Promise<'synced' | 'skipped'> {
		const markdown = await this.app.vault.read(file);

		try {
			const result = await syncMarkdownNoteWithAnki(
				markdown,
				this.app.vault.getName(),
				this.settings.includePromptCloze,
			);
			await this.app.vault.modify(file, result.updatedMarkdown);
			return 'synced';
		} catch (error) {
			if (error instanceof NoteSyncError) {
				return 'skipped';
			}

			throw error;
		}
	}

	private async syncAllNotesWithAnki(): Promise<BulkSyncResult> {
		const directory = this.getNormalizedSyncDirectory();

		if (!directory) {
			throw new NoteSyncError('Set a sync directory before running bulk sync');
		}

		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => isMarkdownFileInDirectory(file, directory));

		const result: BulkSyncResult = {
			syncedCount: 0,
			skippedCount: 0,
			failedFiles: [],
		};

		for (const file of files) {
			try {
				const status = await this.syncVaultFileWithAnki(file);

				if (status === 'synced') {
					result.syncedCount += 1;
				} else {
					result.skippedCount += 1;
				}
			} catch (error) {
				console.error(`Failed to sync ${file.path} with Anki`, error);
				result.failedFiles.push(file.path);
			}
		}

		return result;
	}

	async onload() {
		await this.loadSettings();

		// scan all
		this.addRibbonIcon('square-star', "Sync All Notes With Anki", async (_evt: MouseEvent) => {
			try {
				const result = await this.syncAllNotesWithAnki();
				return new Notice(`Bulk sync complete: ${result.syncedCount} synced, ${result.skippedCount} skipped, ${result.failedFiles.length} failed`)
			} catch (error) {
				if (error instanceof NoteSyncError) {
					return new Notice(error.message)
				}

				throw error
			}
		});
		// scan current
		this.addRibbonIcon('star', 'Sync Current Note With Anki', async (_evt: MouseEvent) => {
			const md = getCurrentEditorContents(this.app) ?? ''

			try {
				const result = await syncMarkdownNoteWithAnki(
					md,
					this.app.vault.getName(),
					this.settings.includePromptCloze,
				);
				setCurrentEditorContents(this.app, result.updatedMarkdown)
				return new Notice(`Anki note generated with id ${result.noteId}`)
			} catch (error) {
				if (error instanceof NoteSyncError) {
					return new Notice(error.message)
				}

				throw error
			}

		});

		// // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status bar text');

		// // This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-modal-simple',
		// 	name: 'Open modal (simple)',
		// 	callback: () => {
		// 		new KimsAnkiPluginModal(this.app).open();
		// 	}
		// });
		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'replace-selected',
		// 	name: 'Replace selected content',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		editor.replaceSelection("Kim's Anki Plugin editor command");
		// 	}
		// });
		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-modal-complex',
		// 	name: 'Open modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new KimsAnkiPluginModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 		return false;
		// 	}
		// });

		this.addSettingTab(new KimsAnkiPluginSettingTab(this.app, this));

		// // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// // Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	new Notice("Click");
		// });

		// // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<KimsAnkiPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class KimsAnkiPluginModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
