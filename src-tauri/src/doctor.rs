use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Shadow {
    pub name: String,
    pub winner: String,
    pub shadowed_by: Vec<String>,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BrokenLink {
    pub path: String,
    pub target: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DoctorReport {
    pub shadowed: Vec<Shadow>,
    pub broken_symlinks: Vec<BrokenLink>,
    pub bad_path_dirs: Vec<String>,
}

/// Pure: `entries` = (name, full_path) for every PATH executable, in PATH order.
/// Any name found in more than one path → Shadow (winner = first/earliest on PATH).
pub fn find_shadowed(entries: &[(String, String)]) -> Vec<Shadow> {
    let mut order: Vec<String> = Vec::new();
    let mut by_name: HashMap<String, Vec<String>> = HashMap::new();
    for (name, path) in entries {
        let e = by_name.entry(name.clone()).or_default();
        if e.is_empty() {
            order.push(name.clone());
        }
        e.push(path.clone());
    }
    let mut out = Vec::new();
    for name in order {
        let paths = &by_name[&name];
        if paths.len() > 1 {
            out.push(Shadow {
                name,
                winner: paths[0].clone(),
                shadowed_by: paths[1..].to_vec(),
            });
        }
    }
    out
}

/// Runner: walk $PATH in order, collecting executables (for shadow detection),
/// broken symlinks, and PATH entries that aren't directories.
pub fn run_doctor() -> DoctorReport {
    let path_var = std::env::var("PATH").unwrap_or_default();
    let mut entries: Vec<(String, String)> = Vec::new();
    let mut broken: Vec<BrokenLink> = Vec::new();
    let mut bad_dirs: Vec<String> = Vec::new();

    for dir in path_var.split(':').filter(|d| !d.is_empty()) {
        let dp = Path::new(dir);
        if !dp.is_dir() {
            bad_dirs.push(dir.to_string());
            continue;
        }
        let Ok(rd) = std::fs::read_dir(dp) else {
            continue;
        };
        for entry in rd.filter_map(|e| e.ok()) {
            let path = entry.path();
            // metadata() follows symlinks → Err on a symlink with a missing target
            match std::fs::metadata(&path) {
                Ok(meta) => {
                    if meta.is_file() && meta.permissions().mode() & 0o111 != 0 {
                        entries.push((
                            entry.file_name().to_string_lossy().into_owned(),
                            path.to_string_lossy().into_owned(),
                        ));
                    }
                }
                Err(_) => {
                    if path.is_symlink() {
                        let target = std::fs::read_link(&path)
                            .map(|t| t.to_string_lossy().into_owned())
                            .unwrap_or_default();
                        broken.push(BrokenLink {
                            path: path.to_string_lossy().into_owned(),
                            target,
                        });
                    }
                }
            }
        }
    }

    DoctorReport {
        shadowed: find_shadowed(&entries),
        broken_symlinks: broken,
        bad_path_dirs: bad_dirs,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn e(name: &str, path: &str) -> (String, String) {
        (name.into(), path.into())
    }

    #[test]
    fn unique_names_no_shadows() {
        let v = find_shadowed(&[
            e("eza", "/opt/homebrew/bin/eza"),
            e("rg", "/opt/homebrew/bin/rg"),
        ]);
        assert!(v.is_empty());
    }
    #[test]
    fn name_in_two_dirs_shadows_with_first_winner() {
        let v = find_shadowed(&[
            e("node", "/opt/homebrew/bin/node"),
            e("node", "/usr/local/bin/node"),
        ]);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].name, "node");
        assert_eq!(v[0].winner, "/opt/homebrew/bin/node");
        assert_eq!(v[0].shadowed_by, vec!["/usr/local/bin/node".to_string()]);
    }
    #[test]
    fn name_in_three_dirs_two_shadowed() {
        let v = find_shadowed(&[e("py", "/a/py"), e("py", "/b/py"), e("py", "/c/py")]);
        assert_eq!(v[0].winner, "/a/py");
        assert_eq!(
            v[0].shadowed_by,
            vec!["/b/py".to_string(), "/c/py".to_string()]
        );
    }
}
