use std::sync::OnceLock;

use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusUpdate {
    pub context_pct: Option<u8>,
    pub rate_5h_pct: Option<u8>,
    pub rate_7d_pct: Option<u8>,
    pub model: Option<String>,
    pub branch: Option<String>,
}

fn ansi_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\x1b\[[0-9;:]*m").expect("ansi strip regex"))
}

fn strip_ansi(s: &str) -> String {
    ansi_regex().replace_all(s, "").to_string()
}

fn pct_from_json_value(v: &Value) -> Option<u8> {
    match v {
        Value::Number(n) => {
            let f = n.as_f64().or_else(|| n.as_u64().map(|u| u as f64))?;
            Some(f.clamp(0.0, 100.0).round() as u8)
        }
        Value::String(s) => {
            let f: f64 = s.trim().parse().ok()?;
            Some(f.clamp(0.0, 100.0).round() as u8)
        }
        _ => None,
    }
}

fn obj_get_pct<'a>(o: &'a serde_json::Map<String, Value>, keys: &[&str]) -> Option<u8> {
    keys
        .iter()
        .find_map(|k| o.get(*k))
        .and_then(|v| pct_from_json_value(v))
}

/// Parse a single JSON object (camelCase or snake_case keys).
fn try_parse_status_json(text: &str) -> Option<StatusUpdate> {
    let v: Value = serde_json::from_str(text.trim()).ok()?;
    let o = v.as_object()?;

    let context_pct = obj_get_pct(o, &["contextPct", "context_pct"]);
    let rate_5h_pct = obj_get_pct(o, &["rate5hPct", "rate_5h_pct", "fiveHourPct"]);
    let rate_7d_pct = obj_get_pct(o, &["rate7dPct", "rate_7d_pct", "sevenDayPct"]);

    let model = o
        .get("model")
        .and_then(|v| v.as_str().map(String::from))
        .or_else(|| o.get("modelName").and_then(|v| v.as_str().map(String::from)));
    let branch = o
        .get("branch")
        .and_then(|v| v.as_str().map(String::from));

    if context_pct.is_none()
        && rate_5h_pct.is_none()
        && rate_7d_pct.is_none()
        && model.is_none()
        && branch.is_none()
    {
        return None;
    }

    Some(StatusUpdate {
        context_pct,
        rate_5h_pct,
        rate_7d_pct,
        model,
        branch,
    })
}

fn pct_from_str_capture(cap: &str) -> Option<u8> {
    let f: f64 = cap.parse().ok()?;
    Some(f.clamp(0.0, 100.0).round() as u8)
}

/// Last segment is branch. Model is the rightmost segment that is not empty, not a `Ctx:` chunk,
/// not a bare integer (printf artifact), and not the combined rate-limit text.
fn pick_model_branch(parts: &[&str]) -> (Option<String>, Option<String>) {
    if parts.is_empty() {
        return (None, None);
    }
    let branch_raw = parts[parts.len() - 1].trim();
    let branch = if branch_raw.is_empty() {
        None
    } else {
        Some(branch_raw.to_string())
    };

    let model = parts[..parts.len().saturating_sub(1)]
        .iter()
        .rev()
        .map(|s| s.trim())
        .find(|p| {
            !p.is_empty()
                && !p.starts_with("Ctx:")
                && p.parse::<u64>().is_err()
                && !(p.contains("5h:") || p.contains("7d:"))
        })
        .map(|s| s.to_string());

    (model, branch)
}

/// Parse Claude Code default `status_line_command.sh` output (ANSI + `Ctx:` / `5h:` / `7d:`).
fn try_parse_plaintext_status(text: &str) -> Option<StatusUpdate> {
    let stripped = strip_ansi(text);
    let s = stripped.trim();
    if s.is_empty() {
        return None;
    }

    static RE_CTX: OnceLock<Regex> = OnceLock::new();
    static RE_5H: OnceLock<Regex> = OnceLock::new();
    static RE_7D: OnceLock<Regex> = OnceLock::new();

    let re_ctx = RE_CTX.get_or_init(|| {
        Regex::new(r"Ctx:\s*(?:N/A|([\d.]+)\s*%)").expect("ctx regex")
    });
    let re_5h = RE_5H.get_or_init(|| Regex::new(r"5h:\s*(\d+)\s*%").expect("5h regex"));
    let re_7d = RE_7D.get_or_init(|| Regex::new(r"7d:\s*(\d+)\s*%").expect("7d regex"));

    let context_pct = re_ctx
        .captures(s)
        .and_then(|c| c.get(1))
        .and_then(|m| pct_from_str_capture(m.as_str()));

    let rate_5h_pct = re_5h
        .captures(s)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<u8>().ok());

    let rate_7d_pct = re_7d
        .captures(s)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<u8>().ok());

    let parts: Vec<&str> = s.split(" | ").map(str::trim).collect();
    let (model, branch) = pick_model_branch(&parts);

    if context_pct.is_none()
        && rate_5h_pct.is_none()
        && rate_7d_pct.is_none()
        && model.is_none()
        && branch.is_none()
    {
        return None;
    }

    Some(StatusUpdate {
        context_pct,
        rate_5h_pct,
        rate_7d_pct,
        model,
        branch,
    })
}

/// Run `$HOME/.claude/status_line_command.sh` via absolute path (never `~` in argv).
///
/// Claude's default script prints a **colored plain-text** line and expects session JSON on **stdin**
/// (the CLI pipes that). We run it with no stdin; the script still prints `Ctx: N/A | …` which we parse.
/// If the script (or a custom replacement) prints JSON, that is preferred.
pub fn poll_status_line_script() -> Option<StatusUpdate> {
    let home = dirs::home_dir()?;
    let script = home.join(".claude").join("status_line_command.sh");
    if !script.is_file() {
        return None;
    }
    let out = Command::new("/bin/sh")
        .arg(script.as_os_str())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout).into_owned();
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Some(u) = try_parse_status_json(trimmed) {
        return Some(u);
    }
    for line in trimmed.lines().rev() {
        let t = line.trim();
        if t.starts_with('{') {
            if let Some(u) = try_parse_status_json(t) {
                return Some(u);
            }
        }
    }

    try_parse_plaintext_status(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plaintext_strips_ansi_and_reads_gauges() {
        let line = "Ctx: 12.3% | \x1b[32m5h: 4%\x1b[0m \x1b[33m7d: 67%\x1b[0m | claude-3 | main";
        let u = try_parse_plaintext_status(line).expect("parse");
        assert_eq!(u.context_pct, Some(12));
        assert_eq!(u.rate_5h_pct, Some(4));
        assert_eq!(u.rate_7d_pct, Some(67));
        assert_eq!(u.model.as_deref(), Some("claude-3"));
        assert_eq!(u.branch.as_deref(), Some("main"));
    }

    #[test]
    fn plaintext_ctx_na_still_parses_branch() {
        let line = "Ctx: N/A |  | no-git";
        let u = try_parse_plaintext_status(line).expect("parse");
        assert_eq!(u.context_pct, None);
        assert_eq!(u.branch.as_deref(), Some("no-git"));
    }

    #[test]
    fn plaintext_skips_duplicate_ctx_segments_for_model() {
        // Observed when the shell script runs with no stdin (printf format quirk).
        let line = "Ctx: N/A | 0 | Ctx: N/A | no-git";
        let u = try_parse_plaintext_status(line).expect("parse");
        assert_eq!(u.model, None);
        assert_eq!(u.branch.as_deref(), Some("no-git"));
    }

    #[test]
    fn json_accepts_snake_case() {
        let j = r#"{"context_pct":45,"rate_5h_pct":10,"rate_7d_pct":20,"model":"x","branch":"b"}"#;
        let u = try_parse_status_json(j).expect("parse");
        assert_eq!(u.context_pct, Some(45));
        assert_eq!(u.rate_5h_pct, Some(10));
        assert_eq!(u.rate_7d_pct, Some(20));
    }
}
