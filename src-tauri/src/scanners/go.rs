use crate::item::Item;
use std::path::PathBuf;
use std::process::Command;

/// Pure: map binary names + their dir into Items. No metadata beyond name/path.
pub fn parse_go_bins(names: &[String], bin_dir: &str) -> Vec<Item> {
    names
        .iter()
        .filter(|n| !n.is_empty())
        .map(|n| Item {
            id: format!("go:{n}"),
            name: n.clone(),
            source: "go".into(),
            source_detail: None,
            version: None,
            exec_path: Some(format!("{bin_dir}/{n}")),
            homepage: None,
            raw_desc: None,
            installed_on_request: None,
        })
        .collect()
}

fn gopath_bin() -> Option<String> {
    // env PATH augmented so bare `go` resolves under the GUI PATH.
    let out = Command::new("go")
        .args(["env", "GOPATH"])
        .env("PATH", super::dev_path())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let gopath = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if gopath.is_empty() {
        return None;
    }
    Some(format!("{gopath}/bin"))
}

pub fn scan() -> Result<Vec<Item>, String> {
    let Some(bin_dir) = gopath_bin() else {
        return Ok(vec![]);
    };
    let dir = PathBuf::from(&bin_dir);
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let names: Vec<String> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    Ok(parse_go_bins(&names, &bin_dir))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn maps_names_to_items() {
        let names = vec!["gopls".to_string(), "dlv".to_string()];
        let items = parse_go_bins(&names, "/Users/x/go/bin");
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, "go:gopls");
        assert_eq!(items[0].source, "go");
        assert_eq!(items[0].exec_path.as_deref(), Some("/Users/x/go/bin/gopls"));
    }
    #[test]
    fn skips_empty_names() {
        assert_eq!(parse_go_bins(&["".to_string()], "/x").len(), 0);
    }
}
