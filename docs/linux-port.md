# Roadmap: cross-platform (Linux / Windows) support

**Status:** deferred — future build. catalog is currently macOS-only by design.

## Why it's not a CI tweak

The app has **zero `cfg(target_os)` guards** and leans on macOS throughout:

- **Windows — won't compile.** `std::os::unix::fs::PermissionsExt` is used in
  `src-tauri/src/export.rs`, `doctor.rs`, `scanners/orphan.rs`, `commands/system.rs`.
- **Linux — compiles, but core features are dead at runtime:** Mac App Store
  (`mas`), `/Applications` scan, `reveal_in_finder`, `open -a Terminal`, and the
  macOS Keychain (`security`) for the GitHub token.

So bundling other OSes today ships broken artifacts. This is a porting project.

## Scope of work

1. **Gate macOS integrations** behind `#[cfg(target_os = "macos")]` and give each a
   cross-platform trait/dispatch with per-OS impls. Affected areas:

   | Concern | macOS now | Linux equivalent | Windows equivalent |
   |---|---|---|---|
   | App inventory | `mas` + `/Applications` (`scanners/mas.rs`, `apps.rs`) | flatpak / snap / `.desktop` files | Start-menu / registry uninstall keys |
   | Reveal file | `reveal_in_finder` (Finder) | `xdg-open` on parent dir | `explorer /select,` |
   | Run script | `open -a Terminal` (`commands/system.rs`) | `x-terminal-emulator` / `$TERMINAL` | `cmd /c start` |
   | Secret store | macOS Keychain via `security` (`gh.rs`) | libsecret (`secret-tool`) / `keyring` crate | Credential Manager / `keyring` crate |
   | File perms | `std::os::unix` | unix (ok) | `#[cfg(windows)]` branch or skip |
   | Package managers | brew/cargo/npm/pipx/uv/go/bun | apt/dnf/pacman + the cross-platform ones | scoop/winget + cross-platform |

2. **Replace `std::os::unix` usage** with `cfg`-gated branches (or the `keyring`
   crate to drop the hand-rolled Keychain shell-out entirely).

3. **Wire the release matrix** (reference — do NOT enable until step 1+2 land):

   ```yaml
   strategy:
     fail-fast: false
     matrix:
       include:
         - platform: macos-latest
           args: --target universal-apple-darwin
         - platform: ubuntu-22.04
           args: ""
         - platform: windows-latest
           args: ""
   runs-on: ${{ matrix.platform }}
   steps:
     - uses: actions/checkout@v4
     - uses: actions/setup-node@v4
       with: { node-version: 22, cache: npm }
     - if: matrix.platform == 'ubuntu-22.04'   # Tauri v2 Linux deps
       run: sudo apt-get update && sudo apt-get install -y
         libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
     - uses: dtolnay/rust-toolchain@stable
     - uses: swatinem/rust-cache@v2
       with: { workspaces: src-tauri }
     - run: npm ci
     - uses: tauri-apps/tauri-action@v0
       env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
       with:
         tagName: ${{ github.ref_name }}
         args: ${{ matrix.args }}
   ```

   Bundles produced: macOS `.dmg`/`.app` (universal), Linux `.AppImage` + `.deb`
   (+ `.rpm` if added), Windows `.msi`/`.exe` (NSIS).

## Acceptance criteria

- `cargo clippy --all-targets -- -D warnings` and `cargo test` green on all three OSes.
- Each OS scans its native package managers and the cross-platform ones (cargo/npm/etc.).
- Reveal / run-script / secret-store work per-OS (or are cleanly hidden where N/A).
- Release matrix produces installable artifacts for all three.

## Out of scope / decisions to make first

- Is Linux/Windows actually a product goal, or is catalog intentionally macOS-only?
  (The Mac App Store + Homebrew + Finder framing is core to the current value prop.)
- Prefer the `keyring` crate over per-OS secret CLIs to shrink the matrix.
