//! Core catalog commands: scan the machine, query the cache, persist enrichment.

use super::db_path;
use crate::enrichment::{self, EnrichedItem, Enrichment};
use crate::{scanners, store};

#[tauri::command]
pub(crate) async fn scan(app: tauri::AppHandle) -> Result<usize, String> {
    // Run off the main thread — scan_all shells out (brew/go/mas/plutil…) and would
    // otherwise freeze the UI for seconds on a manual rescan.
    let path = db_path(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let items = scanners::scan_all();
        let conn = store::open(&path).map_err(|e| e.to_string())?;
        store::rebuild(&conn, &items).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) fn query(app: tauri::AppHandle) -> Result<Vec<EnrichedItem>, String> {
    let conn = store::open(&db_path(&app)).map_err(|e| e.to_string())?;
    let items = store::query_all(&conn).map_err(|e| e.to_string())?;
    let estore = enrichment::load_from(&enrichment::store_path());
    Ok(items
        .iter()
        .map(|it| enrichment::merge(it, estore.get(&it.id)))
        .collect())
}

#[tauri::command]
pub(crate) fn save_enrichment(id: String, enrichment: Enrichment) -> Result<(), String> {
    let path = enrichment::store_path();
    let mut estore = enrichment::load_from(&path);
    estore.set(id, enrichment);
    enrichment::save_to(&path, &estore)
}
