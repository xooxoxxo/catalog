use crate::item::Item;
use crate::security::{severity_of, SecurityFinding, VulnInfo};
use std::process::Command;

/// brew/cask only: normalized NVD product guess (name minus @suffix, lowercased).
pub fn nvd_product(item: &Item) -> Option<String> {
    if item.source != "brew" && item.source != "cask" {
        return None;
    }
    let base = item
        .name
        .split('@')
        .next()
        .unwrap_or(&item.name)
        .trim()
        .to_lowercase()
        .replace(' ', "_");
    if base.is_empty() {
        None
    } else {
        Some(base)
    }
}

/// Version-aware partial CPE; vendor wildcarded so NVD matches by product+version.
pub fn build_match_string(product: &str, version: &str) -> String {
    format!("cpe:2.3:a:*:{product}:{version}:*:*:*:*:*:*:*")
}

// ---- NVD CVE API 2.0 response ----
#[derive(serde::Deserialize)]
struct NvdResp {
    #[serde(default)]
    vulnerabilities: Vec<NvdItem>,
}
#[derive(serde::Deserialize)]
struct NvdItem {
    cve: NvdCve,
}
#[derive(serde::Deserialize)]
struct NvdCve {
    id: String,
    #[serde(default)]
    descriptions: Vec<NvdDesc>,
    #[serde(default)]
    metrics: NvdMetrics,
}
#[derive(serde::Deserialize)]
struct NvdDesc {
    lang: String,
    value: String,
}
#[derive(serde::Deserialize, Default)]
struct NvdMetrics {
    #[serde(default, rename = "cvssMetricV31")]
    v31: Vec<NvdMetric>,
    #[serde(default, rename = "cvssMetricV30")]
    v30: Vec<NvdMetric>,
}
#[derive(serde::Deserialize)]
struct NvdMetric {
    #[serde(rename = "cvssData")]
    data: NvdCvss,
}
#[derive(serde::Deserialize)]
struct NvdCvss {
    #[serde(rename = "baseSeverity", default)]
    base_severity: Option<String>,
}

pub fn parse_nvd_cves(json: &str) -> Vec<VulnInfo> {
    let r: NvdResp = match serde_json::from_str(json) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    r.vulnerabilities
        .into_iter()
        .map(|it| {
            let cve = it.cve;
            let summary: String = cve
                .descriptions
                .iter()
                .find(|d| d.lang == "en")
                .map(|d| d.value.chars().take(140).collect())
                .unwrap_or_default();
            let sev = cve
                .metrics
                .v31
                .first()
                .or_else(|| cve.metrics.v30.first())
                .and_then(|m| m.data.base_severity.clone());
            let severity = severity_of(&cve.id, sev.as_deref());
            let url = format!("https://nvd.nist.gov/vuln/detail/{}", cve.id);
            VulnInfo {
                id: cve.id,
                aliases: vec![],
                summary,
                severity,
                fixed: None,
                url,
            }
        })
        .collect()
}

fn curl_get_key(url: &str, key: &str) -> Option<String> {
    let out = Command::new("curl")
        .args([
            "-s",
            "--max-time",
            "25",
            "-H",
            &format!("apiKey: {key}"),
            url,
        ])
        .output()
        .ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        None
    }
}

/// One request per brew/cask item with a version, paced to stay under the NVD rate limit.
pub fn scan<F: Fn(usize, usize)>(
    items: &[Item],
    api_key: &str,
    progress: F,
) -> Vec<SecurityFinding> {
    let targets: Vec<(&Item, String, String)> = items
        .iter()
        .filter_map(|it| {
            let p = nvd_product(it)?;
            let v = it.version.as_deref().filter(|s| !s.is_empty())?;
            Some((it, p, v.to_string()))
        })
        .collect();
    let total = targets.len();
    let mut out = Vec::new();
    for (done, (item, product, version)) in targets.iter().enumerate() {
        let url = format!(
            "https://services.nvd.nist.gov/rest/json/cves/2.0?virtualMatchString={}",
            build_match_string(product, version)
        );
        if let Some(json) = curl_get_key(&url, api_key) {
            let vulns = parse_nvd_cves(&json);
            if !vulns.is_empty() {
                out.push(SecurityFinding {
                    item_id: item.id.clone(),
                    package: product.clone(),
                    version: version.clone(),
                    ecosystem: "Homebrew (NVD)".into(),
                    vulns,
                });
            }
        }
        progress(done + 1, total);
        std::thread::sleep(std::time::Duration::from_millis(700));
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
    fn product_only_brew_cask_normalized() {
        assert_eq!(
            nvd_product(&item("brew", "openssl@3", Some("3.2"))).as_deref(),
            Some("openssl")
        );
        assert_eq!(
            nvd_product(&item("cask", "google-chrome", Some("120"))).as_deref(),
            Some("google-chrome")
        );
        assert_eq!(nvd_product(&item("npm", "lodash", Some("4"))), None);
    }
    #[test]
    fn match_string_is_version_scoped() {
        assert_eq!(
            build_match_string("wget", "1.21"),
            "cpe:2.3:a:*:wget:1.21:*:*:*:*:*:*:*"
        );
    }
    #[test]
    fn parse_nvd_extracts_fields_and_skips_garbage() {
        let json = r#"{"vulnerabilities":[{"cve":{"id":"CVE-2023-1","descriptions":[{"lang":"es","value":"x"},{"lang":"en","value":"Buffer overflow in foo"}],"metrics":{"cvssMetricV31":[{"cvssData":{"baseSeverity":"HIGH"}}]}}}]}"#;
        let v = parse_nvd_cves(json);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].id, "CVE-2023-1");
        assert_eq!(v[0].summary, "Buffer overflow in foo");
        assert_eq!(v[0].severity, "HIGH");
        assert_eq!(v[0].url, "https://nvd.nist.gov/vuln/detail/CVE-2023-1");
        assert!(parse_nvd_cves("garbage").is_empty());
    }
}
