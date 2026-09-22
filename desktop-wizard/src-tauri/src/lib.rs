mod aqhub;
mod settings;
mod tray;
mod window_ctl;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            window_ctl::show_character,
            window_ctl::hide_character,
            window_ctl::set_character_position,
            window_ctl::exit_app,
            window_ctl::set_matrix_layout,
            aqhub::open_aqhub,
            settings::load_settings_file,
            settings::save_settings_file,
        ])
        .setup(|app| {
            if let Err(err) = tray::install(app.handle()) {
                eprintln!("AQWizard tray stub failed (expected on some VMs): {err}");
            }
            let _ = settings::restore_window(app.handle());
            if let Some(w) = app.get_webview_window("wizard") {
                let _ = w.set_always_on_top(true);
                let _ = w.set_skip_taskbar(true);
                let _ = w.set_decorations(false);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running AQWizard");
}
