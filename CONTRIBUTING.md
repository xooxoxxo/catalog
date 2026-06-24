# Contributing to catalog

Thanks for your interest in contributing! This guide will help you get the app set up locally, understand our project structure, and know what to expect when opening a pull request.

For a high-level overview of the project, see the [README](./README.md). For our community expectations, see the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Prerequisites

**macOS** (Apple Silicon or Intel) with the following installed:

- **Rust** (stable) — install via [rustup](https://rustup.rs/)
- **Node.js** 22 — check `.nvmrc` for the pinned version; [nvm](https://github.com/nvm-sh/nvm) or [Homebrew](https://brew.sh/) work well
- **Xcode Command Line Tools** — run `xcode-select --install` if you don't have them

The dev tools that catalog *scans* (Homebrew, Cargo, npm, etc.) only need to exist for their entries to appear in the app — none are required to build or develop.

---

## Getting Started

### Clone & install

```bash
git clone https://github.com/xooxoxxo/catalog
cd catalog
npm install
```

### Run the app

```bash
npm run tauri dev
```

This starts the Vite dev server (with hot reload) and opens the Tauri window. The app will auto-reload as you edit the React frontend.

To restart the Rust backend, quit the app and run the command again.

---

## Before You Open a PR

Run these checks locally — they're exactly what CI runs, and all must pass to merge.

### Frontend build & tests

```bash
npm run build    # type-check and build the vite bundle
npm test         # vitest (logic tests, 88 total)
```

### Rust checks

From the `src-tauri/` directory:

```bash
cargo fmt --check     # check formatting (if this fails, run cargo fmt)
cargo clippy --all-targets -- -D warnings   # lint check (warnings = errors)
cargo test            # Rust unit tests
```

If you're using an IDE, enable `format on save` and `clippy on save` to catch issues as you code.

---

## Code Style

### Rust

- **Format** with `cargo fmt` — the entire repo is rustfmt-clean and CI enforces it.
- **Lint** with `cargo clippy --all-targets -- -D warnings` — all warnings must be eliminated.

### TypeScript / JavaScript

- **Match surrounding code** — there is no ESLint or Prettier config yet, so follow the patterns you see in neighboring files.
- **Use `.editorconfig`** — your editor should pick up the settings (2-space indent for JS/TS, 4-space for Rust, LF line endings).

---

## Project Layout

| Directory | Purpose |
| --- | --- |
| `src/` | React frontend: `components/`, `lib/`, and top-level pages. |
| `src/components/` | Reusable React components. |
| `src/lib/` | Utilities, hooks, and frontend logic. |
| `src-tauri/src/` | Rust backend. `scanners/` contains tool-discovery logic. |
| `src-tauri/src/main.rs` | Tauri app entrypoint. |
| `src-tauri/src/lib.rs` | Rust command handlers (marked with `#[tauri::command]`) and core logic. |
| `src-tauri/src/scanners/` | Tool-discovery modules for each source (brew, cargo, npm, etc.). |
| `site/` | Astro-based marketing website (separate `package.json` and build). |

---

## Commit & PR Workflow

### Commits

- Keep commits focused and logical — one feature or fix per commit if possible.
- Write clear commit messages that describe *why* the change matters, not just what it does.

### Before opening a PR

1. **Run all checks** (see "Before You Open a PR" above).
2. **Reference related issues** — if your PR fixes an issue, mention `Closes #123` in the PR description.
3. **Update `CHANGELOG.md`** — add an entry under `[Unreleased]` with a brief user-facing summary of your change (e.g., "Add support for X" or "Fix Y bug").
4. **Add tests** — if you've changed logic, add or update tests to cover the change. We use Vitest for frontend and `#[test]` for Rust.
5. **Fill out the PR template** — describe what you changed and why; mention any screenshots or videos if it's a UI change.

### Small pull requests are better

- Smaller, focused PRs are reviewed and merged faster.
- If your change is large, consider breaking it into several related PRs.

---

## Reporting Issues

### Bugs

Use the [bug report template](https://github.com/xooxoxxo/catalog/issues/new?template=bug_report.md) to file a bug. Include:

- Steps to reproduce
- Expected vs. actual behavior
- macOS version, app version, and relevant tool versions
- Relevant logs or screenshots

### Feature requests

Use the [feature request template](https://github.com/xooxoxxo/catalog/issues/new?template=feature_request.md). Describe the use case and why you think it's important.

### Security vulnerabilities

**Do not open a public GitHub issue.** See [SECURITY.md](./SECURITY.md) for responsible disclosure.

---

## Questions?

- Check the [README](./README.md) for a product overview.
- Open a discussion or ask in an issue if you're stuck — we're here to help.
- See [DESIGN.md](./DESIGN.md) for deeper architectural context.
