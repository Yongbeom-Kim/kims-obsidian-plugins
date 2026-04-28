import {App, Editor, MarkdownView} from 'obsidian';

export const getEditor = (app: App): Editor | undefined => {
	const view = app.workspace.getActiveViewOfType(MarkdownView);

	return view?.editor
}

export const getCurrentEditorContents = (app: App): string | undefined => {
	return getEditor(app)?.getValue?.();
}

export const setCurrentEditorContents = (app: App, fileContents: string) => {
	return getEditor(app)?.setValue(fileContents)
}