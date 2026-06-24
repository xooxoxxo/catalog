use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Dep {
    pub name: String,
    pub present: bool,
    pub powers: String,
    pub install: String,
}

/// which-style: is `tool` a file in any of `dirs`? `exists` is injected for testing.
pub fn found_in(tool: &str, dirs: &[&str], exists: impl Fn(&str) -> bool) -> bool {
    dirs.iter().any(|d| exists(&format!("{d}/{tool}")))
}

const TOOLS: &[(&str, &str, &str)] = &[
    (
        "brew",
        "Homebrew formulae & casks (+ update checks)",
        "https://brew.sh",
    ),
    ("mas", "Mac App Store apps (+ updates)", "brew install mas"),
    (
        "npm",
        "global npm packages (+ updates, vuln scan)",
        "Node.js — nvm or brew install node",
    ),
    (
        "cargo",
        "Rust cargo-install tools (+ vuln scan)",
        "https://rustup.rs",
    ),
    ("uv", "uv tools (+ vuln scan)", "brew install uv"),
    ("pipx", "pipx apps (+ vuln scan)", "brew install pipx"),
    ("go", "Go-installed binaries", "brew install go"),
    ("bun", "global bun packages", "brew install bun"),
];

pub fn check_deps() -> Vec<Dep> {
    let path = crate::scanners::dev_path();
    let dirs: Vec<&str> = path.split(':').collect();
    TOOLS
        .iter()
        .map(|(name, powers, install)| Dep {
            name: (*name).to_string(),
            present: found_in(name, &dirs, |p| Path::new(p).is_file()),
            powers: (*powers).to_string(),
            install: (*install).to_string(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn found_in_matches_any_dir() {
        let dirs = ["/a", "/b", "/c"];
        assert!(found_in("brew", &dirs, |p| p == "/b/brew"));
        assert!(!found_in("brew", &dirs, |_| false));
    }

    #[test]
    fn found_in_empty_dirs_is_false() {
        assert!(!found_in("brew", &[], |_| true));
    }

    #[test]
    fn check_deps_lists_all_eight_tools() {
        let d = check_deps();
        assert_eq!(d.len(), 8);
        assert!(d.iter().any(|x| x.name == "brew"));
        assert!(d.iter().any(|x| x.name == "bun"));
        // every dep has non-empty powers + install hint
        assert!(d
            .iter()
            .all(|x| !x.powers.is_empty() && !x.install.is_empty()));
    }
}
