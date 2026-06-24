mod config;
mod deps;
mod disk;
mod doctor;
mod enrichment;
mod export;
mod gh;
mod item;
mod llm;
mod nvd;
mod scanners;
mod security;
mod store;
mod sys;
mod themes;
mod updates;

use enrichment::{Enrichment, EnrichedItem};
use llm::Suggestion;
use tauri::{Manager, Emitter};

fn db_path(app: &tauri::AppHandle) -> String {
    let dir = app.path().app_data_dir().expect("app data dir");
    std::fs::create_dir_all(&dir).ok();
    dir.join("inventory.db").to_string_lossy().into_owned()
}

#[tauri::command]
async fn scan(app: tauri::AppHandle) -> Result<usize, String> {
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
fn query(app: tauri::AppHandle) -> Result<Vec<EnrichedItem>, String> {
    let conn = store::open(&db_path(&app)).map_err(|e| e.to_string())?;
    let items = store::query_all(&conn).map_err(|e| e.to_string())?;
    let estore = enrichment::load_from(&enrichment::store_path());
    Ok(items.iter().map(|it| enrichment::merge(it, estore.get(&it.id))).collect())
}

#[tauri::command]
fn save_enrichment(id: String, enrichment: Enrichment) -> Result<(), String> {
    let path = enrichment::store_path();
    let mut estore = enrichment::load_from(&path);
    estore.set(id, enrichment);
    enrichment::save_to(&path, &estore)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    sys::open_url(&url)
}

#[tauri::command]
fn has_man(name: String) -> bool {
    sys::has_man(&name)
}

#[tauri::command]
fn get_man(name: String) -> Result<String, String> {
    sys::get_man(&name)
}

#[tauri::command]
async fn llm_describe(app: tauri::AppHandle, id: String) -> Result<Suggestion, String> {
    // async + spawn_blocking: the provider CLI can take many seconds — keep it off the webview thread.
    let path = db_path(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let conn = store::open(&path).map_err(|e| e.to_string())?;
        let item = store::get(&conn, &id).map_err(|e| e.to_string())?.ok_or("item not found in cache")?;
        llm::describe(&item)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    sys::reveal_in_finder(&path)
}

#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    sys::copy_text(&text)
}

#[tauri::command]
fn get_config() -> config::Config {
    config::load_from(&config::config_path())
}

#[tauri::command]
fn save_config(config: config::Config) -> Result<(), String> {
    config::save_to(&config::config_path(), &config)
}

#[tauri::command]
fn check_online() -> bool {
    llm::check_online()
}

#[derive(Clone, serde::Serialize)]
struct UpdateProgress { source: String, status: String, count: usize }

#[tauri::command]
async fn check_updates(app: tauri::AppHandle) -> Vec<updates::Update> {
    use tauri::async_runtime::spawn_blocking;

    fn source(app: tauri::AppHandle, name: &'static str, f: fn() -> Vec<updates::Update>)
        -> tauri::async_runtime::JoinHandle<Vec<updates::Update>>
    {
        spawn_blocking(move || {
            let _ = app.emit("updates-progress", UpdateProgress { source: name.into(), status: "checking".into(), count: 0 });
            let v = f();
            let _ = app.emit("updates-progress", UpdateProgress { source: name.into(), status: "done".into(), count: v.len() });
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
    for h in handles { if let Ok(v) = h.await { out.extend(v); } }
    out
}

#[derive(Clone, serde::Serialize)]
struct Progress { done: usize, total: usize }

#[tauri::command]
async fn analyze_disk(app: tauri::AppHandle) -> Result<Vec<disk::DiskInfo>, String> {
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
fn run_doctor() -> doctor::DoctorReport {
    doctor::run_doctor()
}

#[tauri::command]
fn save_export(files: Vec<export::ExportFile>) -> Result<String, String> {
    export::save(&files)
}

#[tauri::command]
async fn scan_security(app: tauri::AppHandle) -> Result<Vec<security::SecurityFinding>, String> {
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
async fn llm_describe_batch(app: tauri::AppHandle, ids: Vec<String>) -> Result<std::collections::BTreeMap<String, llm::Suggestion>, String> {
    let path = db_path(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let conn = store::open(&path).map_err(|e| e.to_string())?;
        let mut items = Vec::new();
        for id in &ids {
            if let Some(it) = store::get(&conn, id).map_err(|e| e.to_string())? { items.push(it); }
        }
        if items.is_empty() { return Ok(std::collections::BTreeMap::new()); }
        llm::describe_batch(&items)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn scan_homebrew_cves(app: tauri::AppHandle) -> Result<Vec<security::SecurityFinding>, String> {
    let key = config::load_from(&config::config_path()).nvd_api_key;
    if key.trim().is_empty() { return Err("Add an NVD API key in Settings first.".into()); }
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

#[tauri::command]
fn check_deps() -> Vec<deps::Dep> {
    deps::check_deps()
}

// All gh_* commands hit the network via curl — async + spawn_blocking so they
// never block the webview thread (list_stars paginates ≤20× and would beachball).
#[tauri::command]
async fn gh_device_start(client_id: String) -> Result<gh::DeviceCode, String> {
    tauri::async_runtime::spawn_blocking(move || gh::device_start(&client_id)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn gh_device_poll(client_id: String, device_code: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || gh::device_poll(&client_id, &device_code).map(|s| s.to_string()))
        .await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn gh_status() -> gh::GithubStatus {
    tauri::async_runtime::spawn_blocking(gh::status).await
        .unwrap_or(gh::GithubStatus { connected: false, login: None, avatar_url: None })
}

#[tauri::command]
fn gh_disconnect() -> Result<(), String> { gh::disconnect() }

/// File paths the OS asked us to open (.ctlgtheme) before the webview was ready.
#[derive(Default)]
struct PendingFiles(std::sync::Mutex<Vec<String>>);

#[tauri::command]
fn take_pending_theme_files(state: tauri::State<PendingFiles>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[tauri::command]
async fn llm_theme(vibe: String, base: String) -> Result<std::collections::BTreeMap<String, String>, String> {
    tauri::async_runtime::spawn_blocking(move || llm::theme_palette(&vibe, &base)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn list_themes() -> Vec<themes::Theme> { themes::list() }
#[tauri::command]
fn save_theme(theme: themes::Theme) -> Result<(), String> { themes::save(theme) }
#[tauri::command]
fn delete_theme(id: String) -> Result<(), String> { themes::delete(&id) }
#[tauri::command]
fn export_theme(path: String, theme: themes::Theme) -> Result<(), String> { themes::export(&path, &theme) }
#[tauri::command]
fn read_theme_file(path: String) -> Result<String, String> { themes::read_file(&path) }
#[tauri::command]
fn set_active_theme(_app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut cfg = config::load_from(&config::config_path());
    cfg.active_theme = id;
    config::save_to(&config::config_path(), &cfg)
}

/// Hand a generated script off to Terminal.app: write it to a temp .sh and `open` it.
/// Runs in a real login shell (full PATH, can prompt for sudo) — output is visible to
/// the user. catalog itself never mutates the system; the user explicitly clicks Run.
#[tauri::command]
fn run_in_terminal(script: String) -> Result<(), String> {
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let path = std::env::temp_dir().join(format!("catalog-run-{ts}.sh"));
    let mut f = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    f.write_all(format!("#!/usr/bin/env bash\n{script}\n").as_bytes()).map_err(|e| e.to_string())?;
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
    std::process::Command::new("open").args(["-a", "Terminal"]).arg(&path)
        .status().map_err(|e| format!("failed to open Terminal: {e}"))?;
    Ok(())
}

#[tauri::command]
async fn gh_list_stars() -> Vec<gh::Repo> {
    tauri::async_runtime::spawn_blocking(|| gh::list_stars().unwrap_or_default()).await.unwrap_or_default()
}

#[tauri::command]
async fn gh_readme(owner: String, repo: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || gh::readme(&owner, &repo)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn gh_star(owner: String, repo: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || gh::star(&owner, &repo)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn gh_unstar(owner: String, repo: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || gh::unstar(&owner, &repo)).await.map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::{Emitter, Manager};
    config::migrate_legacy_dir(); // rebrand: carry ~/.config/tooldex → ~/.config/catalog
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(PendingFiles::default())
        .invoke_handler(tauri::generate_handler![scan, query, save_enrichment, open_url, has_man, get_man, llm_describe, reveal_in_finder, copy_text, get_config, save_config, check_online, check_updates, run_doctor, analyze_disk, save_export, scan_security, check_deps, run_in_terminal, gh_device_start, gh_device_poll, gh_status, gh_disconnect, gh_list_stars, gh_readme, gh_star, gh_unstar, list_themes, save_theme, delete_theme, export_theme, read_theme_file, set_active_theme, llm_theme, take_pending_theme_files, scan_homebrew_cves, llm_describe_batch])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls.iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                if paths.is_empty() { return; }
                app.state::<PendingFiles>().0.lock().unwrap().extend(paths.clone());
                let _ = app.emit("open-theme-files", paths);
            }
        });
}
