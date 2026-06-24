//! GitHub commands: device-flow auth, status, and stars/README browsing.
//!
//! All gh_* commands hit the network via curl — async + spawn_blocking so they
//! never block the webview thread (list_stars paginates ≤20× and would beachball).

use crate::gh;

#[tauri::command]
pub(crate) async fn gh_device_start(client_id: String) -> Result<gh::DeviceCode, String> {
    tauri::async_runtime::spawn_blocking(move || gh::device_start(&client_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn gh_device_poll(
    client_id: String,
    device_code: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        gh::device_poll(&client_id, &device_code).map(|s| s.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn gh_status() -> gh::GithubStatus {
    tauri::async_runtime::spawn_blocking(gh::status)
        .await
        .unwrap_or(gh::GithubStatus {
            connected: false,
            login: None,
            avatar_url: None,
        })
}

#[tauri::command]
pub(crate) fn gh_disconnect() -> Result<(), String> {
    gh::disconnect()
}

#[tauri::command]
pub(crate) async fn gh_list_stars() -> Vec<gh::Repo> {
    tauri::async_runtime::spawn_blocking(|| gh::list_stars().unwrap_or_default())
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub(crate) async fn gh_readme(owner: String, repo: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || gh::readme(&owner, &repo))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn gh_star(owner: String, repo: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || gh::star(&owner, &repo))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn gh_unstar(owner: String, repo: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || gh::unstar(&owner, &repo))
        .await
        .map_err(|e| e.to_string())?
}
