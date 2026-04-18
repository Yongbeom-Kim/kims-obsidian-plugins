import {App, MarkdownView} from 'obsidian';

export function getCurrentEditorContents(app: App): string | undefined {
	const view = app.workspace.getActiveViewOfType(MarkdownView);

	return view?.editor?.getValue?.();
}
