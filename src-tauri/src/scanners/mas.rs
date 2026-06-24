use crate::item::Item;
use std::process::Command;

/// Pure: parse `mas list` stdout. Each line: "<id>  <name> (<version>)".
pub fn parse_mas_list(stdout: &str) -> Vec<Item> {
    stdout
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let (id_part, rest) = line.split_once(char::is_whitespace)?;
            let rest = rest.trim();
            let (name, version) = match rest.rsplit_once(" (") {
                Some((n, v)) => (
                    n.trim().to_string(),
                    Some(v.trim_end_matches(')').to_string()),
                ),
                None => (rest.to_string(), None),
            };
            Some(Item {
                id: format!("mas:{id_part}"),
                name,
                source: "mas".into(),
                source_detail: Some(format!("app store id {id_part}")),
                version,
                exec_path: None,
                homepage: None,
                raw_desc: None,
                installed_on_request: None,
            })
        })
        .collect()
}

pub fn scan() -> Result<Vec<Item>, String> {
    let bin = ["/opt/homebrew/bin/mas", "/usr/local/bin/mas"]
        .into_iter()
        .find(|p| std::path::Path::new(p).exists());
    let Some(bin) = bin else {
        return Ok(vec![]);
    }; // mas not installed → no MAS items
    let out = Command::new(bin)
        .arg("list")
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Ok(vec![]);
    }
    Ok(parse_mas_list(&String::from_utf8_lossy(&out.stdout)))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_id_name_version() {
        let items = parse_mas_list(include_str!("../../tests/fixtures/mas-list.txt"));
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, "mas:497799835");
        assert_eq!(items[0].name, "Xcode");
        assert_eq!(items[0].version.as_deref(), Some("15.4"));
    }
}
