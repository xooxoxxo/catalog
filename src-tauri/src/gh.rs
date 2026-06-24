use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct DeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub interval: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PollResult {
    Pending,
    SlowDown,
    Connected(String),
    Denied,
    Expired,
    Error(String),
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct GithubUser {
    pub login: String,
    pub avatar_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GithubStatus {
    pub connected: bool,
    pub login: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Repo {
    pub full_name: String,
    pub name: String,
    pub owner: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub stars: u64,
    pub html_url: String,
}

fn default_interval() -> u64 {
    5
}

#[derive(serde::Deserialize)]
struct DeviceCodeResp {
    device_code: String,
    user_code: String,
    verification_uri: String,
    #[serde(default = "default_interval")]
    interval: u64,
}
pub fn parse_device_code(json: &str) -> Option<DeviceCode> {
    let r: DeviceCodeResp = serde_json::from_str(json).ok()?;
    Some(DeviceCode {
        device_code: r.device_code,
        user_code: r.user_code,
        verification_uri: r.verification_uri,
        interval: r.interval,
    })
}

#[derive(serde::Deserialize)]
struct PollResp {
    #[serde(default)]
    access_token: Option<String>,
    #[serde(default)]
    error: Option<String>,
}
pub fn parse_poll(json: &str) -> PollResult {
    let r: PollResp = match serde_json::from_str(json) {
        Ok(r) => r,
        Err(_) => return PollResult::Error("bad response".into()),
    };
    if let Some(t) = r.access_token {
        if !t.is_empty() {
            return PollResult::Connected(t);
        }
    }
    match r.error.as_deref() {
        Some("authorization_pending") => PollResult::Pending,
        Some("slow_down") => PollResult::SlowDown,
        Some("expired_token") => PollResult::Expired,
        Some("access_denied") => PollResult::Denied,
        Some(e) => PollResult::Error(e.to_string()),
        None => PollResult::Error("no token or error".into()),
    }
}

#[derive(serde::Deserialize)]
struct UserResp {
    #[serde(default)]
    login: String,
    #[serde(default)]
    avatar_url: String,
}
pub fn parse_user(json: &str) -> Option<GithubUser> {
    let r: UserResp = serde_json::from_str(json).ok()?;
    if r.login.is_empty() {
        return None;
    }
    Some(GithubUser {
        login: r.login,
        avatar_url: r.avatar_url,
    })
}

const KC_SERVICE: &str = "catalog-github";
const KC_ACCOUNT: &str = "token";

/// Public OAuth-app Client ID for "catalog". Device flow has no client secret,
/// so shipping this is safe (same as the `gh` CLI). Used unless the user sets
/// their own app id in settings.
pub const DEFAULT_CLIENT_ID: &str = "Ov23ctCaswVwgq1X426N";

/// Fall back to the built-in app id when the user hasn't supplied their own.
pub fn resolve_client_id(c: &str) -> &str {
    if c.trim().is_empty() {
        DEFAULT_CLIENT_ID
    } else {
        c
    }
}

fn kc_set(token: &str) -> Result<(), String> {
    let ok = Command::new("security")
        .args([
            "add-generic-password",
            "-U",
            "-s",
            KC_SERVICE,
            "-a",
            KC_ACCOUNT,
            "-w",
            token,
        ])
        .status()
        .map_err(|e| e.to_string())?
        .success();
    if ok {
        Ok(())
    } else {
        Err("keychain write failed".into())
    }
}
fn kc_get() -> Option<String> {
    let out = Command::new("security")
        .args([
            "find-generic-password",
            "-s",
            KC_SERVICE,
            "-a",
            KC_ACCOUNT,
            "-w",
        ])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}
pub fn disconnect() -> Result<(), String> {
    let _ = Command::new("security")
        .args([
            "delete-generic-password",
            "-s",
            KC_SERVICE,
            "-a",
            KC_ACCOUNT,
        ])
        .status();
    Ok(())
}

fn post_form(url: &str, body: &str) -> Option<String> {
    let out = Command::new("curl")
        .args([
            "-s",
            "--max-time",
            "20",
            "-H",
            "Accept: application/json",
            "-H",
            "User-Agent: catalog",
            "-d",
            body,
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
fn get_auth(url: &str, token: &str) -> Option<String> {
    let out = Command::new("curl")
        .args([
            "-s",
            "--max-time",
            "20",
            "-H",
            &format!("Authorization: Bearer {token}"),
            "-H",
            "User-Agent: catalog",
            "-H",
            "Accept: application/json",
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

pub fn device_start(client_id: &str) -> Result<DeviceCode, String> {
    let client_id = resolve_client_id(client_id);
    // scope space pre-encoded (%20); curl -d sends the body verbatim.
    let body = format!("client_id={client_id}&scope=read:user%20public_repo");
    let resp = post_form("https://github.com/login/device/code", &body).ok_or("request failed")?;
    parse_device_code(&resp).ok_or_else(|| {
        format!(
            "unexpected response: {}",
            resp.chars().take(160).collect::<String>()
        )
    })
}

pub fn device_poll(client_id: &str, device_code: &str) -> Result<&'static str, String> {
    let client_id = resolve_client_id(client_id);
    let body = format!("client_id={client_id}&device_code={device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code");
    let resp =
        post_form("https://github.com/login/oauth/access_token", &body).ok_or("request failed")?;
    Ok(match parse_poll(&resp) {
        PollResult::Connected(t) => {
            kc_set(&t)?;
            "connected"
        }
        PollResult::Pending => "pending",
        PollResult::SlowDown => "slow_down",
        PollResult::Denied => "denied",
        PollResult::Expired => "expired",
        PollResult::Error(_) => "error",
    })
}

pub fn status() -> GithubStatus {
    let disconnected = GithubStatus {
        connected: false,
        login: None,
        avatar_url: None,
    };
    let Some(token) = kc_get() else {
        return disconnected;
    };
    match get_auth("https://api.github.com/user", &token).and_then(|j| parse_user(&j)) {
        Some(u) => GithubStatus {
            connected: true,
            login: Some(u.login),
            avatar_url: Some(u.avatar_url),
        },
        None => disconnected,
    }
}

#[derive(serde::Deserialize)]
struct StarOwner {
    login: String,
}
#[derive(serde::Deserialize)]
struct StarRepo {
    full_name: String,
    name: String,
    owner: StarOwner,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    language: Option<String>,
    #[serde(default)]
    stargazers_count: u64,
    html_url: String,
}
pub fn parse_stars(json: &str) -> Vec<Repo> {
    let raw: Vec<StarRepo> = serde_json::from_str(json).unwrap_or_default();
    raw.into_iter()
        .map(|r| Repo {
            full_name: r.full_name,
            name: r.name,
            owner: r.owner.login,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count,
            html_url: r.html_url,
        })
        .collect()
}

fn get_auth_raw(url: &str, token: &str) -> Option<String> {
    // -f: fail (non-zero) on HTTP 4xx/5xx (e.g. 404 no-README) so we don't return an error body
    let out = Command::new("curl")
        .args([
            "-sf",
            "--max-time",
            "20",
            "-H",
            &format!("Authorization: Bearer {token}"),
            "-H",
            "User-Agent: catalog",
            "-H",
            "Accept: application/vnd.github.raw",
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

fn write_auth(method: &str, url: &str, token: &str) -> Result<(), String> {
    let out = Command::new("curl")
        .args([
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "-X",
            method,
            "--max-time",
            "20",
            "-H",
            &format!("Authorization: Bearer {token}"),
            "-H",
            "User-Agent: catalog",
            "-H",
            "Content-Length: 0",
            url,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    let code = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if code == "204" || code == "200" {
        Ok(())
    } else {
        Err(format!("github returned {code}"))
    }
}

pub fn list_stars() -> Result<Vec<Repo>, String> {
    let token = kc_get().ok_or("not connected")?;
    let mut all = Vec::new();
    for page in 1..=20 {
        let url = format!("https://api.github.com/user/starred?per_page=100&page={page}");
        let body = get_auth(&url, &token).ok_or("request failed")?;
        let repos = parse_stars(&body);
        if repos.is_empty() {
            break;
        }
        all.extend(repos);
    }
    Ok(all)
}

pub fn readme(owner: &str, repo: &str) -> Result<String, String> {
    let token = kc_get().ok_or("not connected")?;
    get_auth_raw(
        &format!("https://api.github.com/repos/{owner}/{repo}/readme"),
        &token,
    )
    .ok_or_else(|| "no README".into())
}

pub fn star(owner: &str, repo: &str) -> Result<(), String> {
    let token = kc_get().ok_or("not connected")?;
    write_auth(
        "PUT",
        &format!("https://api.github.com/user/starred/{owner}/{repo}"),
        &token,
    )
}
pub fn unstar(owner: &str, repo: &str) -> Result<(), String> {
    let token = kc_get().ok_or("not connected")?;
    write_auth(
        "DELETE",
        &format!("https://api.github.com/user/starred/{owner}/{repo}"),
        &token,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_code_parses() {
        let dc = parse_device_code(r#"{"device_code":"DC","user_code":"WXYZ-1234","verification_uri":"https://github.com/login/device","expires_in":900,"interval":5}"#).unwrap();
        assert_eq!(dc.device_code, "DC");
        assert_eq!(dc.user_code, "WXYZ-1234");
        assert_eq!(dc.verification_uri, "https://github.com/login/device");
        assert_eq!(dc.interval, 5);
    }
    #[test]
    fn device_code_missing_field_is_none() {
        assert!(parse_device_code(r#"{"user_code":"X"}"#).is_none());
    }
    #[test]
    fn resolve_client_id_falls_back_to_default() {
        assert_eq!(resolve_client_id(""), DEFAULT_CLIENT_ID);
        assert_eq!(resolve_client_id("   "), DEFAULT_CLIENT_ID);
        assert_eq!(resolve_client_id("Iv1.custom"), "Iv1.custom");
    }
    #[test]
    fn poll_states() {
        assert_eq!(
            parse_poll(r#"{"access_token":"gho_abc","token_type":"bearer","scope":"read:user"}"#),
            PollResult::Connected("gho_abc".into())
        );
        assert_eq!(
            parse_poll(r#"{"error":"authorization_pending"}"#),
            PollResult::Pending
        );
        assert_eq!(
            parse_poll(r#"{"error":"slow_down","interval":10}"#),
            PollResult::SlowDown
        );
        assert_eq!(
            parse_poll(r#"{"error":"expired_token"}"#),
            PollResult::Expired
        );
        assert_eq!(
            parse_poll(r#"{"error":"access_denied"}"#),
            PollResult::Denied
        );
        assert!(matches!(
            parse_poll(r#"{"error":"unsupported_grant_type"}"#),
            PollResult::Error(_)
        ));
        assert!(matches!(parse_poll("garbage"), PollResult::Error(_)));
    }
    #[test]
    fn user_parses_and_requires_login() {
        let u = parse_user(r#"{"login":"oytun","avatar_url":"https://x/a.png","id":1}"#).unwrap();
        assert_eq!(u.login, "oytun");
        assert_eq!(u.avatar_url, "https://x/a.png");
        assert!(parse_user(r#"{"id":1}"#).is_none());
    }
    #[test]
    fn stars_parse() {
        let json = r#"[
          {"full_name":"BurntSushi/ripgrep","name":"ripgrep","owner":{"login":"BurntSushi"},"description":"recursively search","language":"Rust","stargazers_count":45000,"html_url":"https://github.com/BurntSushi/ripgrep"},
          {"full_name":"x/y","name":"y","owner":{"login":"x"},"stargazers_count":3,"html_url":"https://github.com/x/y"}
        ]"#;
        let v = parse_stars(json);
        assert_eq!(v.len(), 2);
        assert_eq!(v[0].owner, "BurntSushi");
        assert_eq!(v[0].name, "ripgrep");
        assert_eq!(v[0].language.as_deref(), Some("Rust"));
        assert_eq!(v[0].stars, 45000);
        assert_eq!(v[1].description, None);
        assert_eq!(v[1].language, None);
        assert!(parse_stars("garbage").is_empty());
    }
}
