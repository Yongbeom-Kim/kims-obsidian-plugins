import {App, PluginSettingTab, Setting} from "obsidian";
import KimsAnkiPlugin from "./main";

export interface KimsAnkiPluginSettings {
	syncDirectory: string;
	includePromptCloze: boolean;
}

export const DEFAULT_SETTINGS: KimsAnkiPluginSettings = {
	syncDirectory: '',
	includePromptCloze: false,
}

export class KimsAnkiPluginSettingTab extends PluginSettingTab {
	plugin: KimsAnkiPlugin;

	constructor(app: App, plugin: KimsAnkiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Sync directory')
			.setDesc('Only notes under this vault subdirectory will be included in bulk sync.')
			.addText(text => text
				.setPlaceholder('anki-notes')
				.setValue(this.plugin.settings.syncDirectory)
				.onChange(async (value) => {
					this.plugin.settings.syncDirectory = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Include prompt cloze')
			.setDesc('Wrap the text before the separator in a cloze prompt template. Disabled by default.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includePromptCloze)
				.onChange(async (value) => {
					this.plugin.settings.includePromptCloze = value;
					await this.plugin.saveSettings();
				}));
	}
}
