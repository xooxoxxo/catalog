use crate::item::Item;
use std::collections::HashSet;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

/// macOS system dirs whose contents are not interesting "orphans".
const SYSTEM_DIRS: &[&str] = &[
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
    "/usr/libexec",
    "/System",
];

fn is_system(path: &str) -> bool {
    SYSTEM_DIRS.iter().any(|d| path.starts_with(d))
}

/// Build the list of known package manager internal directories.
/// These directories house managed binaries and should not be flagged as orphans.
fn manager_prefixes() -> Vec<String> {
    let mut prefixes = vec![
        "/opt/homebrew".to_string(),
        "/usr/local/Homebrew".to_string(),
        "/usr/local/Cellar".to_string(),
        "/usr/local/opt".to_string(),
        "/.cargo".to_string(),
        "/.bun".to_string(),
        "/go/bin".to_string(),
        "/go/pkg".to_string(),
        "/.local/share/mise".to_string(),
        "/.rustup".to_string(),
    ];

    // Expand $HOME-based prefixes at runtime
    if let Ok(home) = std::env::var("HOME") {
        prefixes.push(format!("{}/.cargo", home));
        prefixes.push(format!("{}/.bun", home));
        prefixes.push(format!("{}/go/bin", home));
        prefixes.push(format!("{}/go/pkg", home));
        prefixes.push(format!("{}/.local/share/mise", home));
        prefixes.push(format!("{}/.rustup", home));
    }

    prefixes
}

/// Check if a path is within a known package manager directory.
fn is_manager(path: &str, prefixes: &[String]) -> bool {
    prefixes.iter().any(|p| path.starts_with(p))
}

/// Pure: given (display_path, canonical_path) pairs found on PATH and the set of
/// canonical paths claimed by managers, return Items for the unclaimed, non-system ones.
/// Excludes binaries in known manager directories.
pub fn find_orphans(
    path_execs: &[(String, String)],
    claimed: &HashSet<String>,
    manager_prefixes: &[String],
) -> Vec<Item> {
    let mut seen = HashSet::new();
    path_execs
        .iter()
        .filter(|(_disp, canon)| {
            !claimed.contains(canon) && !is_system(canon) && !is_manager(canon, manager_prefixes)
        })
        .filter(|(disp, _canon)| !is_manager(disp, manager_prefixes))
        .filter(|(_disp, canon)| seen.insert(canon.clone()))
        .map(|(disp, canon)| {
            let name = Path::new(disp)
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| disp.clone());
            Item {
                id: format!("orphan:{canon}"),
                name,
                source: "orphan".into(),
                source_detail: Some(format!("unclaimed binary at {disp}")),
                version: None,
                exec_path: Some(disp.clone()),
                homepage: None,
                raw_desc: None,
                installed_on_request: None,
            }
        })
        .collect()
}

fn is_executable(path: &Path) -> bool {
    path.metadata()
        .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

/// Enumerate executables across $PATH dirs (skipping system dirs entirely), pairing each
/// with its canonical path, then diff against `claimed`.
pub fn scan(claimed: &HashSet<String>) -> Vec<Item> {
    let path_var = std::env::var("PATH").unwrap_or_default();
    let mut execs: Vec<(String, String)> = Vec::new();
    for dir in path_var
        .split(':')
        .filter(|d| !d.is_empty() && !is_system(d))
    {
        let Ok(rd) = std::fs::read_dir(dir) else {
            continue;
        };
        for entry in rd.filter_map(|e| e.ok()) {
            let p = entry.path();
            if is_executable(&p) {
                let disp = p.to_string_lossy().into_owned();
                let canon = std::fs::canonicalize(&p)
                    .map(|c| c.to_string_lossy().into_owned())
                    .unwrap_or_else(|_| disp.clone());
                execs.push((disp, canon));
            }
        }
    }
    let prefixes = manager_prefixes();
    find_orphans(&execs, claimed, &prefixes)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn claimed(paths: &[&str]) -> HashSet<String> {
        paths.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn unclaimed_nonsystem_is_orphan() {
        let execs = vec![("/usr/local/bin/weird".into(), "/usr/local/bin/weird".into())];
        let v = find_orphans(&execs, &claimed(&[]), &[]);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].id, "orphan:/usr/local/bin/weird");
        assert_eq!(v[0].name, "weird");
    }
    #[test]
    fn claimed_is_not_orphan() {
        let execs = vec![(
            "/opt/homebrew/bin/eza".into(),
            "/opt/homebrew/Cellar/eza/1/bin/eza".into(),
        )];
        let v = find_orphans(
            &execs,
            &claimed(&["/opt/homebrew/Cellar/eza/1/bin/eza"]),
            &[],
        );
        assert_eq!(v.len(), 0);
    }
    #[test]
    fn system_binaries_excluded() {
        let execs = vec![("/usr/bin/ls".into(), "/usr/bin/ls".into())];
        assert_eq!(find_orphans(&execs, &claimed(&[]), &[]).len(), 0);
    }
    #[test]
    fn dedups_symlinks_to_same_canon() {
        let execs = vec![
            ("/usr/local/bin/a".into(), "/opt/x/tool".into()),
            ("/usr/local/bin/b".into(), "/opt/x/tool".into()),
        ];
        assert_eq!(find_orphans(&execs, &claimed(&[]), &[]).len(), 1);
    }
    #[test]
    fn brew_bin_is_not_orphan_even_when_unclaimed() {
        let execs = vec![(
            "/opt/homebrew/bin/eza".to_string(),
            "/opt/homebrew/Cellar/eza/1/bin/eza".to_string(),
        )];
        let prefixes = vec!["/opt/homebrew".to_string()];
        let v = find_orphans(&execs, &claimed(&[]), &prefixes);
        assert_eq!(v.len(), 0, "brew binaries must not be flagged as orphans");
    }
}
