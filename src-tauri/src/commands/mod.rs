//! Tauri command layer.
//!
//! Each submodule holds the thin `#[tauri::command]` IPC wrappers for one
//! domain. They adapt the domain modules (scanners, store, llm, gh, …) to the
//! frontend: heavy work runs off the webview thread via `spawn_blocking` and
//! progress is streamed back as events. Business logic lives in the domain
//! modules, not here.

pub(crate) mod audits;
pub(crate) mod catalog;
pub(crate) mod config;
pub(crate) mod gh;
pub(crate) mod llm;
pub(crate) mod security;
pub(crate) mod system;
pub(crate) mod themes;

use tauri::Manager;

/// Path to the on-disk inventory cache (one SQLite db in the app data dir).
pub(crate) fn db_path(app: &tauri::AppHandle) -> String {
    let dir = app.path().app_data_dir().expect("app data dir");
    std::fs::create_dir_all(&dir).ok();
    dir.join("inventory.db").to_string_lossy().into_owned()
}

/// Generic done/total progress payload emitted during long scans.
#[derive(Clone, serde::Serialize)]
pub(crate) struct Progress {
    pub done: usize,
    pub total: usize,
}

/// File paths the OS asked us to open (.ctlgtheme) before the webview was ready.
#[derive(Default)]
pub(crate) struct PendingFiles(pub(crate) std::sync::Mutex<Vec<String>>);
