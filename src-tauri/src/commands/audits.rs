//! Audit commands: updates, disk usage, doctor, dependency checks.

use super::{db_path, Progress};
use crate::{deps, disk, doctor, store, updates};
use tauri::Emitter;

#[derive(Clone, serde::Serialize)]
struct UpdateProgress {
    source: String,
    status: String,
    count: usize,
}

#[tauri::command]
pub(crate) async fn check_updates(app: tauri::AppHandle) -> Vec<updates::Update> {
    use tauri::async_runtime::spawn_blocking;

    fn source(
        app: tauri::AppHandle,
        name: &'static str,
        f: fn() -> Vec<updates::Update>,
    ) -> tauri::async_runtime::JoinHandle<Vec<updates::Update>> {
        spawn_blocking(move || {
            let _ = app.emit(
                "updates-progress",
                UpdateProgress {
                    source: name.into(),
                    status: "checking".into(),
                    count: 0,
                },
            );
            let v = f();
            let _ = app.emit(
                "updates-progress",
                UpdateProgress {
                    source: name.into(),
                    status: "done".into(),
                    count: v.len(),
                },
            );
            v
        })
    }

    // all three start immediately (concurrent on the blocking pool)
    let handles = [
        source(app.clone(), "brew", updates::check_brew),
        source(app.clone(), "npm", updates::check_npm),
        source(app.clone(), "mas", updates::check_mas),
    ];
    let mut out = Vec::new();
    for h in handles {
        if let Ok(v) = h.await {
            out.extend(v);
        }
    }
    out
}

#[tauri::command]
pub(crate) async fn analyze_disk(app: tauri::AppHandle) -> Result<Vec<disk::DiskInfo>, String> {
    let path = db_path(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let conn = store::open(&path).map_err(|e| e.to_string())?;
        let items = store::query_all(&conn).map_err(|e| e.to_string())?;
        let app2 = app.clone();
        let infos = disk::analyze(&items, move |done, total| {
            let _ = app2.emit("disk-progress", Progress { done, total });
        });
        Ok(infos)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) fn run_doctor() -> doctor::DoctorReport {
    doctor::run_doctor()
}

#[tauri::command]
pub(crate) fn check_deps() -> Vec<deps::Dep> {
    deps::check_deps()
}
