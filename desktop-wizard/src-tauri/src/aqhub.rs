use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const AQHUB_BOARD: &str = "http://127.0.0.1:8766/board.html";

pub fn open_in_browser(app: &AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(AQHUB_BOARD, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_aqhub(app: AppHandle) -> Result<(), String> {
    open_in_browser(&app)
}
