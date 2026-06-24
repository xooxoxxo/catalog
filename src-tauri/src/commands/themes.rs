//! Theme commands: list/save/delete/export/import, active-theme selection, and
//! draining the .ctlgtheme files the OS queued before the webview was ready.

use super::PendingFiles;
use crate::{config, themes};

#[tauri::command]
pub(crate) fn list_themes() -> Vec<themes::Theme> {
    themes::list()
}

#[tauri::command]
pub(crate) fn save_theme(theme: themes::Theme) -> Result<(), String> {
    themes::save(theme)
}

#[tauri::command]
pub(crate) fn delete_theme(id: String) -> Result<(), String> {
    themes::delete(&id)
}

#[tauri::command]
pub(crate) fn export_theme(path: String, theme: themes::Theme) -> Result<(), String> {
    themes::export(&path, &theme)
}

#[tauri::command]
pub(crate) fn read_theme_file(path: String) -> Result<String, String> {
    themes::read_file(&path)
}

#[tauri::command]
pub(crate) fn set_active_theme(_app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut cfg = config::load_from(&config::config_path());
    cfg.active_theme = id;
    config::save_to(&config::config_path(), &cfg)
}

#[tauri::command]
pub(crate) fn take_pending_theme_files(state: tauri::State<PendingFiles>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}
