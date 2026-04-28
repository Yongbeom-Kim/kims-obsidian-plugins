import { MarkdownRenderChild, Notice, Plugin, type MarkdownPostProcessorContext } from "obsidian";
import { createPlantUmlSvgUrl, preparePlantUmlSource } from "./lib/plantuml-client";
import {
	shutdownPlantUmlServer,
	startPlantUmlServer,
} from "./lib/plantuml-server";
import {
	DEFAULT_SETTINGS,
	KimsPlantUmlPluginSettingTab,
	type KimsPlantUmlPluginSettings,
} from "./settings";

const DEFAULT_PLANTUML_SOURCE = `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi
@enduml`;

export default class KimsPlantUmlPlugin extends Plugin {
	settings: KimsPlantUmlPluginSettings;

	private plantUmlServerUrl: string | null = null;

	async onload(): Promise<void> {
		debugLog("onload: start");
		await this.loadSettings();
		debugLog("onload: settings loaded", this.settings);
		this.addSettingTab(new KimsPlantUmlPluginSettingTab(this.app, this));

		debugLog("onload: shutting down previous PlantUML server");
		await shutdownPlantUmlServer(
			this.app.vault.adapter,
			this.manifest.dir,
		);
		debugLog("onload: previous PlantUML server shutdown complete");

		try {
			debugLog("onload: starting PlantUML server", {
				pluginDir: this.manifest.dir,
				javaDownloadCheck: this.settings.javaDownloadCheck,
			});
			this.plantUmlServerUrl = await startPlantUmlServer(
				this.app.vault.adapter,
				this.manifest.dir,
				{
					javaDownloadCheck: this.settings.javaDownloadCheck,
				},
			);
			debugLog("onload: PlantUML server started", {
				url: this.plantUmlServerUrl,
			});
		} catch (error) {
			debugLog("onload: PlantUML server failed to start", error);
			new Notice("Diagram server failed to start");
		}

		this.registerPlantUmlProcessor();

		this.addCommand({
			id: "insert-diagram",
			name: "Insert diagram",
			editorCallback: (editor) => {
				editor.replaceSelection(`\`\`\`plantuml\n${DEFAULT_PLANTUML_SOURCE}\n\`\`\``);
			},
		});

		debugLog("onload: complete");
		new Notice("Diagram plugin loaded");
	}

	onunload(): void {
		debugLog("onunload: shutting down PlantUML server");
		void shutdownPlantUmlServer(
			this.app.vault.adapter,
			this.manifest.dir,
		);
	}

	async loadSettings(): Promise<void> {
		const loadedSettings = await this.loadData() as Partial<KimsPlantUmlPluginSettings> | null;

		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private registerPlantUmlProcessor(): void {
		const render = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
			this.renderPlantUml(source, el, ctx);
		};

		this.registerMarkdownCodeBlockProcessor("plantuml", render);
		this.registerMarkdownCodeBlockProcessor("puml", render);
	}

	private renderPlantUml(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
		el.empty();

		const diagramSource = preparePlantUmlSource(
			source.trim() || DEFAULT_PLANTUML_SOURCE,
			{
				useSmetanaLayout: this.settings.useSmetanaLayout,
			},
		);

		const container = el.createDiv({
			cls: "kims-plantuml-placeholder",
		});

		container.createEl("strong", {
			text: "Diagram preview",
		});

		const previewEl = container.createDiv();
		ctx.addChild(new DebouncedPlantUmlRenderChild(
			previewEl,
			this.settings.renderDebounceMs,
			() => {
				this.renderPlantUmlImage(previewEl, diagramSource);
			},
		));

		const sourceDetails = container.createEl("details");
		sourceDetails.createEl("summary", {
			text: "Source",
		});
		sourceDetails.createEl("pre", {
			text: diagramSource,
		});
	}

	private renderPlantUmlImage(el: HTMLElement, diagramSource: string): void {
		el.empty();
		if (!this.plantUmlServerUrl) {
			el.createEl("p", {
				cls: "kims-plantuml-placeholder__meta",
				text: "Diagram server is not running.",
			});
			return;
		}

		el.createEl("img", {
			cls: "kims-plantuml-placeholder__image",
			attr: {
				alt: "Diagram rendered by local server",
				src: createPlantUmlSvgUrl(this.plantUmlServerUrl, diagramSource),
			},
		});
	}
}

function debugLog(message: string, data?: unknown): void {
	// eslint-disable-next-line no-console
	console.log(`[kims-plantuml] ${message}`, data ?? "");
}

class DebouncedPlantUmlRenderChild extends MarkdownRenderChild {
	private timeoutId: number | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly debounceMs: number,
		private readonly render: () => void,
	) {
		super(containerEl);
	}

	onload(): void {
		this.timeoutId = window.setTimeout(() => {
			this.timeoutId = null;
			this.render();
		}, this.debounceMs);
	}

	onunload(): void {
		if (this.timeoutId !== null) {
			window.clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}
}
