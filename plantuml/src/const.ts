export const DEFAULT_PLANTUML_SOURCE = `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi
@enduml`;

export const DEFAULT_SETTINGS = {
	javaDownloadCheck: true,
	renderDebounceMs: 300,
	useSmetanaLayout: false,
};

export const SMETANA_LAYOUT_PRAGMA = "!pragma layout smetana";

export const PLANTUML_JAR_DOWNLOAD_URL = "https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar";
export const PLANTUML_DIR = ".plantuml";
export const PLANTUML_SERVER_CONFIG_PATH = `${PLANTUML_DIR}/plantuml-server.json`;
export const PLANTUML_JAR_PATH = `${PLANTUML_DIR}/plantuml.jar`;
export const PLANTUML_READY_TIMEOUT_MS = 10_000;
export const PLANTUML_READY_POLL_MS = 100;
export const PLANTUML_READY_SOURCE = "@startuml\nAlice -> Bob: Ready\n@enduml";
