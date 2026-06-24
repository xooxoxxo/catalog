//! App configuration commands.

use crate::config;

#[tauri::command]
pub(crate) fn get_config() -> config::Config {
    config::load_from(&config::config_path())
}

#[tauri::command]
pub(crate) fn save_config(config: config::Config) -> Result<(), String> {
    config::save_to(&config::config_path(), &config)
}
