use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Provider {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub stdin: bool,
    #[serde(default)]
    pub requires_online: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub active: String,
    pub providers: BTreeMap<String, Provider>,
    #[serde(default)]
    pub github_client_id: String,
    #[serde(default)]
    pub active_theme: String,
    #[serde(default)]
    pub nvd_api_key: String,
}

pub fn defaults() -> Config {
    let mut p = BTreeMap::new();
    p.insert("claude".into(), Provider { command: "claude".into(), args: vec!["-p".into(), "{prompt}".into()], stdin: false, requires_online: true });
    p.insert("codex".into(), Provider { command: "codex".into(), args: vec!["exec".into(), "{prompt}".into()], stdin: false, requires_online: true });
    p.insert("ollama".into(), Provider { command: "ollama".into(), args: vec!["run".into(), "llama3.2".into()], stdin: true, requires_online: false });
    p.insert("custom".into(), Provider { command: String::new(), args: vec![], stdin: false, requires_online: false });
    Config { active: "claude".into(), providers: p, github_client_id: String::new(), active_theme: String::new(), nvd_api_key: String::new() }
}

pub fn config_base() -> PathBuf {
    std::env::var("XDG_CONFIG_HOME").map(PathBuf::from).unwrap_or_else(|_| {
        PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".config")
    })
}

pub fn config_path() -> PathBuf {
    config_base().join("catalog").join("config.toml")
}

/// One-time rebrand migration: if the pre-rename `~/.config/tooldex` dir exists
/// and `~/.config/catalog` doesn't yet, move it so settings + enrichments carry over.
pub fn migrate_legacy_dir() {
    let base = config_base();
    let (old, new) = (base.join("tooldex"), base.join("catalog"));
    if old.exists() && !new.exists() {
        let _ = std::fs::rename(&old, &new);
    }
}

/// Load config, seeding any missing built-in preset and a blank active.
pub fn load_from(path: &Path) -> Config {
    let mut cfg = std::fs::read_to_string(path).ok()
        .and_then(|s| toml::from_str::<Config>(&s).ok())
        .unwrap_or_else(defaults);
    for (k, v) in defaults().providers {
        cfg.providers.entry(k).or_insert(v);
    }
    if cfg.active.trim().is_empty() || !cfg.providers.contains_key(&cfg.active) {
        cfg.active = "claude".into();
    }
    cfg
}

pub fn save_to(path: &Path, cfg: &Config) -> Result<(), String> {
    if let Some(dir) = path.parent() { std::fs::create_dir_all(dir).map_err(|e| e.to_string())?; }
    let toml = toml::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(path, toml).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_file_yields_defaults() {
        let p = std::env::temp_dir().join("tooldex-cfg-missing.toml");
        let _ = std::fs::remove_file(&p);
        let c = load_from(&p);
        assert_eq!(c.active, "claude");
        assert_eq!(c.providers.len(), 4);
        assert!(c.providers["ollama"].stdin);
        assert!(c.providers["claude"].requires_online);
    }
    #[test]
    fn roundtrip_and_seed_missing_presets() {
        let p = std::env::temp_dir().join("tooldex-cfg-rt.toml");
        let mut c = defaults();
        c.active = "ollama".into();
        c.providers.remove("codex"); // simulate a config without codex
        save_to(&p, &c).unwrap();
        let loaded = load_from(&p);
        assert_eq!(loaded.active, "ollama");        // preserved
        assert!(loaded.providers.contains_key("codex")); // re-seeded
        std::fs::remove_file(&p).ok();
    }
    #[test]
    fn invalid_active_falls_back_to_claude() {
        let p = std::env::temp_dir().join("tooldex-cfg-bad-active.toml");
        let mut c = defaults();
        c.active = "nope".into();
        save_to(&p, &c).unwrap();
        assert_eq!(load_from(&p).active, "claude");
        std::fs::remove_file(&p).ok();
    }
}
