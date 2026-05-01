import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "./const";
import KimsPlantUmlPlugin from "./main";

export interface KimsPlantUmlPluginSettings {
	javaDownloadCheck: boolean;
	renderDebounceMs: number;
	useSmetanaLayout: boolean;
}

export class KimsPlantUmlPluginSettingTab extends PluginSettingTab {
	plugin: KimsPlantUmlPlugin;

	constructor(app: App, plugin: KimsPlantUmlPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Check download")
			.setDesc("Check for the local diagram jar on startup and download it into the plugin folder if missing.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.javaDownloadCheck)
				.onChange(async (value) => {
					this.plugin.settings.javaDownloadCheck = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Delay render")
			.setDesc("Wait before rendering diagrams after a note refresh.")
			.addText(text => text
				.setPlaceholder("300")
				.setValue(String(this.plugin.settings.renderDebounceMs))
				.onChange(async (value) => {
					this.plugin.settings.renderDebounceMs = parseDebounceMs(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Use no-dot layout")
			.setDesc("Inject !pragma layout smetana before rendering diagrams.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useSmetanaLayout)
				.onChange(async (value) => {
					this.plugin.settings.useSmetanaLayout = value;
					await this.plugin.saveSettings();
				}));
	}
}

function parseDebounceMs(value: string): number {
	const parsed = Number(value);

	if (!Number.isFinite(parsed) || parsed < 0) {
		return DEFAULT_SETTINGS.renderDebounceMs;
	}

	return Math.floor(parsed);
}
