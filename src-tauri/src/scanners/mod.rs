pub mod brew;
pub mod go;
pub mod apps;
pub mod mas;
pub mod langmgr;
pub mod orphan;

use crate::item::Item;
use std::collections::HashSet;

/// Augmented PATH for child processes. GUI apps on macOS inherit a minimal PATH
/// (/usr/bin:/bin:/usr/sbin:/sbin) — NOT the user's shell PATH — so bare-name
/// `Command::new("npm"|"go"|"cargo"|…)` lookups fail and scanners silently return [].
/// Prepend the common dev bin dirs (incl. every installed nvm node) so they resolve.
pub fn dev_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut dirs: Vec<String> = vec![
        "/opt/homebrew/bin".into(), "/opt/homebrew/sbin".into(),
        "/usr/local/bin".into(), "/usr/local/sbin".into(),
        format!("{home}/.cargo/bin"),
        format!("{home}/go/bin"),
        format!("{home}/.local/bin"),
        format!("{home}/.bun/bin"),
    ];
    // nvm: npm/node live under a version-specific bin — add all installed versions.
    if let Ok(rd) = std::fs::read_dir(format!("{home}/.nvm/versions/node")) {
        for e in rd.filter_map(|e| e.ok()) {
            dirs.push(e.path().join("bin").to_string_lossy().into_owned());
        }
    }
    match std::env::var("PATH") {
        Ok(existing) if !existing.is_empty() => dirs.push(existing),
        _ => dirs.extend(["/usr/bin".into(), "/bin".into(), "/usr/sbin".into(), "/sbin".into()]),
    }
    dirs.join(":")
}

/// Keep the first occurrence of each id (manager scanners run before orphans).
pub fn dedup_by_id(items: &mut Vec<Item>) {
    let mut seen = HashSet::new();
    items.retain(|it| seen.insert(it.id.clone()));
}

/// Canonicalized exec paths already claimed by manager scanners.
pub fn claimed_paths(items: &[Item]) -> HashSet<String> {
    items
        .iter()
        .filter_map(|it| it.exec_path.as_ref())
        .filter_map(|p| std::fs::canonicalize(p).ok())
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

/// App Store apps surface twice — as `app` (filesystem .app) and `mas` (mas list).
/// Merge into one record: keep the mas entry (its numeric id powers update checks +
/// Brewfile `mas` lines), adopt the matching .app's exec_path (so Open/Reveal/size
/// work), relabel it `app` for display, and drop the duplicate `app` entry. mas
/// entries with no matching .app are still relabeled `app` (just pathless).
pub fn merge_mas_with_apps(items: &mut Vec<Item>) {
    use std::collections::HashMap;
    let app_by_name: HashMap<String, String> = items.iter()
        .filter(|i| i.source == "app")
        .filter_map(|i| i.exec_path.clone().map(|p| (i.name.to_lowercase(), p)))
        .collect();

    let mut adopted: HashSet<String> = HashSet::new();
    for it in items.iter_mut() {
        if it.source == "mas" {
            if it.exec_path.is_none() {
                if let Some(p) = app_by_name.get(&it.name.to_lowercase()) {
                    it.exec_path = Some(p.clone());
                    adopted.insert(p.clone());
                }
            }
            it.source = "app".to_string();
        }
    }
    // drop the filesystem `app` entries a mas record adopted (keep the mas-id one)
    items.retain(|i| !(i.id.starts_with("app:") && i.exec_path.as_ref().is_some_and(|p| adopted.contains(p))));
}

/// Fan out across every source. A source that errors or is absent contributes [].
pub fn scan_all() -> Vec<Item> {
    let mut items = Vec::new();
    items.extend(brew::scan().unwrap_or_default());
    items.extend(go::scan().unwrap_or_default());
    items.extend(apps::scan().unwrap_or_default());
    items.extend(mas::scan().unwrap_or_default());
    items.extend(langmgr::scan().unwrap_or_default());
    merge_mas_with_apps(&mut items);
    dedup_by_id(&mut items);
    let claimed = claimed_paths(&items);
    items.extend(orphan::scan(&claimed));
    dedup_by_id(&mut items);
    items
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::Item;

    fn item(id: &str) -> Item {
        Item { id: id.into(), name: id.into(), source: "x".into(), source_detail: None,
            version: None, exec_path: None, homepage: None, raw_desc: None, installed_on_request: None }
    }

    #[test]
    fn dedup_keeps_first_occurrence() {
        let mut v = vec![item("brew:a"), item("brew:a"), item("go:b")];
        dedup_by_id(&mut v);
        assert_eq!(v.len(), 2);
        assert_eq!(v[0].id, "brew:a");
    }

    fn full(id: &str, name: &str, source: &str, exec: Option<&str>) -> Item {
        Item { id: id.into(), name: name.into(), source: source.into(), source_detail: None,
            version: None, exec_path: exec.map(String::from), homepage: None, raw_desc: None, installed_on_request: None }
    }

    #[test]
    fn merge_mas_dedups_app_store_apps_keeping_mas_id() {
        let mut v = vec![
            full("app:com.apple.dt.Xcode", "Xcode", "app", Some("/Applications/Xcode.app")),
            full("mas:497799835", "Xcode", "mas", None),
            full("mas:1569813296", "1Password for Safari", "mas", None), // no matching .app
            full("app:org.mozilla.firefox", "Firefox", "app", Some("/Applications/Firefox.app")),
        ];
        merge_mas_with_apps(&mut v);

        // Xcode: the app dup is dropped; the mas-id record survives, adopts the path, shows as app
        let xcode: Vec<_> = v.iter().filter(|i| i.name == "Xcode").collect();
        assert_eq!(xcode.len(), 1);
        assert_eq!(xcode[0].id, "mas:497799835");
        assert_eq!(xcode[0].source, "app");
        assert_eq!(xcode[0].exec_path.as_deref(), Some("/Applications/Xcode.app"));

        // unmatched mas → relabeled app, pathless
        let onep = v.iter().find(|i| i.name == "1Password for Safari").unwrap();
        assert_eq!(onep.source, "app");
        assert!(onep.exec_path.is_none());

        // plain app untouched
        let ff = v.iter().find(|i| i.name == "Firefox").unwrap();
        assert_eq!(ff.id, "app:org.mozilla.firefox");

        assert_eq!(v.len(), 3);
        assert!(!v.iter().any(|i| i.source == "mas"), "no mas source should remain");
    }

    #[test]
    fn scan_all_returns_multiple_sources_with_unique_ids() {
        let items = scan_all();
        // On this dev machine brew alone yields >50; assert a healthy inventory + uniqueness.
        assert!(items.len() > 50, "expected a populated inventory, got {}", items.len());
        let mut ids = std::collections::HashSet::new();
        for it in &items {
            assert!(ids.insert(it.id.clone()), "duplicate id: {}", it.id);
        }
        let sources: std::collections::HashSet<_> = items.iter().map(|i| i.source.as_str()).collect();
        assert!(sources.contains("brew"), "brew source missing");
    }
}
