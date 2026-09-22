use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const AQHUB_ORIGIN: &str = "http://127.0.0.1:8766";

fn aqhub_url(path: &str) -> Result<String, String> {
    let p = path.trim();
    if !p.starts_with('/') {
        return Err("path must start with /".into());
    }
    if p.contains("://") || p.contains('\\') || p.contains("..") {
        return Err("bad_path".into());
    }
    Ok(format!("{AQHUB_ORIGIN}{p}"))
}

fn open_url(app: &AppHandle, url: &str) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_aqhub(app: AppHandle) -> Result<(), String> {
    open_url(&app, &aqhub_url("/board.html")?)
}

#[tauri::command]
pub fn open_aqhub_path(app: AppHandle, path: String) -> Result<(), String> {
    open_url(&app, &aqhub_url(&path)?)
}

#[cfg(test)]
mod tests {
    use super::aqhub_url;

    #[test]
    fn eisenhower_url() {
        assert_eq!(
            aqhub_url("/eisenhower.html").unwrap(),
            "http://127.0.0.1:8766/eisenhower.html"
        );
    }

    #[test]
    fn rejects_absolute_and_parent_paths() {
        assert!(aqhub_url("http://evil.example/x").is_err());
        assert!(aqhub_url("/../etc/passwd").is_err());
        assert!(aqhub_url("eisenhower.html").is_err());
    }
}
