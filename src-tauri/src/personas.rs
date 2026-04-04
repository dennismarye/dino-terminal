use serde::{Deserialize, Serialize};

const BUNDLED: &str = include_str!("../../personas.json");

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BrowseRoot {
    pub label: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Persona {
    pub id: String,
    pub name: String,
    pub cwd: String,
    pub cmd: String,
    pub cmd_args: Vec<String>,
    pub args: Vec<String>,
    pub task_file: String,
    pub color: String,
    #[serde(default)]
    pub browse_roots: Vec<BrowseRoot>,
}

fn validate_personas(list: &[Persona]) -> bool {
    !list.is_empty()
        && list.iter().all(|p| {
            !p.id.is_empty()
                && !p.name.is_empty()
                && !p.cwd.is_empty()
                && !p.cmd.is_empty()
                && !p.task_file.is_empty()
                && !p.color.is_empty()
        })
}

/// Expand `$HOME` / `${HOME}` so bundled and user configs work on any account.
fn expand_path_tokens(s: &str) -> String {
    let Some(home) = dirs::home_dir() else {
        return s.to_string();
    };
    let h = home.to_string_lossy();
    s.replace("${HOME}", h.as_ref()).replace("$HOME", h.as_ref())
}

fn expand_personas(list: Vec<Persona>) -> Vec<Persona> {
    list
        .into_iter()
        .map(|mut p| {
            p.cwd = expand_path_tokens(&p.cwd);
            p.task_file = expand_path_tokens(&p.task_file);
            for r in &mut p.browse_roots {
                r.path = expand_path_tokens(&r.path);
            }
            p
        })
        .collect()
}

pub fn bundled_personas() -> Vec<Persona> {
    match serde_json::from_str::<Vec<Persona>>(BUNDLED) {
        Ok(v) if validate_personas(&v) => expand_personas(v),
        Ok(_) => {
            log::error!("bundled personas failed validation");
            vec![]
        }
        Err(e) => {
            log::error!("bundled personas parse error: {e}");
            vec![]
        }
    }
}

pub fn parse_personas_json(raw: &str) -> Result<Vec<Persona>, String> {
    let v: Vec<Persona> = serde_json::from_str(raw).map_err(|e| e.to_string())?;
    if !validate_personas(&v) {
        return Err("persona validation failed: missing required fields".to_string());
    }
    Ok(v)
}

/// Load personas from `~/.dino-terminal/personas.json`, seeding from bundled defaults when missing.
/// Malformed JSON or invalid shape logs an error and falls back to bundled — does not panic.
pub fn load_personas_from_disk() -> Vec<Persona> {
    let bundled = bundled_personas();
    let Some(home) = dirs::home_dir() else {
        log::error!("dirs::home_dir() unavailable");
        return bundled;
    };
    let path = home.join(".dino-terminal").join("personas.json");
    let raw = match std::fs::read_to_string(&path) {
        Ok(r) => r,
        Err(e) => {
            log::warn!("personas file missing or unreadable ({e}), seeding bundled copy");
            if let Some(parent) = path.parent() {
                if let Err(mk) = std::fs::create_dir_all(parent) {
                    log::error!("could not create .dino-terminal: {mk}");
                    return bundled;
                }
            }
            if let Err(w) = std::fs::write(&path, BUNDLED) {
                log::error!("could not write default personas: {w}");
            }
            return bundled;
        }
    };
    match parse_personas_json(&raw) {
        Ok(v) => expand_personas(v),
        Err(e) => {
            log::error!("invalid personas.json: {e}, falling back to bundled defaults");
            bundled
        }
    }
}

pub fn personas_config_path() -> Option<std::path::PathBuf> {
    Some(dirs::home_dir()?.join(".dino-terminal").join("personas.json"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_replaces_home_token() {
        let Some(h) = dirs::home_dir() else {
            return;
        };
        let expected = h.join("foo").to_string_lossy().to_string();
        assert_eq!(expand_path_tokens("$HOME/foo"), expected);
        assert_eq!(expand_path_tokens("${HOME}/foo"), expected);
    }
}
