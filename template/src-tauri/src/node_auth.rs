//! Node Session Authentication
//!
//! Session tokens and node identity metadata for EKKA Desktop.
//! Session tokens held in memory only (never persisted).

use chrono::{DateTime, Utc};
use std::sync::RwLock;
use uuid::Uuid;

// =============================================================================
// Types
// =============================================================================

/// Node session token (in-memory only)
#[derive(Debug, Clone)]
pub struct NodeSession {
    pub token: String,
    pub session_id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Uuid,
    pub expires_at: DateTime<Utc>,
}

impl NodeSession {
    /// Check if session is expired or about to expire (within 60 seconds)
    pub fn is_expired(&self) -> bool {
        Utc::now() + chrono::Duration::seconds(60) >= self.expires_at
    }
}

/// Thread-safe session holder
pub struct NodeSessionHolder {
    session: RwLock<Option<NodeSession>>,
}

impl NodeSessionHolder {
    pub fn new() -> Self {
        Self {
            session: RwLock::new(None),
        }
    }

    pub fn get(&self) -> Option<NodeSession> {
        self.session.read().ok()?.clone()
    }

    pub fn set(&self, session: NodeSession) {
        if let Ok(mut guard) = self.session.write() {
            *guard = Some(session);
        }
    }

    pub fn clear(&self) {
        if let Ok(mut guard) = self.session.write() {
            *guard = None;
        }
    }

    /// Get valid session or None if expired
    pub fn get_valid(&self) -> Option<NodeSession> {
        let session = self.get()?;
        if session.is_expired() {
            None
        } else {
            Some(session)
        }
    }
}

impl Default for NodeSessionHolder {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Runner Integration
// =============================================================================

/// Runner configuration using node session (NOT internal service key)
#[derive(Debug, Clone)]
pub struct NodeSessionRunnerConfig {
    pub engine_url: String,
    pub node_url: String,
    pub tenant_id: Uuid,
    pub workspace_id: Uuid,
    pub node_id: Uuid,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_expiry() {
        let session = NodeSession {
            token: "test".to_string(),
            session_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            expires_at: Utc::now() + chrono::Duration::hours(1),
        };

        assert!(!session.is_expired());

        let expired_session = NodeSession {
            token: "test".to_string(),
            session_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            expires_at: Utc::now() - chrono::Duration::hours(1),
        };

        assert!(expired_session.is_expired());
    }
}
