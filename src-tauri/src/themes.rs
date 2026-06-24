use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Fonts {
    pub ui: String,
    pub mono: String,
}

fn default_radius() -> f64 {
    10.0
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub base: String, // "light" | "dark"
    pub colors: BTreeMap<String, String>,
    pub fonts: Fonts,
    #[serde(default = "default_radius")]
    pub radius: f64,
}

fn themes_path() -> PathBuf {
    crate::config::config_base()
        .join("catalog")
        .join("themes.json")
}

pub fn load_from(path: &Path) -> Vec<Theme> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<Theme>>(&s).ok())
        .unwrap_or_default()
}

pub fn write_to(path: &Path, themes: &[Theme]) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(themes).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

/// Pure: upsert a theme by id (replace if id exists, else append).
pub fn upsert(mut themes: Vec<Theme>, t: Theme) -> Vec<Theme> {
    match themes.iter_mut().find(|x| x.id == t.id) {
        Some(slot) => *slot = t,
        None => themes.push(t),
    }
    themes
}

pub fn list() -> Vec<Theme> {
    load_from(&themes_path())
}
pub fn save(t: Theme) -> Result<(), String> {
    write_to(&themes_path(), &upsert(list(), t))
}
pub fn delete(id: &str) -> Result<(), String> {
    let kept: Vec<Theme> = list().into_iter().filter(|t| t.id != id).collect();
    write_to(&themes_path(), &kept)
}
pub fn export(path: &str, t: &Theme) -> Result<(), String> {
    let json = serde_json::to_string_pretty(t).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}
pub fn read_file(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn theme(id: &str) -> Theme {
        Theme {
            id: id.into(),
            name: id.into(),
            base: "dark".into(),
            colors: BTreeMap::new(),
            fonts: Fonts {
                ui: "u".into(),
                mono: "m".into(),
            },
            radius: 10.0,
        }
    }
    #[test]
    fn upsert_replaces_or_appends() {
        let v = upsert(vec![theme("a")], theme("b"));
        assert_eq!(v.len(), 2);
        let mut t = theme("a");
        t.name = "renamed".into();
        let v2 = upsert(v, t);
        assert_eq!(v2.len(), 2);
        assert_eq!(v2.iter().find(|x| x.id == "a").unwrap().name, "renamed");
    }
    #[test]
    fn write_read_roundtrip() {
        let p = std::env::temp_dir().join("catalog-themes-test.json");
        write_to(&p, &[theme("x")]).unwrap();
        assert_eq!(load_from(&p).len(), 1);
        let _ = std::fs::remove_file(&p);
    }
}
