import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "./const";
import KimsPlantUmlPlugin from "./main";

export interface KimsPlantUmlPluginSettings {
	javaDownloadCheck: boolean;
	renderDebounceMs: number;
	useSmetanaLayout: boolean;
	plantUmlJarDownloadUrl: string;
	plantUmlReadyTimeoutMs: number;
	plantUmlReadyPollMs: number;
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

		new Setting(containerEl)
			.setName("Jar download URL")
			.setDesc("URL used to download plantuml.jar when it is missing.")
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.plantUmlJarDownloadUrl)
				.setValue(this.plugin.settings.plantUmlJarDownloadUrl)
				.onChange(async (value) => {
					this.plugin.settings.plantUmlJarDownloadUrl = parseJarDownloadUrl(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Server ready timeout (ms)")
			.setDesc("How long to wait for the local PlantUML server to become healthy.")
			.addText(text => text
				.setPlaceholder(String(DEFAULT_SETTINGS.plantUmlReadyTimeoutMs))
				.setValue(String(this.plugin.settings.plantUmlReadyTimeoutMs))
				.onChange(async (value) => {
					this.plugin.settings.plantUmlReadyTimeoutMs = parsePositiveMs(
						value,
						DEFAULT_SETTINGS.plantUmlReadyTimeoutMs,
					);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Server ready poll (ms)")
			.setDesc("How often to poll the server health endpoint while waiting for readiness.")
			.addText(text => text
				.setPlaceholder(String(DEFAULT_SETTINGS.plantUmlReadyPollMs))
				.setValue(String(this.plugin.settings.plantUmlReadyPollMs))
				.onChange(async (value) => {
					this.plugin.settings.plantUmlReadyPollMs = parsePositiveMs(
						value,
						DEFAULT_SETTINGS.plantUmlReadyPollMs,
					);
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

function parseJarDownloadUrl(value: string): string {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return DEFAULT_SETTINGS.plantUmlJarDownloadUrl;
	}

	try {
		return new URL(trimmed).toString();
	} catch {
		return DEFAULT_SETTINGS.plantUmlJarDownloadUrl;
	}
}

function parsePositiveMs(value: string, fallback: number): number {
	const parsed = Number(value);

	if (!Number.isFinite(parsed) || parsed < 1) {
		return fallback;
	}

	return Math.floor(parsed);
}
