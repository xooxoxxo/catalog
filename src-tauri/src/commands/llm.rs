//! LLM enrichment commands: describe one/many tools, online check, theme palette.

use super::db_path;
use crate::llm::{self, Suggestion};
use crate::store;

#[tauri::command]
pub(crate) fn check_online() -> bool {
    llm::check_online()
}

#[tauri::command]
pub(crate) async fn llm_describe(app: tauri::AppHandle, id: String) -> Result<Suggestion, String> {
    // async + spawn_blocking: the provider CLI can take many seconds — keep it off the webview thread.
    let path = db_path(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let conn = store::open(&path).map_err(|e| e.to_string())?;
        let item = store::get(&conn, &id)
            .map_err(|e| e.to_string())?
            .ok_or("item not found in cache")?;
        llm::describe(&item)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn llm_describe_batch(
    app: tauri::AppHandle,
    ids: Vec<String>,
) -> Result<std::collections::BTreeMap<String, llm::Suggestion>, String> {
    let path = db_path(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let conn = store::open(&path).map_err(|e| e.to_string())?;
        let mut items = Vec::new();
        for id in &ids {
            if let Some(it) = store::get(&conn, id).map_err(|e| e.to_string())? {
                items.push(it);
            }
        }
        if items.is_empty() {
            return Ok(std::collections::BTreeMap::new());
        }
        llm::describe_batch(&items)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn llm_theme(
    vibe: String,
    base: String,
) -> Result<std::collections::BTreeMap<String, String>, String> {
    tauri::async_runtime::spawn_blocking(move || llm::theme_palette(&vibe, &base))
        .await
        .map_err(|e| e.to_string())?
}
