mod commands;
mod npx;
mod personas;
mod pty_manager;
mod session;
mod status;

use std::sync::Mutex;

use tauri::{AppHandle, Manager};

pub struct AppState {
    pub npx_path: Mutex<Option<std::path::PathBuf>>,
    pub sessions: Mutex<session::SessionManager>,
}

fn kill_all_sessions(app: &AppHandle) {
    let state = app.state::<AppState>();
    let Ok(mut mgr) = state.sessions.lock() else {
        return;
    };
    mgr.kill_all();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(AppState {
            npx_path: Mutex::new(None),
            sessions: Mutex::new(session::SessionManager::new()),
        })
        .setup(|app| {
            let resolved = npx::resolve_npx_path();
            if resolved.is_none() {
                log::warn!("npx not found on PATH at startup");
            }
            let state = app.state::<AppState>();
            if let Ok(mut g) = state.npx_path.lock() {
                *g = resolved;
            }

            let handle = app.handle().clone();
            if let Some(win) = app.get_webview_window("main") {
                win.on_window_event(move |ev| {
                    if let tauri::WindowEvent::CloseRequested { .. } = ev {
                        kill_all_sessions(&handle);
                    }
                });
                match tauri::image::Image::from_bytes(include_bytes!("../icons/128x128.png")) {
                    Ok(icon) => {
                        if let Err(e) = win.set_icon(icon) {
                            log::warn!("set window icon failed: {e}");
                        }
                    }
                    Err(e) => log::warn!("decode window icon failed: {e}"),
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_npx_status,
            commands::spawn_session,
            commands::write_to_pty,
            commands::resize_pty,
            commands::kill_session,
            commands::get_personas,
            commands::read_task_file,
            commands::get_status_line,
            commands::get_personas_config_path,
            commands::reveal_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
