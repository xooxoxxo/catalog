use crate::item::Item;
use serde::Deserialize;
use walkdir::WalkDir;

#[derive(Deserialize)]
struct InfoPlist {
    #[serde(rename = "CFBundleName")]
    name: Option<String>,
    #[serde(rename = "CFBundleDisplayName")]
    display_name: Option<String>,
    #[serde(rename = "CFBundleIdentifier")]
    bundle_id: Option<String>,
    #[serde(rename = "CFBundleShortVersionString")]
    short_version: Option<String>,
}

/// Pure: build an Item from an Info.plist JSON blob + the .app path + fallback name.
pub fn parse_app_plist_json(json: &str, app_path: &str, fallback_name: &str) -> Option<Item> {
    let p: InfoPlist = serde_json::from_str(json).ok()?;
    let bundle_id = p.bundle_id.clone();
    let name = p.display_name.or(p.name).unwrap_or_else(|| fallback_name.to_string());
    let id = match &bundle_id {
        Some(b) if !b.is_empty() => format!("app:{b}"),
        _ => format!("app:{app_path}"),
    };
    Some(Item {
        id,
        name,
        source: "app".into(),
        source_detail: bundle_id,
        version: p.short_version,
        exec_path: Some(app_path.to_string()),
        homepage: None,
        raw_desc: None,
        installed_on_request: None,
    })
}

fn read_app(app_path: &std::path::Path) -> Option<Item> {
    let plist = app_path.join("Contents/Info.plist");
    if !plist.exists() { return None; }
    let out = std::process::Command::new("plutil")
        .args(["-convert", "json", "-o", "-"])
        .arg(&plist)
        .output()
        .ok()?;
    if !out.status.success() { return None; }
    let json = String::from_utf8_lossy(&out.stdout);
    let fallback = app_path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    parse_app_plist_json(&json, &app_path.to_string_lossy(), &fallback)
}

pub fn scan() -> Result<Vec<Item>, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let roots = [String::from("/Applications"), format!("{home}/Applications")];
    let mut items = Vec::new();
    for root in roots.iter().filter(|r| std::path::Path::new(r).is_dir()) {
        // depth 1–2: top-level .app and one level of subfolders (e.g. /Applications/Utilities)
        for entry in WalkDir::new(root).min_depth(1).max_depth(2).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("app") {
                if let Some(it) = read_app(path) {
                    items.push(it);
                }
            }
        }
    }
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_minimal_plist_json() {
        let json = r#"{"CFBundleName":"Ghostty","CFBundleIdentifier":"com.mitchellh.ghostty","CFBundleShortVersionString":"1.3.1"}"#;
        let it = parse_app_plist_json(json, "/Applications/Ghostty.app", "Ghostty").unwrap();
        assert_eq!(it.id, "app:com.mitchellh.ghostty");
        assert_eq!(it.source, "app");
        assert_eq!(it.version.as_deref(), Some("1.3.1"));
        assert_eq!(it.exec_path.as_deref(), Some("/Applications/Ghostty.app"));
    }
    #[test]
    fn falls_back_to_path_id_without_bundle_id() {
        let it = parse_app_plist_json(r#"{"CFBundleName":"Foo"}"#, "/Applications/Foo.app", "Foo").unwrap();
        assert_eq!(it.id, "app:/Applications/Foo.app");
        assert_eq!(it.name, "Foo");
    }
    #[test]
    fn parses_real_fixture() {
        let json = include_str!("../../tests/fixtures/app-info.json");
        assert!(parse_app_plist_json(json, "/Applications/Sample.app", "Sample").is_some());
    }
}
