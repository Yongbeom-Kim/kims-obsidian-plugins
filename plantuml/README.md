# Kim's PlantUML Plugin

Kim's PlantUML Plugin is an Obsidian plugin for working with PlantUML diagrams.

The package is scaffolded as part of the `kims-obsidian-plugin` pnpm monorepo.

## Development

From the monorepo root:

```bash
pnpm install
pnpm dev:plantuml
```

For a production build:

```bash
pnpm --filter obsidian-kims-plantuml-plugin build
```

## Manual Install

For local development, symlink `plantuml/main.js`, `plantuml/manifest.json`, and `plantuml/styles.css` into your vault's `.obsidian/plugins/kims-plantuml-plugin` folder.

## Current Scope

The plugin registers `plantuml` and `puml` markdown code blocks and renders them through a local PlantUML pico web server.

On startup, the plugin checks `plantuml-server.json` in its plugin directory, reuses the server if it is still healthy, and otherwise downloads `plantuml.jar` into `.plantuml/` when needed, starts a new local server, and rewrites the runtime config.
