use std::path::{Path, PathBuf};
use std::process::Command;

fn path_exists_and_runnable(p: &Path) -> bool {
    p.is_file()
}

/// Try well-known install locations (Homebrew Apple Silicon / Intel).
fn npx_from_known_paths() -> Option<PathBuf> {
    for candidate in [
        "/opt/homebrew/bin/npx",
        "/usr/local/bin/npx",
        "/opt/homebrew/opt/node/bin/npx",
    ] {
        let p = PathBuf::from(candidate);
        if path_exists_and_runnable(&p) {
            return Some(p);
        }
    }
    None
}

/// GUI macOS apps inherit a minimal `PATH`; use a login shell so we see the same PATH as Terminal.
fn command_v_via_login_shell(shell: &str, cmd: &str) -> Option<PathBuf> {
    let script = format!("command -v {cmd}");
    let out = Command::new(shell)
        .args(["-l", "-c", &script])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8(out.stdout).ok()?;
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    let p = PathBuf::from(trimmed);
    if path_exists_and_runnable(&p) {
        Some(p)
    } else {
        None
    }
}

fn which_usr_bin() -> Option<PathBuf> {
    let out = Command::new("/usr/bin/which").arg("npx").output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8(out.stdout).ok()?;
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    let p = PathBuf::from(trimmed);
    if path_exists_and_runnable(&p) {
        Some(p)
    } else {
        None
    }
}

/// Resolve `npx` to an absolute path for PTY argv (never a bare `npx` string).
///
/// Order matters for packaged `.app` launches: they do not load shell profiles, so `/usr/bin/which`
/// often fails even when Node is installed via Homebrew, nvm, Volta, etc.
pub fn resolve_npx_path() -> Option<PathBuf> {
    if let Some(p) = npx_from_known_paths() {
        return Some(p);
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(p) = command_v_via_login_shell("/bin/zsh", "npx") {
            return Some(p);
        }
        if let Some(p) = command_v_via_login_shell("/bin/bash", "npx") {
            return Some(p);
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(p) = command_v_via_login_shell("/bin/bash", "npx") {
            return Some(p);
        }
    }

    which_usr_bin()
}

/// `PATH` for PTY children that run the resolved `npx` binary.
///
/// On macOS, GUI apps inherit a minimal `PATH` from `launchd`. The `npx` shim is usually a script
/// with `#!/usr/bin/env node`, so without a proper `PATH` the kernel/exec path finds `npx` but the
/// script fails immediately with `env: node: No such file or directory`.
///
/// The directory that contains `npx` almost always contains `node` as well (Homebrew, nvm, Volta,
/// fnm, etc.), so it must appear first. Known install prefixes and the process `PATH` are merged
/// after without duplicates.
fn path_list_separator() -> char {
    if cfg!(windows) {
        ';'
    } else {
        ':'
    }
}

pub fn path_env_for_npx_spawn(npx: &Path) -> String {
    let sep = path_list_separator();
    let sep_str = sep.to_string();
    let mut segments: Vec<String> = Vec::new();

    let mut push_unique = |s: String| {
        if s.is_empty() {
            return;
        }
        if segments.iter().any(|e| e == &s) {
            return;
        }
        segments.push(s);
    };

    if let Some(parent) = npx.parent() {
        push_unique(parent.to_string_lossy().into_owned());
    }

    #[cfg(target_os = "macos")]
    {
        for p in [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/opt/homebrew/opt/node/bin",
        ] {
            push_unique(p.to_string());
        }
    }

    for p in ["/usr/bin", "/bin"] {
        push_unique(p.to_string());
    }

    if let Ok(existing) = std::env::var("PATH") {
        for part in existing.split(sep) {
            push_unique(part.to_string());
        }
    }

    segments.join(&sep_str)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn path_env_for_npx_spawn_puts_parent_directory_first() {
        let npx = Path::new("/opt/homebrew/bin/npx");
        let p = path_env_for_npx_spawn(npx);
        assert!(
            p.starts_with("/opt/homebrew/bin"),
            "expected leading npx parent, got {p:?}"
        );
    }

    #[test]
    fn path_env_for_npx_spawn_includes_usr_bin() {
        let npx = Path::new("/fake/nvm/versions/node/v22.0.0/bin/npx");
        let p = path_env_for_npx_spawn(npx);
        assert!(p.contains("/fake/nvm/versions/node/v22.0.0/bin"));
        assert!(p.contains("/usr/bin"));
    }
}
