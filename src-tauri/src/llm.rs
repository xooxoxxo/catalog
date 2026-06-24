use crate::config::Provider;
use crate::item::Item;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Suggestion {
    pub description: String,
    pub tags: Vec<String>,
}

/// Pure: build the model prompt from ALREADY-COLLECTED metadata only.
/// Never instructs running the binary.
pub fn build_prompt(item: &Item) -> String {
    let mut ctx = format!("name: {}\nsource: {}", item.name, item.source);
    if let Some(v) = &item.version {
        ctx.push_str(&format!("\nversion: {v}"));
    }
    if let Some(p) = &item.exec_path {
        ctx.push_str(&format!("\npath: {p}"));
    }
    if let Some(d) = &item.raw_desc {
        ctx.push_str(&format!("\nknown description: {d}"));
    }
    if let Some(h) = &item.homepage {
        ctx.push_str(&format!("\nhomepage: {h}"));
    }
    format!(
        "You are cataloguing software installed on a developer's Mac. \
Given the metadata below, respond with ONLY a JSON object (no prose, no markdown fences) of the form \
{{\"description\": \"<one concise sentence, max 120 chars, what this tool/app does>\", \
\"tags\": [\"<3-6 short lowercase category tags, e.g. cli, editor, network, dev, media>\"]}}. \
If you are unsure what it is, give your best guess and tag it \"unknown\".\n\nMetadata:\n{ctx}"
    )
}

/// Pure: extract a {description, tags} object from the model's reply, tolerating
/// surrounding prose or ```json fences by slicing from the first '{' to the last '}'.
pub fn parse_suggestion(stdout: &str) -> Result<Suggestion, String> {
    let start = stdout.find('{').ok_or("no JSON object in reply")?;
    let end = stdout.rfind('}').ok_or("no closing brace in reply")?;
    if end < start {
        return Err("malformed JSON span".into());
    }
    let slice = &stdout[start..=end];
    serde_json::from_str::<Suggestion>(slice).map_err(|e| format!("parse error: {e}"))
}

/// Pure: build argv. When !stdin, substitute the literal token "{prompt}". When stdin, args verbatim.
pub fn build_argv(args: &[String], prompt: &str, stdin: bool) -> Vec<String> {
    if stdin {
        return args.to_vec();
    }
    args.iter().map(|a| a.replace("{prompt}", prompt)).collect()
}

/// Disable MCP for the built-in `claude` provider so a one-shot describe doesn't
/// spin up the user's integrations (those are what prompt for TCC: Photos/Music/…).
/// ponytail: claude-only — codex/others rely on the temp-cwd sandbox; add their flags if it bites.
pub fn harden_argv(command: &str, argv: Vec<String>) -> Vec<String> {
    let base = command.rsplit('/').next().unwrap_or(command);
    if base == "claude" && !argv.iter().any(|a| a == "--mcp-config") {
        let mut v = vec![
            "--strict-mcp-config".to_string(),
            "--mcp-config".to_string(),
            "{\"mcpServers\":{}}".to_string(),
        ];
        v.extend(argv);
        return v;
    }
    argv
}

/// Resolve a bare command against common GUI-PATH-less locations, else use as-is.
fn resolve_command(cmd: &str) -> String {
    if cmd.contains('/') {
        return cmd.to_string();
    }
    let home = std::env::var("HOME").unwrap_or_default();
    for dir in [
        format!("{home}/.local/bin"),
        "/opt/homebrew/bin".into(),
        "/usr/local/bin".into(),
    ] {
        let p = format!("{dir}/{cmd}");
        if std::path::Path::new(&p).exists() {
            return p;
        }
    }
    cmd.to_string()
}

/// Run a provider command with the prompt (arg-substitution or stdin), return stdout.
pub fn run_provider(p: &Provider, prompt: &str) -> Result<String, String> {
    if p.command.trim().is_empty() {
        return Err("no provider command configured".into());
    }
    let bin = resolve_command(&p.command);
    let argv = harden_argv(&p.command, build_argv(&p.args, prompt, p.stdin));
    let mut cmd = Command::new(&bin);
    cmd.args(&argv);
    cmd.current_dir(std::env::temp_dir()); // ponytail: temp cwd → provider can't load project MCP / enumerate $HOME
    cmd.env("PATH", crate::scanners::dev_path()); // GUI PATH is minimal → claude couldn't find node
    let out = if p.stdin {
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("failed to run {bin}: {e}"))?;
        {
            let mut sin = child.stdin.take().ok_or("no stdin")?;
            sin.write_all(prompt.as_bytes())
                .map_err(|e| e.to_string())?;
            // sin drops here → EOF
        }
        child.wait_with_output().map_err(|e| e.to_string())?
    } else {
        cmd.output()
            .map_err(|e| format!("failed to run {bin}: {e}"))?
    };
    if !out.status.success() {
        return Err(format!(
            "{} exited {}: {}",
            p.command,
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Reachability probe (short-timeout TCP connect).
pub fn check_online() -> bool {
    use std::net::ToSocketAddrs;
    use std::time::Duration;
    "1.1.1.1:443"
        .to_socket_addrs()
        .ok()
        .and_then(|mut a| a.next())
        .map(|sa| std::net::TcpStream::connect_timeout(&sa, Duration::from_secs(2)).is_ok())
        .unwrap_or(false)
}

/// Describe an item using the active provider from config.
pub fn describe(item: &Item) -> Result<Suggestion, String> {
    let cfg = crate::config::load_from(&crate::config::config_path());
    let p = cfg
        .providers
        .get(&cfg.active)
        .ok_or("active provider not found")?;
    let prompt = build_prompt(item);
    let out = run_provider(p, &prompt)?;
    parse_suggestion(&out)
}

/// Pure: build ONE prompt describing many items at once. Keys are the exact item ids.
/// Metadata only — never instructs running a binary (same invariant as build_prompt).
pub fn build_batch_prompt(items: &[Item]) -> String {
    let mut blocks = String::new();
    for it in items {
        blocks.push_str(&format!(
            "\n[{}]\nname: {}\nsource: {}",
            it.id, it.name, it.source
        ));
        if let Some(v) = &it.version {
            blocks.push_str(&format!("\nversion: {v}"));
        }
        if let Some(p) = &it.exec_path {
            blocks.push_str(&format!("\npath: {p}"));
        }
        if let Some(d) = &it.raw_desc {
            blocks.push_str(&format!("\nknown description: {d}"));
        }
        if let Some(h) = &it.homepage {
            blocks.push_str(&format!("\nhomepage: {h}"));
        }
        blocks.push('\n');
    }
    format!(
        "You are cataloguing software installed on a developer's Mac. For EACH item below, infer what it is. \
Respond with ONLY a JSON object (no prose, no markdown fences) whose keys are the exact bracketed ids and whose \
values are {{\"description\": \"<one concise sentence, max 120 chars>\", \"tags\": [\"<3-6 short lowercase tags>\"]}}. \
Include every id exactly once; if unsure, give your best guess and tag \"unknown\".\n\nItems:\n{blocks}"
    )
}

/// Pure: extract a per-id {description,tags} map, leniently (skip malformed entries,
/// tolerate prose/```json fences).
pub fn parse_batch(stdout: &str) -> std::collections::BTreeMap<String, Suggestion> {
    let mut out = std::collections::BTreeMap::new();
    let (Some(s), Some(e)) = (stdout.find('{'), stdout.rfind('}')) else {
        return out;
    };
    if e < s {
        return out;
    }
    let val: serde_json::Value = match serde_json::from_str(&stdout[s..=e]) {
        Ok(v) => v,
        Err(_) => return out,
    };
    if let Some(obj) = val.as_object() {
        for (k, v) in obj {
            if let Ok(sg) = serde_json::from_value::<Suggestion>(v.clone()) {
                out.insert(k.clone(), sg);
            }
        }
    }
    out
}

/// Describe many items in one provider call via the active provider.
pub fn describe_batch(
    items: &[Item],
) -> Result<std::collections::BTreeMap<String, Suggestion>, String> {
    let cfg = crate::config::load_from(&crate::config::config_path());
    let p = cfg
        .providers
        .get(&cfg.active)
        .ok_or("active provider not found")?;
    let out = run_provider(p, &build_batch_prompt(items))?;
    Ok(parse_batch(&out))
}

/// Pure: build the theme-palette prompt. Names every token; demands JSON only.
pub fn build_theme_prompt(vibe: &str, base: &str) -> String {
    format!(
        "You are designing a {base} UI color theme for a desktop app. Respond with ONLY a JSON object \
(no prose, no markdown fences) mapping EACH of these keys to a CSS hex color (#rrggbb): \
bg, surface, surface2, line, line2, text, text-2, text-3, accent, accent-fg, update, orphan, danger. \
Rules: it is a {base} theme — bg is the base background; surface and surface2 are panels slightly raised from bg; \
line and line2 are subtle borders; text/text-2/text-3 are primary/secondary/tertiary text, all readable on bg; \
accent is the signature colour of the vibe and accent-fg is text that is readable ON the accent; \
update is a success colour, orphan a warning/amber, danger an error/red — each tuned to the vibe. \
Make it harmonious and accessible. Vibe: {vibe}"
    )
}

/// Pure: parse a token->hex map from the model reply (tolerates prose/```json fences).
pub fn parse_palette(stdout: &str) -> Result<std::collections::BTreeMap<String, String>, String> {
    let start = stdout.find('{').ok_or("no JSON object in reply")?;
    let end = stdout.rfind('}').ok_or("no closing brace in reply")?;
    if end < start {
        return Err("malformed JSON span".into());
    }
    serde_json::from_str(&stdout[start..=end]).map_err(|e| format!("parse error: {e}"))
}

/// Generate a palette (token->hex) via the active provider.
pub fn theme_palette(
    vibe: &str,
    base: &str,
) -> Result<std::collections::BTreeMap<String, String>, String> {
    let cfg = crate::config::load_from(&crate::config::config_path());
    let p = cfg
        .providers
        .get(&cfg.active)
        .ok_or("active provider not found")?;
    let out = run_provider(p, &build_theme_prompt(vibe, base))?;
    parse_palette(&out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item::Item;

    fn item() -> Item {
        Item {
            id: "orphan:/usr/local/bin/zap".into(),
            name: "zap".into(),
            source: "orphan".into(),
            source_detail: None,
            version: None,
            exec_path: Some("/usr/local/bin/zap".into()),
            homepage: None,
            raw_desc: None,
            installed_on_request: None,
        }
    }

    #[test]
    fn prompt_includes_metadata_and_demands_json() {
        let p = build_prompt(&item());
        assert!(p.contains("name: zap"));
        assert!(p.contains("source: orphan"));
        assert!(p.contains("path: /usr/local/bin/zap"));
        assert!(p.to_lowercase().contains("json"));
        assert!(!p.to_lowercase().contains("--help")); // never runs the binary
    }

    #[test]
    fn parses_plain_json() {
        let s =
            parse_suggestion(r#"{"description":"A fast linter","tags":["cli","dev"]}"#).unwrap();
        assert_eq!(s.description, "A fast linter");
        assert_eq!(s.tags, vec!["cli", "dev"]);
    }

    #[test]
    fn parses_json_inside_prose_and_fences() {
        let reply = "Sure! Here you go:\n```json\n{\"description\":\"Image tool\",\"tags\":[\"media\"]}\n```\nHope that helps.";
        let s = parse_suggestion(reply).unwrap();
        assert_eq!(s.description, "Image tool");
        assert_eq!(s.tags, vec!["media"]);
    }

    #[test]
    fn errors_when_no_json() {
        assert!(parse_suggestion("I don't know what that is.").is_err());
    }

    #[test]
    fn build_argv_substitutes_prompt_when_not_stdin() {
        let args = vec!["-p".to_string(), "{prompt}".to_string()];
        assert_eq!(build_argv(&args, "hello", false), vec!["-p", "hello"]);
    }

    #[test]
    fn build_argv_verbatim_when_stdin() {
        let args = vec!["run".to_string(), "llama3.2".to_string()];
        assert_eq!(build_argv(&args, "hello", true), vec!["run", "llama3.2"]);
    }

    #[test]
    fn batch_prompt_lists_ids_metadata_only() {
        let items = vec![item()];
        let p = build_batch_prompt(&items);
        assert!(p.contains("[orphan:/usr/local/bin/zap]"));
        assert!(p.contains("name: zap"));
        assert!(p.to_lowercase().contains("json"));
        assert!(!p.to_lowercase().contains("--help"));
    }

    #[test]
    fn parse_batch_extracts_per_id_lenient() {
        let j = "Sure:\n```json\n{\"brew:eza\":{\"description\":\"ls replacement\",\"tags\":[\"cli\"]},\"bad\":{\"nope\":1}}\n```";
        let m = parse_batch(j);
        assert_eq!(m.len(), 1);
        assert_eq!(m.get("brew:eza").unwrap().description, "ls replacement");
        assert!(parse_batch("no json").is_empty());
    }

    #[test]
    fn theme_prompt_names_all_tokens_and_demands_json() {
        let p = build_theme_prompt("warm terminal green", "dark");
        for tok in [
            "bg",
            "surface",
            "surface2",
            "line",
            "line2",
            "text",
            "text-2",
            "text-3",
            "accent",
            "accent-fg",
            "update",
            "orphan",
            "danger",
        ] {
            assert!(p.contains(tok), "prompt missing token {tok}");
        }
        assert!(p.to_lowercase().contains("json"));
        assert!(p.contains("dark") && p.contains("warm terminal green"));
    }

    #[test]
    fn palette_parses_from_fenced_json() {
        let r = parse_palette("Sure:\n```json\n{\"accent\":\"#abcdef\",\"bg\":\"#101010\"}\n```")
            .unwrap();
        assert_eq!(r.get("accent").map(|s| s.as_str()), Some("#abcdef"));
        assert!(parse_palette("no json here").is_err());
    }

    #[test]
    fn harden_argv_disables_mcp_for_claude_only() {
        let c = harden_argv("claude", vec!["-p".into(), "hi".into()]);
        assert_eq!(c[0], "--strict-mcp-config");
        assert!(c.contains(&"-p".to_string()) && c.contains(&"hi".to_string()));
        assert_eq!(
            harden_argv("/opt/homebrew/bin/claude", vec!["-p".into()])[0],
            "--strict-mcp-config"
        );
        assert_eq!(
            harden_argv("ollama", vec!["run".into()]),
            vec!["run".to_string()]
        ); // others untouched
        assert_eq!(
            harden_argv("claude", vec!["--mcp-config".into(), "x".into()]).len(),
            2
        ); // idempotent
    }

    #[test]
    fn run_provider_errors_on_empty_command() {
        let p = Provider {
            command: String::new(),
            args: vec![],
            stdin: false,
            requires_online: false,
        };
        assert!(run_provider(&p, "x").is_err());
    }

    #[test]
    fn run_provider_stdin_pipes_to_cat_without_deadlock() {
        let p = Provider {
            command: "cat".into(),
            args: vec![],
            stdin: true,
            requires_online: false,
        };
        let out = run_provider(&p, "hello-stdin").unwrap();
        assert!(out.contains("hello-stdin"));
    }
}
