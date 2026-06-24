mod commands;
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

use commands::PendingFiles;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    config::migrate_legacy_dir(); // rebrand: carry ~/.config/tooldex → ~/.config/catalog
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(PendingFiles::default())
        .invoke_handler(tauri::generate_handler![
            commands::catalog::scan,
            commands::catalog::query,
            commands::catalog::save_enrichment,
            commands::system::open_url,
            commands::system::has_man,
            commands::system::get_man,
            commands::llm::llm_describe,
            commands::system::reveal_in_finder,
            commands::system::copy_text,
            commands::config::get_config,
            commands::config::save_config,
            commands::llm::check_online,
            commands::audits::check_updates,
            commands::audits::run_doctor,
            commands::audits::analyze_disk,
            commands::system::save_export,
            commands::security::scan_security,
            commands::audits::check_deps,
            commands::system::run_in_terminal,
            commands::gh::gh_device_start,
            commands::gh::gh_device_poll,
            commands::gh::gh_status,
            commands::gh::gh_disconnect,
            commands::gh::gh_list_stars,
            commands::gh::gh_readme,
            commands::gh::gh_star,
            commands::gh::gh_unstar,
            commands::themes::list_themes,
            commands::themes::save_theme,
            commands::themes::delete_theme,
            commands::themes::export_theme,
            commands::themes::read_theme_file,
            commands::themes::set_active_theme,
            commands::llm::llm_theme,
            commands::themes::take_pending_theme_files,
            commands::security::scan_homebrew_cves,
            commands::llm::llm_describe_batch
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                if paths.is_empty() {
                    return;
                }
                app.state::<PendingFiles>()
                    .0
                    .lock()
                    .unwrap()
                    .extend(paths.clone());
                let _ = app.emit("open-theme-files", paths);
            }
        });
}
