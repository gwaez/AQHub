use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn show_character(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("wizard") {
        w.show().map_err(|e| e.to_string())?;
        let _ = w.set_always_on_top(true);
        let _ = w.set_skip_taskbar(true);
    }
    Ok(())
}

#[tauri::command]
pub fn hide_character(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("wizard") {
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_character_position(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("wizard") {
        w.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}
