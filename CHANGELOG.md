# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Multi-source dev-tool scanning across Homebrew, Cargo, npm, pipx, uv, Go, Bun, and mas with automatic version tracking
- Fuzzy search and virtualized list UI for fast navigation through installed tools
- AI enrichment via pluggable provider CLIs (local-first architecture with user-configured external providers)
- Security audits including CVE detection (Homebrew NVD pass integration) and dependency analysis
- Update checker to surface available tool upgrades
- Disk usage audit to identify storage consumption per tool
- Doctor command for system diagnostics: broken symlinks, PATH shadowing, and other installation anomalies
- GitHub device-flow OAuth login with starred repositories and README browsing capabilities
- Light and dark theme support with a custom theme editor
- Import/export of custom themes via .ctlgtheme files
- Command palette for keyboard-driven tool discovery and actions
- Native macOS notifications for audit alerts and important updates
- React 19 frontend with TypeScript and Vite build tooling
- Tauri 2 desktop application framework for secure native integration
- Cross-platform Rust backend with async task execution

### Changed

- Upgraded the toolchain to current majors: TypeScript 6, Vite 8, @vitejs/plugin-react 6, Astro 7 (site), rusqlite 0.40, toml 1.1, and refreshed GitHub Actions (checkout v7, setup-node v6, deploy-pages v5, withastro/action v6)

### Fixed

- CI: root test runner no longer pulls in the site's tests (which need the site's own dependencies); the site now has its own CI job for tests and build
- Landing page no longer flashes hero content in and out on a cold (uncached) first load
