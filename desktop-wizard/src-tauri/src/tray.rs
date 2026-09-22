use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter,
};

use crate::aqhub;
use crate::window_ctl;

fn emit_action(app: &AppHandle, action: &str) {
    let _ = app.emit("wizard://action", action);
}

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "إظهار", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "إخفاء", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "الإعدادات", true, None::<&str>)?;
    let eisenhower = MenuItem::with_id(app, "eisenhower", "أيزنهاور", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "فتح AQHub", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let exit = MenuItem::with_id(app, "exit", "خروج", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&show, &hide, &settings, &eisenhower, &open, &sep, &exit],
    )?;

    let Some(icon) = app.default_window_icon().cloned() else {
        eprintln!("AQWizard: no window icon; skipping tray");
        return Ok(());
    };

    TrayIconBuilder::with_id("aqwizard")
        .icon(icon)
        .tooltip("AQWizard")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                let _ = window_ctl::show_character(app.clone());
                emit_action(app, "SHOW");
            }
            "hide" => {
                let _ = window_ctl::hide_character(app.clone());
                emit_action(app, "HIDE");
            }
            "settings" => {
                let _ = window_ctl::show_character(app.clone());
                emit_action(app, "SETTINGS");
            }
            "eisenhower" => {
                let _ = aqhub::open_aqhub_path(app.clone(), "/eisenhower.html".to_string());
            }
            "open" => {
                let _ = aqhub::open_aqhub(app.clone());
            }
            "exit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
