use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

/// User-set enrichment for one item. Every field defaults so partial TOML loads.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Enrichment {
    #[serde(default)]
    pub alias: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub hidden: bool,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub llm_confirmed: bool,
}

/// Detected item + merged enrichment, sent to the frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EnrichedItem {
    // detected (from Item)
    pub id: String,
    pub name: String,
    pub source: String,
    pub source_detail: Option<String>,
    pub version: Option<String>,
    pub exec_path: Option<String>,
    pub homepage: Option<String>,
    pub raw_desc: Option<String>,
    pub installed_on_request: Option<bool>,
    // merged
    pub display_name: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub hidden: bool,
    pub notes: String,
    pub llm_confirmed: bool,
    pub has_enrichment: bool,
}

/// On-disk shape: TOML `[items."<id>"]` tables. BTreeMap → stable, diffable ordering.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct EnrichmentStore {
    #[serde(default)]
    pub items: BTreeMap<String, Enrichment>,
}

impl EnrichmentStore {
    pub fn get(&self, id: &str) -> Option<&Enrichment> {
        self.items.get(id)
    }
    /// Upsert. Removing a fully-default enrichment keeps the file tidy.
    pub fn set(&mut self, id: String, enr: Enrichment) {
        if enr == Enrichment::default() {
            self.items.remove(&id);
        } else {
            self.items.insert(id, enr);
        }
    }
}

/// `~/.config/catalog/enrichment.toml` (honors XDG_CONFIG_HOME).
pub fn store_path() -> PathBuf {
    crate::config::config_base()
        .join("catalog")
        .join("enrichment.toml")
}

pub fn load_from(path: &std::path::Path) -> EnrichmentStore {
    match std::fs::read_to_string(path) {
        Ok(s) => toml::from_str(&s).unwrap_or_default(),
        Err(_) => EnrichmentStore::default(), // absent/unreadable → empty
    }
}

pub fn save_to(path: &std::path::Path, store: &EnrichmentStore) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let toml = toml::to_string_pretty(store).map_err(|e| e.to_string())?;
    std::fs::write(path, toml).map_err(|e| e.to_string())
}

/// Pure: overlay enrichment onto a detected item.
pub fn merge(item: &crate::item::Item, enr: Option<&Enrichment>) -> EnrichedItem {
    let e = enr.cloned().unwrap_or_default();
    let display_name = if e.alias.trim().is_empty() {
        item.name.clone()
    } else {
        e.alias.clone()
    };
    let description = if e.description.trim().is_empty() {
        item.raw_desc.clone()
    } else {
        Some(e.description.clone())
    };
    EnrichedItem {
        id: item.id.clone(),
        name: item.name.clone(),
        source: item.source.clone(),
        source_detail: item.source_detail.clone(),
        version: item.version.clone(),
        exec_path: item.exec_path.clone(),
        homepage: item.homepage.clone(),
        raw_desc: item.raw_desc.clone(),
        installed_on_request: item.installed_on_request,
        display_name,
        description,
        tags: e.tags.clone(),
        favorite: e.favorite,
        hidden: e.hidden,
        notes: e.notes.clone(),
        llm_confirmed: e.llm_confirmed,
        has_enrichment: enr.is_some(),
    }
}

#[cfg(test)]
mod store_tests {
    use super::*;

    #[test]
    fn load_missing_file_is_empty() {
        let p = std::env::temp_dir().join("tooldex-test-missing-xyz.toml");
        let _ = std::fs::remove_file(&p);
        assert_eq!(load_from(&p).items.len(), 0);
    }

    #[test]
    fn save_then_load_roundtrips() {
        let p = std::env::temp_dir().join("tooldex-test-roundtrip.toml");
        let mut s = EnrichmentStore::default();
        s.set(
            "brew:eza".into(),
            Enrichment {
                favorite: true,
                tags: vec!["cli".into()],
                ..Default::default()
            },
        );
        save_to(&p, &s).unwrap();
        let loaded = load_from(&p);
        assert!(loaded.get("brew:eza").unwrap().favorite);
        assert_eq!(
            loaded.get("brew:eza").unwrap().tags,
            vec!["cli".to_string()]
        );
        std::fs::remove_file(&p).ok();
    }

    #[test]
    fn set_default_removes_entry() {
        let mut s = EnrichmentStore::default();
        s.set(
            "x".into(),
            Enrichment {
                favorite: true,
                ..Default::default()
            },
        );
        assert!(s.get("x").is_some());
        s.set("x".into(), Enrichment::default());
        assert!(s.get("x").is_none());
    }
}

#[cfg(test)]
mod merge_tests {
    use super::*;
    use crate::item::Item;

    fn item() -> Item {
        Item {
            id: "brew:eza".into(),
            name: "eza".into(),
            source: "brew".into(),
            source_detail: None,
            version: None,
            exec_path: None,
            homepage: None,
            raw_desc: Some("modern ls".into()),
            installed_on_request: None,
        }
    }

    #[test]
    fn no_enrichment_uses_detected() {
        let m = merge(&item(), None);
        assert_eq!(m.display_name, "eza");
        assert_eq!(m.description.as_deref(), Some("modern ls"));
        assert!(!m.favorite);
        assert!(!m.has_enrichment);
    }

    #[test]
    fn alias_overrides_name_and_desc_overrides_raw() {
        let e = Enrichment {
            alias: "eza (ls)".into(),
            description: "my note".into(),
            favorite: true,
            hidden: true,
            ..Default::default()
        };
        let m = merge(&item(), Some(&e));
        assert_eq!(m.display_name, "eza (ls)");
        assert_eq!(m.description.as_deref(), Some("my note"));
        assert!(m.favorite && m.hidden && m.has_enrichment);
    }

    #[test]
    fn blank_alias_falls_back_to_name() {
        let e = Enrichment {
            alias: "   ".into(),
            ..Default::default()
        };
        assert_eq!(merge(&item(), Some(&e)).display_name, "eza");
    }
}
