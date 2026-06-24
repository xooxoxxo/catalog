use crate::item::Item;
use serde::Deserialize;
use std::process::Command;

#[derive(Deserialize)]
struct BrewRoot {
    formulae: Vec<Formula>,
    casks: Vec<Cask>,
}
#[derive(Deserialize)]
struct Formula {
    name: String,
    desc: Option<String>,
    homepage: Option<String>,
    installed: Vec<InstalledVersion>,
}
#[derive(Deserialize)]
struct InstalledVersion {
    version: String,
    installed_on_request: Option<bool>,
}
#[derive(Deserialize)]
struct Cask {
    token: String,
    name: Vec<String>,
    desc: Option<String>,
    homepage: Option<String>,
    version: Option<String>,
}

/// Resolve an absolute brew path (GUI apps lack shell PATH).
fn brew_bin() -> &'static str {
    if std::path::Path::new("/opt/homebrew/bin/brew").exists() {
        "/opt/homebrew/bin/brew"
    } else {
        "/usr/local/bin/brew"
    }
}

/// Runner: execute brew and parse. Returns Err if brew exists but failed;
/// returns Ok(vec![]) handling is left to scan_all (which treats Err as empty).
pub fn scan() -> Result<Vec<Item>, String> {
    let out = Command::new(brew_bin())
        .args(["info", "--json=v2", "--installed"])
        .output()
        .map_err(|e| format!("failed to run brew: {e}"))?;
    if !out.status.success() {
        return Err(format!("brew exited {}", out.status));
    }
    let json = String::from_utf8_lossy(&out.stdout);
    parse_brew_json(&json).map_err(|e| format!("parse error: {e}"))
}

pub fn parse_brew_json(json: &str) -> Result<Vec<Item>, serde_json::Error> {
    let root: BrewRoot = serde_json::from_str(json)?;
    let mut items = Vec::new();
    for f in root.formulae {
        let inst = f.installed.first();
        items.push(Item {
            id: format!("brew:{}", f.name),
            name: f.name,
            source: "brew".into(),
            source_detail: None,
            version: inst.map(|i| i.version.clone()),
            exec_path: None,
            homepage: f.homepage,
            raw_desc: f.desc,
            installed_on_request: inst.and_then(|i| i.installed_on_request),
        });
    }
    for c in root.casks {
        items.push(Item {
            id: format!("cask:{}", c.token),
            name: c.name.into_iter().next().unwrap_or(c.token.clone()),
            source: "cask".into(),
            source_detail: None,
            version: c.version,
            exec_path: None,
            homepage: c.homepage,
            raw_desc: c.desc,
            installed_on_request: None,
        });
    }
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_formula_and_cask() {
        let json = r#"{
          "formulae":[{"name":"eza","desc":"modern ls","homepage":"https://eza.rocks",
            "installed":[{"version":"0.23.4","installed_on_request":true}]}],
          "casks":[{"token":"ghostty","name":["Ghostty"],"desc":"terminal",
            "homepage":"https://ghostty.org","version":"1.3.1"}]
        }"#;
        let items = parse_brew_json(json).unwrap();
        assert_eq!(items.len(), 2);
        let eza = &items[0];
        assert_eq!(eza.id, "brew:eza");
        assert_eq!(eza.version.as_deref(), Some("0.23.4"));
        assert_eq!(eza.installed_on_request, Some(true));
        let ghostty = &items[1];
        assert_eq!(ghostty.id, "cask:ghostty");
        assert_eq!(ghostty.name, "Ghostty");
    }

    #[test]
    fn parses_real_fixture_without_error() {
        let json = include_str!("../../tests/fixtures/brew.json");
        let items = parse_brew_json(json).unwrap();
        assert!(items.len() > 50, "expected many items, got {}", items.len());
    }
}

