use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::State;

use crate::personas;
use crate::pty_manager::PtySession;
use crate::session::ManagedSession;
use crate::status;
use crate::stream_session::ClaudeStreamSession;
use crate::AppState;

fn ensure_cwd_is_dir(cwd: &Path) -> Result<(), String> {
    match std::fs::metadata(cwd) {
        Ok(m) if m.is_dir() => Ok(()),
        Ok(_) => Err(format!(
            "working directory is not a directory: {}",
            cwd.display()
        )),
        Err(e) => Err(format!(
            "working directory does not exist or is not accessible ({}): {}",
            cwd.display(),
            e
        )),
    }
}

#[derive(Serialize)]
pub struct NpxStatus {
    pub ok: bool,
    pub path: Option<String>,
}

#[tauri::command]
pub fn get_npx_status(state: State<'_, AppState>) -> NpxStatus {
    match state.npx_path.lock() {
        Ok(p) => NpxStatus {
            ok: p.is_some(),
            path: p.as_ref().map(|x| x.to_string_lossy().to_string()),
        },
        Err(_) => NpxStatus {
            ok: false,
            path: None,
        },
    }
}

#[tauri::command]
pub fn spawn_session(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    cwd: String,
    cmd: String,
    cmd_args: Vec<String>,
    args: Vec<String>,
) -> Result<String, String> {
    if cmd != "npx" {
        log::warn!("persona.cmd is {cmd}, expected npx — using resolved npx path anyway");
    }
    let npx: PathBuf = {
        let guard = state
            .npx_path
            .lock()
            .map_err(|_| "state lock poisoned".to_string())?;
        guard
            .clone()
            .ok_or_else(|| "npx not found — install Node.js 22+".to_string())?
    };
    let cwd_path = PathBuf::from(&cwd);
    ensure_cwd_is_dir(&cwd_path)?;
    let session_id = uuid::Uuid::new_v4().to_string();
    let session = PtySession::spawn(&app, session_id.clone(), &npx, &cwd_path, &cmd_args, &args)?;
    let mut mgr = state
        .sessions
        .lock()
        .map_err(|_| "sessions lock poisoned".to_string())?;
    mgr.insert_pty(session_id.clone(), session);
    Ok(session_id)
}

#[tauri::command]
pub fn spawn_claude_stream_session(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    cwd: String,
    cmd: String,
    cmd_args: Vec<String>,
    args: Vec<String>,
    prompt: String,
    use_continue: bool,
    resume_session_id: Option<String>,
    stream_bare: bool,
    stream_extra_args: Vec<String>,
    permission_mode: Option<String>,
    allowed_tools: Option<String>,
) -> Result<String, String> {
    if cmd != "npx" {
        log::warn!("persona.cmd is {cmd}, expected npx — using resolved npx path anyway");
    }
    let npx: PathBuf = {
        let guard = state
            .npx_path
            .lock()
            .map_err(|_| "state lock poisoned".to_string())?;
        guard
            .clone()
            .ok_or_else(|| "npx not found — install Node.js 22+".to_string())?
    };
    let cwd_path = PathBuf::from(&cwd);
    ensure_cwd_is_dir(&cwd_path)?;
    let session_id = uuid::Uuid::new_v4().to_string();
    let resume_ref = resume_session_id.as_deref();
    let pm_ref = permission_mode.as_deref();
    let tools_ref = allowed_tools.as_deref();
    let session = ClaudeStreamSession::spawn(
        &app,
        session_id.clone(),
        &npx,
        &cwd_path,
        &cmd_args,
        &prompt,
        use_continue,
        resume_ref,
        stream_bare,
        &stream_extra_args,
        pm_ref,
        tools_ref,
        &args,
    )?;
    let mut mgr = state
        .sessions
        .lock()
        .map_err(|_| "sessions lock poisoned".to_string())?;
    mgr.insert_stream(session_id.clone(), session);
    Ok(session_id)
}

#[tauri::command]
pub fn write_to_pty(
    state: State<'_, AppState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let mgr = state
        .sessions
        .lock()
        .map_err(|_| "sessions lock poisoned".to_string())?;
    let s = mgr
        .get_pty(&session_id)
        .ok_or_else(|| "unknown PTY session".to_string())?;
    s.write_bytes(&data)
}

#[tauri::command]
pub fn resize_pty(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mgr = state
        .sessions
        .lock()
        .map_err(|_| "sessions lock poisoned".to_string())?;
    let s = mgr
        .get_pty(&session_id)
        .ok_or_else(|| "unknown PTY session".to_string())?;
    s.resize(cols, rows)
}

#[tauri::command]
pub fn kill_session(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let mut mgr = state
        .sessions
        .lock()
        .map_err(|_| "sessions lock poisoned".to_string())?;
    let s = mgr
        .remove(&session_id)
        .ok_or_else(|| "unknown session".to_string())?;
    match s {
        ManagedSession::Pty(p) => p.kill_graceful(),
        ManagedSession::Stream(st) => st.kill_graceful(),
    }
}

#[tauri::command]
pub fn get_personas() -> Vec<personas::Persona> {
    personas::load_personas_from_disk()
}

#[tauri::command]
pub fn read_task_file(path: String) -> Result<Option<String>, String> {
    let p = PathBuf::from(&path);
    if !p.is_absolute() {
        return Err("task file path must be absolute".to_string());
    }
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    let h = home.to_string_lossy();
    let ps = p.to_string_lossy();
    if !ps.starts_with(h.as_ref()) {
        return Err("task file must live under home directory".to_string());
    }
    match std::fs::read_to_string(&p) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_status_line() -> Option<status::StatusUpdate> {
    status::poll_status_line_script()
}

#[tauri::command]
pub fn get_personas_config_path() -> Result<String, String> {
    personas::personas_config_path()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "no home dir".to_string())
}

fn ensure_path_under_home(path: &Path) -> Result<(), String> {
    if !path.is_absolute() {
        return Err("path must be absolute".to_string());
    }
    let home = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    let h = home.to_string_lossy();
    let ps = path.to_string_lossy();
    if !ps.starts_with(h.as_ref()) {
        return Err("path must live under home directory".to_string());
    }
    Ok(())
}

/// Reveal a file or folder in Finder (macOS) or file manager. Path must be absolute and under $HOME.
#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    ensure_path_under_home(&p)?;
    if !p.exists() {
        return Err(format!("path does not exist: {}", p.display()));
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let st = Command::new("open")
            .args(["-R", &path])
            .status()
            .map_err(|e| e.to_string())?;
        if st.success() {
            Ok(())
        } else {
            Err("open -R failed".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Err("reveal_in_finder is only supported on macOS".to_string())
    }
}

#[cfg(test)]
mod cwd_tests {
    use super::ensure_cwd_is_dir;
    use std::path::PathBuf;

    #[test]
    fn ensure_cwd_rejects_missing_path() {
        let p = PathBuf::from("/nonexistent/dino-terminal-cwd-test-9f2a1c");
        let e = ensure_cwd_is_dir(&p).expect_err("expected err");
        assert!(
            e.contains("does not exist") || e.contains("not accessible"),
            "{e}"
        );
    }

    #[test]
    fn ensure_cwd_accepts_temp_dir() {
        let tmp = std::env::temp_dir();
        ensure_cwd_is_dir(&tmp).expect("temp_dir should be a directory");
    }
}
