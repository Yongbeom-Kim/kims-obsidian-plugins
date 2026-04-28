# Kim's PlantUML Plugin

Kim's PlantUML Plugin is an Obsidian plugin for working with PlantUML diagrams.

The package is scaffolded as part of the `kims-obsidian-plugin` pnpm monorepo.

## Development

From the monorepo root:

```bash
pnpm install
pnpm plantuml:download
pnpm plantuml:serve
pnpm dev:plantuml
```

For a production build:

```bash
pnpm --filter obsidian-kims-plantuml-plugin build
```

## Manual Install

For local development, symlink `plantuml/main.js`, `plantuml/manifest.json`, `plantuml/styles.css`, and `plantuml/plantuml-server.json` into your vault's `.obsidian/plugins/kims-plantuml-plugin` folder.

## Current Scope

The plugin registers `plantuml` and `puml` markdown code blocks and renders them through a local PlantUML pico web server. `pnpm plantuml:serve` asks Node to reserve an ephemeral localhost port, starts PlantUML on that port, and writes `plantuml/plantuml-server.json` so the plugin can discover the URL.

`pnpm plantuml:download` saves `plantuml.jar` under `plantuml/.plantuml/`, which is ignored by Git.
