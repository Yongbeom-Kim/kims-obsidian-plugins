import {App, PluginSettingTab, Setting} from "obsidian";
import KimsAnkiPlugin from "./main";

export interface KimsAnkiPluginSettings {
	syncDirectory: string;
}

export const DEFAULT_SETTINGS: KimsAnkiPluginSettings = {
	syncDirectory: ''
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
	}
}
