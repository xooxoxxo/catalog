use crate::item::Item;
use serde::Serialize;
use std::collections::HashSet;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct DiskInfo {
    pub id: String,
    pub size_bytes: Option<u64>,
    pub last_used: Option<String>, // "YYYY-MM" for apps, else None
    pub removable: bool,
    pub reason: Option<String>,
}

/// `brew leaves` prints one formula name per line. Collect them.
pub fn parse_leaves(stdout: &str) -> HashSet<String> {
    stdout
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect()
}

/// `mdls -name kMDItemLastUsedDate -raw <app>` prints e.g.
/// "2025-09-14 11:22:33 +0000" or "(null)". Extract (year, month).
pub fn parse_mdls_ym(raw: &str) -> Option<(i32, u32)> {
    let raw = raw.trim();
    if raw.is_empty() || raw == "(null)" {
        return None;
    }
    let date = raw.split_whitespace().next()?; // "2025-09-14"
    let mut parts = date.split('-');
    let y: i32 = parts.next()?.parse().ok()?;
    let m: u32 = parts.next()?.parse().ok()?;
    if (1..=12).contains(&m) {
        Some((y, m))
    } else {
        None
    }
}

/// Whole months from (y1,m1) to (y2,m2). Negative if the second is earlier.
pub fn months_between(y1: i32, m1: u32, y2: i32, m2: u32) -> i32 {
    (y2 * 12 + m2 as i32) - (y1 * 12 + m1 as i32)
}

/// `du -sk <path>` prints "<kibibytes>\t<path>". Return bytes.
pub fn parse_du_kb(stdout: &str) -> Option<u64> {
    let kb: u64 = stdout.split_whitespace().next()?.parse().ok()?;
    Some(kb * 1024)
}

const UNUSED_MONTHS: i32 = 6;
const MIN_FLAG_BYTES: u64 = 50 * 1024 * 1024; // 50 MB

/// Conservative "safe to remove?" decision.
/// - brew/cask: removable when it's an unneeded dependency (caller passes `unneeded_dep`).
/// - app/mas: removable when not launched for >= 6 months AND >= 50 MB.
/// - everything else: never flagged.
pub fn decide_removable(
    source: &str,
    size_bytes: Option<u64>,
    used_ym: Option<(i32, u32)>,
    now_ym: (i32, u32),
    unneeded_dep: bool,
) -> (bool, Option<String>) {
    match source {
        "brew" | "cask" if unneeded_dep => (
            true,
            Some("installed as a dependency; nothing needs it now".into()),
        ),
        "app" | "mas" => {
            if let (Some((uy, um)), Some(sz)) = (used_ym, size_bytes) {
                let age = months_between(uy, um, now_ym.0, now_ym.1);
                if age >= UNUSED_MONTHS && sz >= MIN_FLAG_BYTES {
                    return (true, Some(format!("unused ~{age}mo")));
                }
            }
            (false, None)
        }
        _ => (false, None),
    }
}

/// Absolute brew prefix (parent of the brew binary). GUI apps lack shell PATH.
fn brew_prefix() -> &'static str {
    if std::path::Path::new("/opt/homebrew/bin/brew").exists() {
        "/opt/homebrew"
    } else {
        "/usr/local"
    }
}

fn du_bytes(path: &str) -> Option<u64> {
    if !std::path::Path::new(path).exists() {
        return None;
    }
    let out = Command::new("du").args(["-sk", path]).output().ok()?;
    if !out.status.success() {
        return None;
    }
    parse_du_kb(&String::from_utf8_lossy(&out.stdout))
}

fn file_bytes(path: &str) -> Option<u64> {
    std::fs::metadata(path).ok().map(|m| m.len())
}

/// Best-effort size for one item, by source.
pub fn item_size(item: &Item) -> Option<u64> {
    let token = item.id.split_once(':').map(|(_, t)| t).unwrap_or(&item.id);
    match item.source.as_str() {
        "brew" => du_bytes(&format!("{}/Cellar/{}", brew_prefix(), item.name)),
        "cask" => du_bytes(&format!("{}/Caskroom/{}", brew_prefix(), token)),
        "app" | "mas" => match item.exec_path.as_deref() {
            Some(p) if p.ends_with(".app") => du_bytes(p),
            _ => None,
        },
        // orphan/go/npm/cargo/… : best-effort single-file stat when we know the path.
        _ => item.exec_path.as_deref().and_then(file_bytes),
    }
}

fn mdls_last_used(app_path: &str) -> Option<(i32, u32)> {
    let out = Command::new("mdls")
        .args(["-name", "kMDItemLastUsedDate", "-raw", app_path])
        .output()
        .ok()?;
    parse_mdls_ym(&String::from_utf8_lossy(&out.stdout))
}

fn now_ym() -> (i32, u32) {
    // /bin/date is always present; avoids pulling in a date crate.
    let out = Command::new("date").args(["+%Y-%m"]).output();
    if let Ok(o) = out {
        let s = String::from_utf8_lossy(&o.stdout);
        let mut p = s.trim().split('-');
        if let (Some(y), Some(m)) = (p.next(), p.next()) {
            if let (Ok(y), Ok(m)) = (y.parse::<i32>(), m.parse::<u32>()) {
                return (y, m);
            }
        }
    }
    (1970, 1)
}

fn brew_leaves() -> HashSet<String> {
    let bin = format!("{}/bin/brew", brew_prefix());
    match Command::new(bin).args(["leaves"]).output() {
        Ok(o) if o.status.success() => parse_leaves(&String::from_utf8_lossy(&o.stdout)),
        _ => HashSet::new(),
    }
}

/// Analyze every item: size + safe-to-remove signals. `progress(done, total)`
/// is called after each item so the UI can show a live counter.
pub fn analyze<F: Fn(usize, usize)>(items: &[Item], progress: F) -> Vec<DiskInfo> {
    let leaves = brew_leaves();
    let now = now_ym();
    let total = items.len();
    let mut out = Vec::with_capacity(total);
    for (i, item) in items.iter().enumerate() {
        let size_bytes = item_size(item);
        let used_ym = if matches!(item.source.as_str(), "app" | "mas") {
            item.exec_path.as_deref().and_then(mdls_last_used)
        } else {
            None
        };
        let unneeded_dep = item.source == "brew"
            && item.installed_on_request == Some(false)
            && leaves.contains(&item.name);
        let (removable, reason) =
            decide_removable(&item.source, size_bytes, used_ym, now, unneeded_dep);
        out.push(DiskInfo {
            id: item.id.clone(),
            size_bytes,
            last_used: used_ym.map(|(y, m)| format!("{y}-{m:02}")),
            removable,
            reason,
        });
        progress(i + 1, total);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_leaves_one_per_line() {
        let s = parse_leaves("llvm\nopenjph\n\n  php \n");
        assert!(s.contains("llvm") && s.contains("openjph") && s.contains("php"));
        assert_eq!(s.len(), 3);
    }

    #[test]
    fn parse_mdls_ym_handles_date_and_null() {
        assert_eq!(parse_mdls_ym("2025-09-14 11:22:33 +0000"), Some((2025, 9)));
        assert_eq!(parse_mdls_ym("(null)"), None);
        assert_eq!(parse_mdls_ym(""), None);
    }

    #[test]
    fn months_between_counts_whole_months() {
        assert_eq!(months_between(2025, 1, 2025, 7), 6);
        assert_eq!(months_between(2024, 9, 2025, 6), 9);
        assert_eq!(months_between(2025, 6, 2025, 6), 0);
    }

    #[test]
    fn parse_du_kb_reads_first_field_to_bytes() {
        assert_eq!(
            parse_du_kb("4200\t/opt/homebrew/Cellar/llvm"),
            Some(4200 * 1024)
        );
        assert_eq!(parse_du_kb("garbage"), None);
    }

    #[test]
    fn decide_removable_brew_unneeded_dep() {
        let (r, why) = decide_removable("brew", Some(1000), None, (2026, 6), true);
        assert!(r && why.is_some());
        let (r2, _) = decide_removable("brew", Some(1000), None, (2026, 6), false);
        assert!(!r2);
    }

    #[test]
    fn decide_removable_app_unused_and_big() {
        // used 2024-09, now 2026-06 => 21 months, 400 MB => flagged
        let (r, why) = decide_removable(
            "app",
            Some(400 * 1024 * 1024),
            Some((2024, 9)),
            (2026, 6),
            false,
        );
        assert!(r);
        assert!(why.unwrap().contains("unused"));
    }

    #[test]
    fn decide_removable_app_recent_or_small_not_flagged() {
        // recent
        assert!(
            !decide_removable(
                "app",
                Some(400 * 1024 * 1024),
                Some((2026, 5)),
                (2026, 6),
                false
            )
            .0
        );
        // old but small
        assert!(
            !decide_removable(
                "app",
                Some(10 * 1024 * 1024),
                Some((2020, 1)),
                (2026, 6),
                false
            )
            .0
        );
        // no usage date
        assert!(!decide_removable("app", Some(400 * 1024 * 1024), None, (2026, 6), false).0);
    }

    #[test]
    fn decide_removable_other_sources_never() {
        assert!(!decide_removable("npm", Some(99 * 1024 * 1024 * 1024), None, (2026, 6), true).0);
        assert!(!decide_removable("orphan", Some(1), None, (2026, 6), true).0);
    }
}
