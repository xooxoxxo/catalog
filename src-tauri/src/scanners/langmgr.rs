use crate::item::Item;
use serde::Deserialize;
use std::process::Command;

fn mk(source: &str, name: &str, version: Option<String>) -> Item {
    Item { id: format!("{source}:{name}"), name: name.to_string(), source: source.to_string(),
        source_detail: None, version, exec_path: None, homepage: None, raw_desc: None, installed_on_request: None }
}

// ---- npm: `npm ls -g --json` -> { dependencies: { name: { version } } } ----
#[derive(Deserialize)]
struct NpmRoot { #[serde(default)] dependencies: std::collections::HashMap<String, NpmDep> }
#[derive(Deserialize)]
struct NpmDep { version: Option<String> }
pub fn parse_npm_global(json: &str) -> Vec<Item> {
    serde_json::from_str::<NpmRoot>(json).map(|r|
        r.dependencies.into_iter().map(|(n, d)| mk("npm", &n, d.version)).collect()
    ).unwrap_or_default()
}

// ---- cargo: `cargo install --list` -> "name vX.Y.Z:\n    bin" ----
pub fn parse_cargo_install(stdout: &str) -> Vec<Item> {
    stdout.lines().filter(|l| !l.starts_with(' ') && l.contains(" v")).filter_map(|l| {
        let l = l.trim_end_matches(':');
        let (name, ver) = l.split_once(" v")?;
        Some(mk("cargo", name.trim(), Some(ver.trim().to_string())))
    }).collect()
}

// ---- uv: `uv tool list` -> "name vX.Y.Z" ----
pub fn parse_uv_tool(stdout: &str) -> Vec<Item> {
    stdout.lines().filter_map(|l| {
        let l = l.trim();
        if l.is_empty() || l.starts_with('-') { return None; }
        let (name, ver) = l.split_once(" v")?;
        Some(mk("uv", name.trim(), Some(ver.trim().to_string())))
    }).collect()
}

// ---- pipx: `pipx list --json` -> { venvs: { name: { metadata: { main_package: { package, package_version }}}}} ----
#[derive(Deserialize)]
struct PipxRoot { #[serde(default)] venvs: std::collections::HashMap<String, PipxVenv> }
#[derive(Deserialize)]
struct PipxVenv { metadata: PipxMeta }
#[derive(Deserialize)]
struct PipxMeta { main_package: PipxPkg }
#[derive(Deserialize)]
struct PipxPkg { package: String, package_version: Option<String> }
pub fn parse_pipx_list(json: &str) -> Vec<Item> {
    serde_json::from_str::<PipxRoot>(json).map(|r|
        r.venvs.into_values().map(|v| mk("pipx", &v.metadata.main_package.package, v.metadata.main_package.package_version)).collect()
    ).unwrap_or_default()
}

// ---- bun: globally-linked packages live as dirs under ~/.bun/install/global/node_modules ----
pub fn parse_bun_globals(names: &[String]) -> Vec<Item> {
    names.iter().filter(|n| !n.is_empty() && !n.starts_with('.')).map(|n| mk("bun", n, None)).collect()
}

fn run(cmd: &str, args: &[&str]) -> Option<String> {
    // env PATH augmented so bare `npm`/`cargo`/`uv`/`pipx` resolve under the GUI PATH.
    let out = Command::new(cmd).args(args).env("PATH", super::dev_path()).output().ok()?;
    if out.status.success() { Some(String::from_utf8_lossy(&out.stdout).into_owned()) } else { None }
}

/// Aggregate every language manager that is present. Absent tool → contributes nothing.
pub fn scan() -> Result<Vec<Item>, String> {
    let mut items = Vec::new();
    if let Some(o) = run("npm", &["ls", "-g", "--json"]) { items.extend(parse_npm_global(&o)); }
    if let Some(o) = run("cargo", &["install", "--list"]) { items.extend(parse_cargo_install(&o)); }
    if let Some(o) = run("uv", &["tool", "list"]) { items.extend(parse_uv_tool(&o)); }
    if let Some(o) = run("pipx", &["list", "--json"]) { items.extend(parse_pipx_list(&o)); }
    if let Ok(home) = std::env::var("HOME") {
        let dir = format!("{home}/.bun/install/global/node_modules");
        if let Ok(rd) = std::fs::read_dir(&dir) {
            let names: Vec<String> = rd.filter_map(|e| e.ok())
                .map(|e| e.file_name().to_string_lossy().into_owned()).collect();
            items.extend(parse_bun_globals(&names));
        }
    }
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn npm_parses() {
        let v = parse_npm_global(include_str!("../../tests/fixtures/npm-global.json"));
        assert!(v.iter().any(|i| i.id == "npm:typescript" && i.version.as_deref() == Some("5.4.5")));
    }
    #[test]
    fn cargo_parses() {
        let v = parse_cargo_install(include_str!("../../tests/fixtures/cargo-install.txt"));
        assert!(v.iter().any(|i| i.id == "cargo:ripgrep" && i.version.as_deref() == Some("14.1.0")));
        assert_eq!(v.len(), 2); // only the "name vX:" lines, not the indented bin lines
    }
    #[test]
    fn uv_parses() {
        let v = parse_uv_tool(include_str!("../../tests/fixtures/uv-tool.txt"));
        assert!(v.iter().any(|i| i.id == "uv:ruff"));
    }
    #[test]
    fn pipx_parses() {
        let v = parse_pipx_list(include_str!("../../tests/fixtures/pipx-list.json"));
        assert!(v.iter().any(|i| i.id == "pipx:poetry" && i.version.as_deref() == Some("1.8.0")));
    }
    #[test]
    fn bun_parses_and_skips_dotdirs() {
        let v = parse_bun_globals(&[".cache".into(), "cowsay".into()]);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].id, "bun:cowsay");
    }
}

