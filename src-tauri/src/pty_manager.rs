use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use log::{error, warn};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyDataPayload {
    pub session_id: String,
    pub data_b64: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyExitPayload {
    pub session_id: String,
    pub code: Option<i32>,
}

pub struct PtySession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

impl PtySession {
    pub fn spawn(
        app: &AppHandle,
        session_id: String,
        npx: &Path,
        cwd: &Path,
        cmd_args: &[String],
        extra_args: &[String],
    ) -> Result<Self, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let prog = npx
            .to_str()
            .ok_or_else(|| "npx path is not valid UTF-8".to_string())?;
        let mut cmd = CommandBuilder::new(prog);
        cmd.cwd(cwd);
        for a in cmd_args {
            cmd.arg(a);
        }
        for a in extra_args {
            cmd.arg(a);
        }
        cmd.env("DISABLE_AUTOUPDATER", "1");
        cmd.env("DO_NOT_TRACK", "1");
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("PATH", crate::npx::path_env_for_npx_spawn(npx));

        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

        let master = pair.master;
        let mut reader = master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = master.take_writer().map_err(|e| e.to_string())?;

        let master: Arc<Mutex<Box<dyn MasterPty + Send>>> = Arc::new(Mutex::new(master));

        let writer = Arc::new(Mutex::new(writer));
        let child_wrapped: Arc<Mutex<Box<dyn Child + Send + Sync>>> = Arc::new(Mutex::new(child));

        let app_clone = app.clone();
        let sid = session_id.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 64 * 1024];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = app_clone.emit(
                            "pty:exit",
                            PtyExitPayload {
                                session_id: sid.clone(),
                                code: None,
                            },
                        );
                        break;
                    }
                    Ok(n) => {
                        let payload = PtyDataPayload {
                            session_id: sid.clone(),
                            data_b64: STANDARD.encode(&buf[..n]),
                        };
                        if let Err(e) = app_clone.emit("pty:data", payload) {
                            error!("pty:data emit failed for session {sid}: {e}");
                            break;
                        }
                    }
                    Err(e) => {
                        warn!("pty read error: {e}");
                        let _ = app_clone.emit(
                            "pty:exit",
                            PtyExitPayload {
                                session_id: sid.clone(),
                                code: None,
                            },
                        );
                        break;
                    }
                }
            }
        });

        Ok(Self {
            writer,
            master,
            child: child_wrapped,
        })
    }

    pub fn write_bytes(&self, data: &[u8]) -> Result<(), String> {
        let mut w = self.writer.lock().map_err(|_| "writer lock poisoned")?;
        w.write_all(data).map_err(|e| e.to_string())?;
        w.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let m = self.master.lock().map_err(|_| "master lock poisoned")?;
        m.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn kill_graceful(&self) -> Result<(), String> {
        let mut child = self.child.lock().map_err(|_| "child lock poisoned")?;
        #[cfg(unix)]
        {
            use nix::sys::signal::{kill, Signal};
            use nix::unistd::Pid;
            if let Some(pid) = child.process_id() {
                let _ = kill(Pid::from_raw(pid as i32), Signal::SIGTERM);
            }
            // Bounded grace (~1s): poll try_wait every 100ms instead of blocking 3s.
            for _ in 0..10 {
                thread::sleep(std::time::Duration::from_millis(100));
                match child.try_wait() {
                    Ok(Some(_)) => return Ok(()),
                    Ok(None) => {}
                    Err(_) => break,
                }
            }
        }
        #[cfg(not(unix))]
        {
            thread::sleep(std::time::Duration::from_millis(400));
        }
        let _ = child.kill();
        Ok(())
    }
}
