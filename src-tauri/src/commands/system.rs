//! OS integration commands: URLs, man pages, Finder, clipboard, Terminal, export.

use crate::{export, sys};

#[tauri::command]
pub(crate) fn open_url(url: String) -> Result<(), String> {
    sys::open_url(&url)
}

#[tauri::command]
pub(crate) fn has_man(name: String) -> bool {
    sys::has_man(&name)
}

#[tauri::command]
pub(crate) fn get_man(name: String) -> Result<String, String> {
    sys::get_man(&name)
}

#[tauri::command]
pub(crate) fn reveal_in_finder(path: String) -> Result<(), String> {
    sys::reveal_in_finder(&path)
}

#[tauri::command]
pub(crate) fn copy_text(text: String) -> Result<(), String> {
    sys::copy_text(&text)
}

#[tauri::command]
pub(crate) fn save_export(files: Vec<export::ExportFile>) -> Result<String, String> {
    export::save(&files)
}

/// Hand a generated script off to Terminal.app: write it to a temp .sh and `open` it.
/// Runs in a real login shell (full PATH, can prompt for sudo) — output is visible to
/// the user. catalog itself never mutates the system; the user explicitly clicks Run.
#[tauri::command]
pub(crate) fn run_in_terminal(script: String) -> Result<(), String> {
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let path = std::env::temp_dir().join(format!("catalog-run-{ts}.sh"));
    let mut f = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    f.write_all(format!("#!/usr/bin/env bash\n{script}\n").as_bytes())
        .map_err(|e| e.to_string())?;
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
        .map_err(|e| e.to_string())?;
    std::process::Command::new("open")
        .args(["-a", "Terminal"])
        .arg(&path)
        .status()
        .map_err(|e| format!("failed to open Terminal: {e}"))?;
    Ok(())
}
