use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use log::{error, warn};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const STDERR_CAP: usize = 2048;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeStreamLinePayload {
    pub session_id: String,
    pub line: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeStreamStderrPayload {
    pub session_id: String,
    pub text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeStreamExitPayload {
    pub session_id: String,
    pub code: Option<i32>,
}

pub struct ClaudeStreamSession {
    child: Arc<Mutex<Option<Child>>>,
}

impl ClaudeStreamSession {
    #[allow(clippy::too_many_arguments)]
    pub fn spawn(
        app: &AppHandle,
        session_id: String,
        npx: &Path,
        cwd: &Path,
        cmd_args: &[String],
        prompt: &str,
        use_continue: bool,
        resume_session_id: Option<&str>,
        stream_bare: bool,
        stream_extra_args: &[String],
        permission_mode: Option<&str>,
        allowed_tools: Option<&str>,
        extra_args: &[String],
    ) -> Result<Self, String> {
        let prog = npx
            .to_str()
            .ok_or_else(|| "npx path is not valid UTF-8".to_string())?;

        let mut cmd = Command::new(prog);
        cmd.current_dir(cwd);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.env("PATH", crate::npx::path_env_for_npx_spawn(npx));
        cmd.env("DISABLE_AUTOUPDATER", "1");
        cmd.env("DO_NOT_TRACK", "1");
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        for a in cmd_args {
            cmd.arg(a);
        }

        if stream_bare {
            cmd.arg("--bare");
        }
        cmd.arg("-p");
        cmd.arg(prompt);
        cmd.args(["--output-format", "stream-json"]);
        cmd.arg("--verbose");
        cmd.arg("--include-partial-messages");

        if let Some(id) = resume_session_id {
            if !id.is_empty() {
                cmd.arg("--resume");
                cmd.arg(id);
            }
        } else if use_continue {
            cmd.arg("--continue");
        }
        if let Some(pm) = permission_mode {
            if !pm.is_empty() {
                cmd.arg("--permission-mode");
                cmd.arg(pm);
            }
        }
        if let Some(tools) = allowed_tools {
            if !tools.is_empty() {
                cmd.arg("--allowedTools");
                cmd.arg(tools);
            }
        }
        for a in stream_extra_args {
            cmd.arg(a);
        }
        for a in extra_args {
            cmd.arg(a);
        }

        let mut child =
            cmd.spawn()
                .map_err(|e| format!("failed to spawn npx (Claude Code stream): {e}"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "stream stdout missing".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "stream stderr missing".to_string())?;

        let child = Arc::new(Mutex::new(Some(child)));

        let app_out = app.clone();
        let sid_out = session_id.clone();
        let child_out = Arc::clone(&child);
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line_res in reader.lines() {
                let line = match line_res {
                    Ok(l) => l,
                    Err(e) => {
                        warn!("claude stream stdout read error: {e}");
                        break;
                    }
                };
                if line.is_empty() {
                    continue;
                }
                if let Err(e) = app_out.emit(
                    "claude-stream:line",
                    ClaudeStreamLinePayload {
                        session_id: sid_out.clone(),
                        line,
                    },
                ) {
                    error!("claude-stream:line emit failed: {e}");
                    break;
                }
            }
            let code = {
                let mut g = match child_out.lock() {
                    Ok(x) => x,
                    Err(_) => {
                        let _ = app_out.emit(
                            "claude-stream:exit",
                            ClaudeStreamExitPayload {
                                session_id: sid_out.clone(),
                                code: None,
                            },
                        );
                        return;
                    }
                };
                if let Some(mut c) = g.take() {
                    c.wait().ok().and_then(|s| s.code())
                } else {
                    None
                }
            };
            let _ = app_out.emit(
                "claude-stream:exit",
                ClaudeStreamExitPayload {
                    session_id: sid_out,
                    code,
                },
            );
        });

        let app_err = app.clone();
        let sid_err = session_id.clone();
        thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut buf = String::new();
            loop {
                buf.clear();
                match reader.read_line(&mut buf) {
                    Ok(0) => break,
                    Ok(_) => {
                        let t = buf.trim_end();
                        if t.is_empty() {
                            continue;
                        }
                        let truncated = if t.len() > STDERR_CAP {
                            format!("{}…", &t[..STDERR_CAP])
                        } else {
                            t.to_string()
                        };
                        let _ = app_err.emit(
                            "claude-stream:stderr",
                            ClaudeStreamStderrPayload {
                                session_id: sid_err.clone(),
                                text: truncated,
                            },
                        );
                    }
                    Err(e) => {
                        warn!("claude stream stderr read error: {e}");
                        break;
                    }
                }
            }
        });

        Ok(Self { child })
    }

    pub fn kill_graceful(&self) -> Result<(), String> {
        let mut guard = self.child.lock().map_err(|_| "child lock poisoned")?;
        let Some(mut child) = guard.take() else {
            return Ok(());
        };
        #[cfg(unix)]
        {
            use nix::sys::signal::{kill, Signal};
            use nix::unistd::Pid;
            let pid = child.id();
            if pid > 0 {
                let _ = kill(Pid::from_raw(pid as i32), Signal::SIGTERM);
            }
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
        let _ = child.wait();
        Ok(())
    }
}
