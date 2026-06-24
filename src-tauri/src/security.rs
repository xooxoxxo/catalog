use crate::item::Item;
use serde::Serialize;
use std::io::Write;
use std::process::{Command, Stdio};

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct VulnInfo {
    pub id: String,
    pub aliases: Vec<String>,
    pub summary: String,
    pub severity: String, // MALWARE | CRITICAL | HIGH | MODERATE | LOW | UNKNOWN
    pub fixed: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SecurityFinding {
    pub item_id: String,
    pub package: String,
    pub version: String,
    pub ecosystem: String,
    pub vulns: Vec<VulnInfo>,
}

/// Map a catalog source to its OSV ecosystem (None = not scannable by OSV).
pub fn osv_ecosystem(source: &str) -> Option<&'static str> {
    match source {
        "npm" | "bun" => Some("npm"),
        "cargo" => Some("crates.io"),
        "pipx" | "uv" => Some("PyPI"),
        _ => None,
    }
}

/// (ecosystem, name, version) for a queryable item; None if no ecosystem or no version.
pub fn query_for(item: &Item) -> Option<(String, String, String)> {
    let eco = osv_ecosystem(&item.source)?;
    let v = item.version.as_deref().filter(|s| !s.is_empty())?;
    Some((eco.to_string(), item.name.clone(), v.to_string()))
}

fn json_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

// ---- /v1/querybatch response ----
#[derive(serde::Deserialize)]
struct BatchResp {
    #[serde(default)]
    results: Vec<BatchResult>,
}
#[derive(serde::Deserialize)]
struct BatchResult {
    #[serde(default)]
    vulns: Vec<BatchVuln>,
}
#[derive(serde::Deserialize)]
struct BatchVuln {
    id: String,
}

/// Per-query vuln-id lists, parallel to the queries array.
pub fn parse_querybatch(json: &str) -> Vec<Vec<String>> {
    match serde_json::from_str::<BatchResp>(json) {
        Ok(r) => r
            .results
            .into_iter()
            .map(|res| res.vulns.into_iter().map(|v| v.id).collect())
            .collect(),
        Err(_) => vec![],
    }
}

// ---- /v1/vulns/{id} response ----
#[derive(serde::Deserialize)]
struct VulnResp {
    id: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    details: String,
    #[serde(default)]
    aliases: Vec<String>,
    #[serde(default)]
    affected: Vec<Affected>,
    #[serde(default)]
    database_specific: DbSpecific,
}
#[derive(serde::Deserialize, Default)]
struct DbSpecific {
    #[serde(default)]
    severity: Option<String>,
}
#[derive(serde::Deserialize)]
struct Affected {
    #[serde(default)]
    ranges: Vec<VRange>,
}
#[derive(serde::Deserialize)]
struct VRange {
    #[serde(default)]
    events: Vec<VEvent>,
}
#[derive(serde::Deserialize)]
struct VEvent {
    #[serde(default)]
    fixed: Option<String>,
}

pub fn severity_of(id: &str, db_sev: Option<&str>) -> String {
    if id.starts_with("MAL-") {
        return "MALWARE".to_string();
    }
    match db_sev.map(|s| s.to_uppercase()).as_deref() {
        Some("CRITICAL") => "CRITICAL",
        Some("HIGH") => "HIGH",
        Some("MODERATE") | Some("MEDIUM") => "MODERATE",
        Some("LOW") => "LOW",
        _ => "UNKNOWN",
    }
    .to_string()
}

pub fn parse_vuln(json: &str) -> Option<VulnInfo> {
    let v: VulnResp = serde_json::from_str(json).ok()?;
    let summary = if !v.summary.is_empty() {
        v.summary.clone()
    } else if !v.details.is_empty() {
        v.details.chars().take(140).collect()
    } else {
        String::new()
    };
    let fixed = v
        .affected
        .iter()
        .flat_map(|a| a.ranges.iter())
        .flat_map(|r| r.events.iter())
        .find_map(|e| e.fixed.clone());
    let severity = severity_of(&v.id, v.database_specific.severity.as_deref());
    let url = format!("https://osv.dev/vulnerability/{}", v.id);
    Some(VulnInfo {
        id: v.id,
        aliases: v.aliases,
        summary,
        severity,
        fixed,
        url,
    })
}

fn curl_post_json(url: &str, body: &str) -> Option<String> {
    let mut child = Command::new("curl")
        .args([
            "-s",
            "--max-time",
            "20",
            "-H",
            "Content-Type: application/json",
            "--data-binary",
            "@-",
            url,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .ok()?;
    {
        let mut si = child.stdin.take()?;
        si.write_all(body.as_bytes()).ok()?;
    } // drop si → close stdin so curl sends the request
    let out = child.wait_with_output().ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        None
    }
}

fn curl_get(url: &str) -> Option<String> {
    let out = Command::new("curl")
        .args(["-s", "--max-time", "20", url])
        .output()
        .ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        None
    }
}

/// Scan queryable items against OSV. `progress(done, total)` runs over the affected set.
pub fn scan<F: Fn(usize, usize)>(items: &[Item], progress: F) -> Vec<SecurityFinding> {
    let q: Vec<(&Item, (String, String, String))> = items
        .iter()
        .filter_map(|it| query_for(it).map(|t| (it, t)))
        .collect();
    if q.is_empty() {
        return vec![];
    }

    let queries: Vec<String> = q
        .iter()
        .map(|(_, (eco, name, ver))| {
            format!(
                r#"{{"package":{{"ecosystem":"{}","name":"{}"}},"version":"{}"}}"#,
                eco,
                json_escape(name),
                json_escape(ver)
            )
        })
        .collect();
    let body = format!(r#"{{"queries":[{}]}}"#, queries.join(","));

    let resp = match curl_post_json("https://api.osv.dev/v1/querybatch", &body) {
        Some(r) => r,
        None => return vec![],
    };
    let ids_per = parse_querybatch(&resp);

    let affected: Vec<usize> = ids_per
        .iter()
        .enumerate()
        .filter(|(_, ids)| !ids.is_empty())
        .map(|(i, _)| i)
        .collect();
    let total = affected.len();

    let mut out = Vec::new();
    for (done, &i) in affected.iter().enumerate() {
        if i >= q.len() {
            break;
        }
        let (item, (eco, name, ver)) = &q[i];
        let mut vulns = Vec::new();
        for id in &ids_per[i] {
            if let Some(d) =
                curl_get(&format!("https://api.osv.dev/v1/vulns/{id}")).and_then(|j| parse_vuln(&j))
            {
                vulns.push(d);
            }
        }
        if !vulns.is_empty() {
            out.push(SecurityFinding {
                item_id: item.id.clone(),
                package: name.clone(),
                version: ver.clone(),
                ecosystem: eco.clone(),
                vulns,
            });
        }
        progress(done + 1, total);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::Item;

    fn item(source: &str, name: &str, version: Option<&str>) -> Item {
        Item {
            id: format!("{source}:{name}"),
            name: name.into(),
            source: source.into(),
            source_detail: None,
            version: version.map(String::from),
            exec_path: None,
            homepage: None,
            raw_desc: None,
            installed_on_request: None,
        }
    }

    #[test]
    fn ecosystem_map() {
        assert_eq!(osv_ecosystem("npm"), Some("npm"));
        assert_eq!(osv_ecosystem("bun"), Some("npm"));
        assert_eq!(osv_ecosystem("cargo"), Some("crates.io"));
        assert_eq!(osv_ecosystem("pipx"), Some("PyPI"));
        assert_eq!(osv_ecosystem("uv"), Some("PyPI"));
        assert_eq!(osv_ecosystem("go"), None);
        assert_eq!(osv_ecosystem("brew"), None);
    }

    #[test]
    fn query_for_requires_ecosystem_and_version() {
        assert_eq!(
            query_for(&item("npm", "lodash", Some("4.17.4"))),
            Some(("npm".into(), "lodash".into(), "4.17.4".into()))
        );
        assert_eq!(query_for(&item("npm", "x", None)), None);
        assert_eq!(query_for(&item("npm", "x", Some(""))), None);
        assert_eq!(query_for(&item("brew", "ripgrep", Some("14.1"))), None);
    }

    #[test]
    fn querybatch_parses_parallel_results() {
        let json = r#"{"results":[{"vulns":[{"id":"GHSA-1"},{"id":"CVE-2"}]},{},{"vulns":[{"id":"MAL-3"}]}]}"#;
        assert_eq!(
            parse_querybatch(json),
            vec![
                vec!["GHSA-1".to_string(), "CVE-2".to_string()],
                vec![] as Vec<String>,
                vec!["MAL-3".to_string()]
            ]
        );
        assert_eq!(parse_querybatch("garbage"), Vec::<Vec<String>>::new());
    }

    #[test]
    fn severity_buckets() {
        assert_eq!(severity_of("MAL-2024-1", None), "MALWARE");
        assert_eq!(severity_of("GHSA-x", Some("HIGH")), "HIGH");
        assert_eq!(severity_of("GHSA-x", Some("medium")), "MODERATE");
        assert_eq!(severity_of("GHSA-x", Some("critical")), "CRITICAL");
        assert_eq!(severity_of("GHSA-x", None), "UNKNOWN");
    }

    #[test]
    fn vuln_detail_extracts_fields() {
        let json = r#"{"id":"GHSA-jf85","summary":"Prototype pollution",
          "aliases":["CVE-2021-23337"],
          "affected":[{"ranges":[{"events":[{"introduced":"0"},{"fixed":"4.17.21"}]}]}],
          "database_specific":{"severity":"HIGH"}}"#;
        let v = parse_vuln(json).unwrap();
        assert_eq!(v.id, "GHSA-jf85");
        assert_eq!(v.aliases, vec!["CVE-2021-23337"]);
        assert_eq!(v.summary, "Prototype pollution");
        assert_eq!(v.severity, "HIGH");
        assert_eq!(v.fixed.as_deref(), Some("4.17.21"));
        assert_eq!(v.url, "https://osv.dev/vulnerability/GHSA-jf85");
    }

    #[test]
    fn vuln_detail_falls_back_to_details_and_no_fix() {
        let json = r#"{"id":"MAL-1","details":"this package is malicious","affected":[]}"#;
        let v = parse_vuln(json).unwrap();
        assert_eq!(v.severity, "MALWARE");
        assert_eq!(v.summary, "this package is malicious");
        assert_eq!(v.fixed, None);
    }

    #[test]
    fn json_escape_quotes_and_backslashes() {
        assert_eq!(json_escape(r#"a"b\c"#), r#"a\"b\\c"#);
    }
}
