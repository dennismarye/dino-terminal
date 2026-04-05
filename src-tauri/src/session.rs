use std::collections::HashMap;

use crate::pty_manager::PtySession;
use crate::stream_session::ClaudeStreamSession;

pub enum ManagedSession {
    Pty(PtySession),
    Stream(ClaudeStreamSession),
}

impl ManagedSession {
    pub fn kill_graceful(&self) -> Result<(), String> {
        match self {
            ManagedSession::Pty(s) => s.kill_graceful(),
            ManagedSession::Stream(s) => s.kill_graceful(),
        }
    }
}

pub struct SessionManager {
    sessions: HashMap<String, ManagedSession>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn insert_pty(&mut self, id: String, session: PtySession) {
        self.sessions.insert(id, ManagedSession::Pty(session));
    }

    pub fn insert_stream(&mut self, id: String, session: ClaudeStreamSession) {
        self.sessions.insert(id, ManagedSession::Stream(session));
    }

    pub fn get_pty(&self, id: &str) -> Option<&PtySession> {
        match self.sessions.get(id)? {
            ManagedSession::Pty(p) => Some(p),
            ManagedSession::Stream(_) => None,
        }
    }

    pub fn remove(&mut self, id: &str) -> Option<ManagedSession> {
        self.sessions.remove(id)
    }

    pub fn kill_all(&mut self) {
        for (_, s) in self.sessions.drain() {
            let _ = s.kill_graceful();
        }
    }
}
