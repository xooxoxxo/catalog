use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Update {
    pub id: String,
    pub current: String,
    pub latest: String,
}

// ---- brew outdated --json=v2 ----
#[derive(Deserialize)]
struct BrewOutdated {
    #[serde(default)]
    formulae: Vec<BrewOut>,
    #[serde(default)]
    casks: Vec<BrewOut>,
}
#[derive(Deserialize)]
struct BrewOut {
    name: String,
    #[serde(default)]
    installed_versions: Vec<String>,
    current_version: String,
}

pub fn parse_brew_outdated(json: &str) -> Vec<Update> {
    let root: BrewOutdated = match serde_json::from_str(json) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let mut v = Vec::new();
    for f in root.formulae {
        v.push(Update {
            id: format!("brew:{}", f.name),
            current: f.installed_versions.first().cloned().unwrap_or_default(),
            latest: f.current_version,
        });
    }
    for c in root.casks {
        v.push(Update {
            id: format!("cask:{}", c.name),
            current: c.installed_versions.first().cloned().unwrap_or_default(),
            latest: c.current_version,
        });
    }
    v
}

// ---- npm outdated -g --json ----
#[derive(Deserialize)]
struct NpmOut {
    #[serde(default)]
    current: String,
    latest: String,
}
pub fn parse_npm_outdated(json: &str) -> Vec<Update> {
    let map: HashMap<String, NpmOut> = match serde_json::from_str(json) {
        Ok(m) => m,
        Err(_) => return vec![],
    };
    let mut v: Vec<Update> = map
        .into_iter()
        .map(|(name, o)| Update {
            id: format!("npm:{name}"),
            current: o.current,
            latest: o.latest,
        })
        .collect();
    v.sort_by(|a, b| a.id.cmp(&b.id)); // deterministic
    v
}

// ---- mas outdated: "<id> <name> (<old> -> <new>)" ----
pub fn parse_mas_outdated(stdout: &str) -> Vec<Update> {
    stdout
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let (id, rest) = line.split_once(char::is_whitespace)?;
            let inside = rest.rsplit_once('(')?.1.trim_end_matches(')');
            let (cur, lat) = inside.split_once("->")?;
            Some(Update {
                id: format!("mas:{id}"),
                current: cur.trim().to_string(),
                latest: lat.trim().to_string(),
            })
        })
        .collect()
}

fn run(cmd: &str, args: &[&str]) -> Option<String> {
    // resolve brew at its known prefix; others on PATH
    let bin = if cmd == "brew" {
        if std::path::Path::new("/opt/homebrew/bin/brew").exists() {
            "/opt/homebrew/bin/brew".to_string()
        } else {
            "/usr/local/bin/brew".to_string()
        }
    } else {
        cmd.to_string()
    };
    // GUI apps inherit a minimal PATH → bare `npm`/`mas` lookups fail. Inject dev PATH.
    let out = Command::new(bin)
        .args(args)
        .env("PATH", crate::scanners::dev_path())
        .output()
        .ok()?;
    // brew/npm `outdated` exit non-zero when there ARE outdated items, but still print JSON → take stdout regardless
    Some(String::from_utf8_lossy(&out.stdout).into_owned())
}

pub fn check_brew() -> Vec<Update> {
    run("brew", &["outdated", "--json=v2"])
        .map(|o| parse_brew_outdated(&o))
        .unwrap_or_default()
}

pub fn check_npm() -> Vec<Update> {
    run("npm", &["outdated", "-g", "--json"])
        .map(|o| parse_npm_outdated(&o))
        .unwrap_or_default()
}

pub fn check_mas() -> Vec<Update> {
    run("mas", &["outdated"])
        .map(|o| parse_mas_outdated(&o))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn brew_parses_formulae_and_casks() {
        let v = parse_brew_outdated(include_str!("../tests/fixtures/brew-outdated.json"));
        assert!(v
            .iter()
            .any(|u| u.id == "brew:eza" && u.current == "0.23.0" && u.latest == "0.23.4"));
        assert!(v
            .iter()
            .any(|u| u.id == "cask:ghostty" && u.latest == "1.3.1"));
    }
    #[test]
    fn npm_parses() {
        let v = parse_npm_outdated(include_str!("../tests/fixtures/npm-outdated.json"));
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].id, "npm:typescript");
        assert_eq!(v[0].latest, "5.4.5");
    }
    #[test]
    fn mas_parses_old_to_new() {
        let v = parse_mas_outdated(include_str!("../tests/fixtures/mas-outdated.txt"));
        assert!(v
            .iter()
            .any(|u| u.id == "mas:497799835" && u.current == "15.3" && u.latest == "15.4"));
        assert_eq!(v.len(), 2);
    }
    #[test]
    fn bad_json_is_empty() {
        assert!(parse_brew_outdated("not json").is_empty());
        assert!(parse_npm_outdated("not json").is_empty());
    }
}
