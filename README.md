# catalog

**Know every dev tool on your machine — what it is, whether it's safe, and what's worth keeping.**

catalog is a macOS desktop app that scans the developer tooling installed across your package managers, enriches each entry with AI-generated descriptions and tags, and layers on practical audits: security/CVE scanning, available updates, disk usage, dependency checks, GitHub stars, and a "doctor" for broken symlinks and PATH shadowing. It turns *"what is this binary and can I delete it?"* into a searchable, annotated, auditable index.

[![CI](https://github.com/xooxoxxo/catalog/actions/workflows/ci.yml/badge.svg)](https://github.com/xooxoxxo/catalog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB.svg)

---

## Features

### Catalog & search
- **Multi-source scan** — discovers tools installed via Homebrew, Cargo, npm, pipx, uv, Go, Bun, and the Mac App Store (`mas`).
- **Instant search & filter** — fuzzy search (Fuse.js) over a virtualized list that stays fast with hundreds of entries.
- **Group, favorite, tag** — group by source or tag, star the tools you care about, and filter by facets (including "no description yet").
- **Command palette** — keyboard-driven navigation to every view and action.

### AI enrichment
- **Describe with your own LLM** — one-click descriptions, aliases, and tags per tool, or batch-describe the whole catalog.
- **Bring-your-own provider** — pluggable CLI providers out of the box: `claude`, `codex`, `ollama` (local), or a fully custom command. No API keys baked in.
- **Metadata only** — prompts are built from already-collected metadata (name, version, source, path). catalog never instructs the model to run your binaries.

### Audits
- **Security / CVE scan** — surfaces known vulnerabilities, including a dedicated Homebrew CVE pass (optional NVD API key for higher rate limits).
- **Updates** — detects which tools have newer versions available and can generate an update script.
- **Disk usage** — measures what each tool costs on disk so you can find the hogs.
- **Doctor** — flags broken symlinks and PATH shadowing (two tools answering to the same name).
- **Dependency check** — verifies the external tools catalog itself relies on are present.

### GitHub
- **Connect via device flow** — OAuth device-code login; the token is stored in the macOS Keychain and never exposed to the web layer.
- **Stars & READMEs** — browse your starred repos, read READMEs inline, and star/unstar without leaving the app.

### Theming
- **Light + dark, your way** — pick a default theme for each mode; the light/dark toggle swaps between your two chosen defaults.
- **Custom themes** — full color-token editor, font and corner-radius controls, and AI palette generation from a "vibe". Up to 20 custom themes.
- **Import / export** — share themes as `.ctlgtheme` files; double-clicking one opens catalog and imports it.

### Built for power users
- Full keyboard operability, native notifications for long-running scans, `prefers-reduced-motion` support, and WCAG 2.1 AA color contrast targets in both themes.

---

## Requirements

- **macOS** (Apple Silicon or Intel)
- For building from source:
  - [Rust](https://rustup.rs/) (stable)
  - [Node.js](https://nodejs.org/) 18+
  - Xcode Command Line Tools (`xcode-select --install`)
- For AI enrichment (optional): at least one supported LLM CLI on your `PATH` — e.g. [`claude`](https://docs.claude.com/en/docs/claude-code), `codex`, or [`ollama`](https://ollama.com/).

The tools catalog *scans* (brew, cargo, npm, …) only need to be present for their entries to appear — none are required to run the app.

---

## Install

No prebuilt releases yet — build from source:

```bash
git clone https://github.com/xooxoxxo/catalog.git
cd catalog
npm install
npm run tauri build
```

The bundled app and DMG land in `src-tauri/target/release/bundle/`. Open the `.app` or install the DMG.

---

## Development

```bash
npm install            # install JS dependencies
npm run tauri dev      # run the app with hot reload
```

Other scripts:

```bash
npm test               # frontend logic tests (Vitest)
npm run build          # type-check + build the web frontend only
cd src-tauri && cargo test   # Rust unit tests
```

### Tech stack

| Layer    | Stack                                                |
| -------- | ---------------------------------------------------- |
| Shell    | [Tauri 2](https://tauri.app/) (Rust)                 |
| Frontend | React 19 + TypeScript, Vite                          |
| UI       | Base UI, Phosphor icons, Geist fonts, framer-motion  |
| Lists    | TanStack Virtual                                     |
| Search   | Fuse.js                                              |

Heavy operations (scans, audits, LLM calls) run off the UI thread in Rust and stream progress back to the frontend via events.

---

## Configuration

Open **Settings** in the app to configure:

- **LLM provider** — choose the active provider and edit its command/args. The default is `claude`; `ollama` runs fully offline. Use `custom` to wire up any CLI that takes a prompt.
- **GitHub** — connect via device flow to enable stars and README browsing.
- **NVD API key** *(optional)* — improves Homebrew CVE scan rate limits.

### Theme file format

Themes export to `.ctlgtheme` — a small JSON document:

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "base": "dark",
  "radius": 10,
  "fonts": { "ui": "...", "mono": "..." },
  "colors": {
    "bg": "#141416", "surface": "#19191c", "surface2": "#1e1e22",
    "line": "...", "line2": "...",
    "text": "...", "text-2": "...", "text-3": "...",
    "accent": "...", "accent-fg": "...",
    "update": "...", "orphan": "...", "danger": "..."
  }
}
```

Import from the Themes panel, or double-click a `.ctlgtheme` file in Finder.

---

## Privacy & security

- **Local first.** catalog scans your machine locally. Nothing is uploaded by the app itself.
- **Your LLM, your terms.** Enrichment runs through a provider CLI *you* configure. Prompts contain tool metadata only — never instructions to execute your binaries — and providers run in a sandboxed working directory.
- **Secrets stay in the Keychain.** The GitHub token is stored in the macOS Keychain and is never returned to the web layer.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for environment setup and the checks CI runs, and the [Code of Conduct](CODE_OF_CONDUCT.md). Found a security issue? Follow the [security policy](SECURITY.md) — please don't open a public issue for vulnerabilities.

---

## License

[MIT](LICENSE)
