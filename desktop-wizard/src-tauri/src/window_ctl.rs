use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn show_character(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("wizard") {
        w.show().map_err(|e| e.to_string())?;
        let _ = w.set_always_on_top(true);
        let _ = w.set_skip_taskbar(true);
        let _ = w.set_ignore_cursor_events(false);
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

fn apply_expanded_layout(app: &AppHandle, open: bool, width: f64, height: f64) -> Result<(), String> {
    let Some(w) = app.get_webview_window("wizard") else {
        return Ok(());
    };
    if open {
        w.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
            .map_err(|e| e.to_string())?;
        let _ = w.set_resizable(true);
    } else {
        let _ = w.set_resizable(false);
        w.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 380.0,
            height: 560.0,
        }))
        .map_err(|e| e.to_string())?;
    }
    let _ = w.set_always_on_top(true);
    Ok(())
}

#[tauri::command]
pub fn set_matrix_layout(app: AppHandle, open: bool) -> Result<(), String> {
    apply_expanded_layout(&app, open, 920.0, 640.0)
}

#[tauri::command]
pub fn set_settings_layout(app: AppHandle, open: bool) -> Result<(), String> {
    apply_expanded_layout(&app, open, 720.0, 680.0)
}

#[tauri::command]
pub fn set_always_on_top(app: AppHandle, on: bool) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("wizard") {
        w.set_always_on_top(on).map_err(|e| e.to_string())?;
    }
    Ok(())
}
