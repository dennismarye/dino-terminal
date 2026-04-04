use std::collections::HashMap;

use crate::pty_manager::PtySession;

pub struct SessionManager {
    sessions: HashMap<String, PtySession>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn insert(&mut self, id: String, session: PtySession) {
        self.sessions.insert(id, session);
    }

    pub fn get(&self, id: &str) -> Option<&PtySession> {
        self.sessions.get(id)
    }

    pub fn remove(&mut self, id: &str) -> Option<PtySession> {
        self.sessions.remove(id)
    }

    pub fn kill_all(&mut self) {
        for (_, s) in self.sessions.drain() {
            let _ = s.kill_graceful();
        }
    }
}
