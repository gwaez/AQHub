use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowSettings {
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub scale: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WizardSettings {
    pub version: Option<u32>,
    pub character_id: Option<String>,
    pub technical_id: Option<String>,
    pub display_name: Option<String>,
    pub window: Option<WindowSettings>,
    pub visible: Option<bool>,
    #[serde(default)]
    pub animation_level: Option<String>,
    #[serde(default)]
    pub idle_sleep_ms: Option<u64>,
    #[serde(default)]
    pub reminders: Option<Vec<Reminder>>,
    pub updated_at: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub start_minimized: Option<bool>,
    #[serde(default)]
    pub always_on_top: Option<bool>,
    #[serde(default)]
    pub opacity: Option<f64>,
    #[serde(default)]
    pub follow_pointer: Option<bool>,
    #[serde(default)]
    pub roam_enabled: Option<bool>,
    #[serde(default)]
    pub preferred_corner: Option<String>,
    #[serde(default)]
    pub proactive_bubbles: Option<String>,
    #[serde(default)]
    pub bubble_scale: Option<f64>,
    #[serde(default)]
    pub bubble_font_size: Option<f64>,
    #[serde(default)]
    pub close_action: Option<String>,
    #[serde(default)]
    pub permissions: Option<HashMap<String, String>>,
    #[serde(default)]
    pub mail_last_sync_at: Option<String>,
    #[serde(default)]
    pub mail_ignored: Option<Vec<String>>,
    #[serde(default)]
    pub first_run_complete: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub id: Option<String>,
    pub text: Option<String>,
    pub due_at: Option<String>,
    pub fired: Option<bool>,
}

fn looks_like_aqhub(root: &Path) -> bool {
    root.join("Start-Board.ps1").is_file() && root.join("board.html").is_file()
}

pub fn find_aqhub_root() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("AQHUB_ROOT") {
        let pb = PathBuf::from(p);
        if looks_like_aqhub(&pb) {
            return Some(pb);
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.clone());
        candidates.push(cwd.join(".."));
        candidates.push(cwd.join("..").join(".."));
        candidates.push(cwd.join("..").join("..").join(".."));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.to_path_buf());
            candidates.push(dir.join(".."));
            candidates.push(dir.join("..").join(".."));
        }
    }
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME"));
    if let Ok(home) = home {
        let h = PathBuf::from(home);
        candidates.push(h.join("Documents").join("AQHub"));
        candidates.push(h.join("Documents").join("AqaarWorkBoard"));
    }

    for c in candidates {
        if looks_like_aqhub(&c) {
            return Some(c);
        }
    }
    None
}

fn settings_path() -> Result<PathBuf, String> {
    let root = find_aqhub_root().ok_or_else(|| "aqhub_root_not_found".to_string())?;
    let path = root.join("data").join("wizard-settings.json");
    if path.file_name().and_then(|n| n.to_str()) != Some("wizard-settings.json") {
        return Err("refusing_non_wizard_settings_path".into());
    }
    Ok(path)
}

fn read_settings() -> Result<WizardSettings, String> {
    let path = settings_path()?;
    if !path.is_file() {
        return Ok(WizardSettings {
            version: Some(1),
            character_id: Some("old-wizard".into()),
            technical_id: Some("AQWizard".into()),
            display_name: Some("Old Wizard".into()),
            window: Some(WindowSettings {
                x: None,
                y: None,
                scale: Some(1.0),
            }),
            visible: Some(true),
            animation_level: Some("normal".into()),
            idle_sleep_ms: Some(90_000),
            reminders: Some(Vec::new()),
            updated_at: Some(String::new()),
            language: Some("ar".into()),
            start_minimized: Some(false),
            always_on_top: Some(true),
            opacity: Some(1.0),
            follow_pointer: Some(true),
            roam_enabled: Some(true),
            preferred_corner: Some("bottom-end".into()),
            proactive_bubbles: Some("normal".into()),
            bubble_scale: Some(1.0),
            bubble_font_size: Some(13.0),
            close_action: Some("hide".into()),
            permissions: None,
            mail_last_sync_at: Some(String::new()),
            mail_ignored: Some(Vec::new()),
            first_run_complete: Some(false),
        });
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_settings_file() -> Result<WizardSettings, String> {
    read_settings()
}

#[tauri::command]
pub fn save_settings_file(settings: WizardSettings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    // Never write tasks.json / eisenhower / crm-config.
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if name != "wizard-settings.json" {
        return Err("refusing_non_wizard_settings_path".into());
    }
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

pub fn restore_window(app: &AppHandle) -> tauri::Result<()> {
    let Ok(settings) = read_settings() else {
        return Ok(());
    };
    let Some(w) = app.get_webview_window("wizard") else {
        return Ok(());
    };
    if let Some(win) = settings.window {
        if let (Some(x), Some(y)) = (win.x, win.y) {
            let _ = w.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }
    }
    if settings.start_minimized == Some(true) || settings.visible == Some(false) {
        let _ = w.hide();
    } else {
        let _ = w.show();
        let on_top = settings.always_on_top.unwrap_or(true);
        let _ = w.set_always_on_top(on_top);
        let _ = w.set_skip_taskbar(true);
    }
    Ok(())
}

pub fn close_should_hide() -> bool {
    match read_settings() {
        Ok(s) => s.close_action.as_deref() != Some("exit"),
        Err(_) => true,
    }
}
