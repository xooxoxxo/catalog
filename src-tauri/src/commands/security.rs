//! Security audit commands: OSV scan and the Homebrew/NVD CVE pass.

use super::{db_path, Progress};
use crate::{config, nvd, security, store};
use tauri::Emitter;

#[tauri::command]
pub(crate) async fn scan_security(
    app: tauri::AppHandle,
) -> Result<Vec<security::SecurityFinding>, String> {
    let path = db_path(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let conn = store::open(&path).map_err(|e| e.to_string())?;
        let items = store::query_all(&conn).map_err(|e| e.to_string())?;
        let app2 = app.clone();
        let findings = security::scan(&items, move |done, total| {
            let _ = app2.emit("security-progress", Progress { done, total });
        });
        Ok(findings)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn scan_homebrew_cves(
    app: tauri::AppHandle,
) -> Result<Vec<security::SecurityFinding>, String> {
    let key = config::load_from(&config::config_path()).nvd_api_key;
    if key.trim().is_empty() {
        return Err("Add an NVD API key in Settings first.".into());
    }
    let path = db_path(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let conn = store::open(&path).map_err(|e| e.to_string())?;
        let items = store::query_all(&conn).map_err(|e| e.to_string())?;
        let app2 = app.clone();
        let findings = nvd::scan(&items, &key, move |done, total| {
            let _ = app2.emit("nvd-progress", Progress { done, total });
        });
        Ok(findings)
    })
    .await
    .map_err(|e| e.to_string())?
}
