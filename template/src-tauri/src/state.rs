//! Application state management
//!
//! Contains the shared state accessible across Tauri commands.

use crate::node_auth::{NodeIdentity, NodeSessionHolder};
use chrono::{DateTime, Utc};
use ekka_sdk_core::ekka_ops::{
    self as ops, EkkaError, EkkaResult, GrantIssuer, GrantRequest, GrantResponse, RuntimeContext,
    vault::{VaultCacheKey, VaultManager, VaultManagerCache},
};
use ekka_sdk_core::ekka_path_guard::SignedGrant;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use uuid::Uuid;

/// Authentication context from login
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthContext {
    pub tenant_id: String,
    pub sub: String,
    pub jwt: String,
    /// Workspace ID (required for node session registration)
    #[serde(default)]
    pub workspace_id: Option<String>,
}

/// Home directory state machine
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HomeState {
    BootstrapPreLogin,
    AuthenticatedNoHomeGrant,
    HomeGranted,
}

// =============================================================================
// Runner State
// =============================================================================

/// Runner loop state (running, stopped, error)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunnerLoopState {
    Running,
    Stopped,
    Error,
}

impl Default for RunnerLoopState {
    fn default() -> Self {
        Self::Stopped
    }
}

/// Local runner status - tracks this desktop instance's runner loop
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunnerStatus {
    pub enabled: bool,
    pub state: RunnerLoopState,
    pub runner_id: Option<String>,
    pub engine_url: Option<String>,
    pub last_poll_at: Option<DateTime<Utc>>,
    pub last_claim_at: Option<DateTime<Utc>>,
    pub last_complete_at: Option<DateTime<Utc>>,
    pub last_task_id: Option<String>,
    pub last_error: Option<String>,
}

impl Default for RunnerStatus {
    fn default() -> Self {
        Self {
            enabled: false,
            state: RunnerLoopState::Stopped,
            runner_id: None,
            engine_url: std::env::var("EKKA_ENGINE_URL").ok(),
            last_poll_at: None,
            last_claim_at: None,
            last_complete_at: None,
            last_task_id: None,
            last_error: None,
        }
    }
}

/// Thread-safe wrapper for RunnerStatus
#[derive(Clone)]
pub struct RunnerState {
    inner: Arc<RwLock<RunnerStatus>>,
}

impl RunnerState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(RunnerStatus::default())),
        }
    }

    /// Get a snapshot of current runner status
    pub fn get(&self) -> RunnerStatus {
        self.inner
            .read()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }

    /// Update runner status
    pub fn update<F>(&self, f: F)
    where
        F: FnOnce(&mut RunnerStatus),
    {
        if let Ok(mut guard) = self.inner.write() {
            f(&mut guard);
        }
    }

    /// Mark a successful poll
    pub fn record_poll(&self) {
        self.update(|s| {
            s.last_poll_at = Some(Utc::now());
            s.state = RunnerLoopState::Running;
        });
    }

    /// Mark a successful claim
    pub fn record_claim(&self, task_id: &str) {
        self.update(|s| {
            s.last_claim_at = Some(Utc::now());
            s.last_task_id = Some(task_id.to_string());
        });
    }

    /// Mark a successful complete
    pub fn record_complete(&self, task_id: &str) {
        self.update(|s| {
            s.last_complete_at = Some(Utc::now());
            s.last_task_id = Some(task_id.to_string());
        });
    }

    /// Mark an error
    pub fn record_error(&self, error: &str) {
        self.update(|s| {
            s.state = RunnerLoopState::Error;
            // Sanitize error - don't include paths or secrets
            s.last_error = Some(sanitize_error(error));
        });
    }

    /// Start the runner
    pub fn start(&self, runner_id: &str) {
        self.update(|s| {
            s.enabled = true;
            s.state = RunnerLoopState::Running;
            s.runner_id = Some(runner_id.to_string());
            s.engine_url = std::env::var("EKKA_ENGINE_URL")
                .or_else(|_| std::env::var("ENGINE_URL"))
                .ok();
            s.last_error = None;
        });
    }

    /// Stop the runner
    pub fn stop(&self) {
        self.update(|s| {
            s.state = RunnerLoopState::Stopped;
        });
    }
}

impl Default for RunnerState {
    fn default() -> Self {
        Self::new()
    }
}

/// Sanitize error messages to avoid leaking paths or secrets
fn sanitize_error(error: &str) -> String {
    // Remove potential file paths
    let sanitized = error
        .lines()
        .map(|line| {
            // Replace anything that looks like a path
            if line.contains('/') && (line.contains("home") || line.contains("Users") || line.contains("tmp")) {
                "[path redacted]".to_string()
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    // Truncate if too long
    if sanitized.len() > 200 {
        format!("{}...", &sanitized[..200])
    } else {
        sanitized
    }
}

/// Global engine state managed by Tauri
pub struct EngineState {
    pub connected: Mutex<bool>,
    pub auth: Mutex<Option<AuthContext>>,
    pub home_path: Mutex<Option<PathBuf>>,
    pub node_id: Mutex<Option<Uuid>>,
    /// Cached VaultManager instances to avoid repeated PBKDF2 key derivation
    vault_cache: VaultCache,
    /// Local runner status for this desktop instance
    pub runner_state: RunnerState,
    /// Node identity metadata (public key, etc.)
    pub node_identity: Mutex<Option<NodeIdentity>>,
    /// Node session holder (in-memory only, never persisted)
    pub node_session: Arc<NodeSessionHolder>,
}

impl Default for EngineState {
    fn default() -> Self {
        Self {
            connected: Mutex::new(false),
            auth: Mutex::new(None),
            home_path: Mutex::new(None),
            node_id: Mutex::new(None),
            vault_cache: VaultCache::new(),
            runner_state: RunnerState::new(),
            node_identity: Mutex::new(None),
            node_session: Arc::new(NodeSessionHolder::new()),
        }
    }
}

// =============================================================================
// Vault Cache
// =============================================================================

/// Thread-safe cache for VaultManager instances
///
/// Avoids repeated PBKDF2 key derivation (100k iterations) per vault call.
/// Key derivation happens once per session; subsequent calls reuse cached instance.
pub struct VaultCache {
    inner: RwLock<HashMap<VaultCacheKey, Arc<VaultManager>>>,
}

impl VaultCache {
    /// Create a new empty vault cache
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(HashMap::new()),
        }
    }
}

impl Default for VaultCache {
    fn default() -> Self {
        Self::new()
    }
}

impl VaultManagerCache for VaultCache {
    fn get(&self, key: &VaultCacheKey) -> Option<Arc<VaultManager>> {
        self.inner.read().ok()?.get(key).cloned()
    }

    fn insert(&self, key: VaultCacheKey, vm: Arc<VaultManager>) {
        if let Ok(mut guard) = self.inner.write() {
            guard.insert(key, vm);
        }
    }

    fn remove(&self, key: &VaultCacheKey) -> bool {
        self.inner
            .write()
            .ok()
            .map(|mut guard| guard.remove(key).is_some())
            .unwrap_or(false)
    }

    fn clear(&self) {
        if let Ok(mut guard) = self.inner.write() {
            guard.clear();
        }
    }
}

impl EngineState {
    /// Create a RuntimeContext from current state
    pub fn to_runtime_context(&self) -> Option<RuntimeContext> {
        let home_path = self.home_path.lock().ok()?.clone()?;
        let node_id = self.node_id.lock().ok()?.clone()?;

        let mut ctx = RuntimeContext::new(home_path, node_id);

        if let Ok(guard) = self.auth.lock() {
            if let Some(auth) = guard.as_ref() {
                ctx.set_auth(ops::AuthContext::new(
                    &auth.tenant_id,
                    &auth.sub,
                    &auth.jwt,
                ));
            }
        }

        Some(ctx)
    }

    /// Get a reference to the vault cache
    ///
    /// Used by vault handlers to pass the cache to ekka_ops functions.
    pub fn vault_cache(&self) -> &dyn VaultManagerCache {
        &self.vault_cache
    }

    /// Clear the vault cache
    ///
    /// Should be called on logout or auth context changes.
    pub fn clear_vault_cache(&self) {
        self.vault_cache.clear();
    }
}

// =============================================================================
// HTTP Grant Issuer
// =============================================================================

/// HTTP-based grant issuer that calls EKKA Engine
pub struct EngineHttpGrantIssuer;

impl EngineHttpGrantIssuer {
    pub fn new() -> Self {
        Self
    }
}

impl Default for EngineHttpGrantIssuer {
    fn default() -> Self {
        Self::new()
    }
}

impl GrantIssuer for EngineHttpGrantIssuer {
    fn issue(&self, ctx: &RuntimeContext, req: GrantRequest) -> EkkaResult<GrantResponse> {
        // Must have auth
        let auth = ctx.auth.as_ref().ok_or_else(|| {
            EkkaError::new(ops::codes::NOT_AUTHENTICATED, "Must login before requesting grant")
        })?;

        // Get engine URL
        let engine_url = std::env::var("EKKA_ENGINE_URL").map_err(|_| {
            EkkaError::new(
                ops::codes::ENGINE_ERROR,
                "EKKA_ENGINE_URL not set. Grant requires online engine.",
            )
        })?;

        // Build grant request payload
        let grant_request = serde_json::json!({
            "resource": {
                "kind": "path",
                "path_prefix": req.path_prefix,
                "attrs": {
                    "path_type": req.path_type
                }
            },
            "permissions": {
                "ops": ["read", "write", "delete"],
                "access": req.access
            },
            "purpose": req.purpose,
            "expires_in_seconds": req.expires_in_seconds,
            "node_id": ctx.node_id.to_string(),
            "consent": {
                "mode": "user_click"
            }
        });

        // Make HTTP request
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| EkkaError::from_source(ops::codes::ENGINE_ERROR, "HTTP client error", e))?;

        let request_id = Uuid::new_v4().to_string();
        let response = client
            .post(format!("{}/engine/grants/issue", engine_url))
            .header("Authorization", format!("Bearer {}", auth.jwt))
            .header("Content-Type", "application/json")
            .header("X-EKKA-PROOF-TYPE", "jwt")
            .header("X-REQUEST-ID", &request_id)
            .header("X-EKKA-CORRELATION-ID", &request_id)
            .header("X-EKKA-MODULE", "desktop.paths")
            .header("X-EKKA-ACTION", "grant")
            .header("X-EKKA-CLIENT", "desktop")
            .header("X-EKKA-CLIENT-VERSION", "0.2.0")
            .json(&grant_request)
            .send()
            .map_err(|e| {
                EkkaError::from_source(ops::codes::ENGINE_ERROR, "HTTP request failed", e)
            })?;

        // Check response
        if !response.status().is_success() {
            let status = response.status();
            let error_body = response.text().unwrap_or_else(|_| "No error body".to_string());
            return Err(EkkaError::new(
                ops::codes::GRANT_DENIED,
                format!("Engine returned {}: {}", status, error_body),
            ));
        }

        // Parse response
        let grant_response: Value = response.json().map_err(|e| {
            EkkaError::from_source(ops::codes::ENGINE_ERROR, "Failed to parse response", e)
        })?;

        // Extract signed grant
        let signed_grant_json = grant_response.get("signed_grant").ok_or_else(|| {
            EkkaError::new(ops::codes::ENGINE_ERROR, "Response missing signed_grant")
        })?;

        let signed_grant: SignedGrant = serde_json::from_value(signed_grant_json.clone())
            .map_err(|e| {
                EkkaError::from_source(ops::codes::ENGINE_ERROR, "Invalid signed_grant format", e)
            })?;

        let expires_at = grant_response
            .get("expires_at")
            .and_then(|e| e.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                signed_grant
                    .grant
                    .expires_at
                    .clone()
                    .unwrap_or_default()
            });

        Ok(GrantResponse {
            signed_grant,
            expires_at,
        })
    }

    fn revoke(&self, ctx: &RuntimeContext, grant_id: &str) -> EkkaResult<()> {
        // Must have auth
        let auth = ctx.auth.as_ref().ok_or_else(|| {
            EkkaError::new(ops::codes::NOT_AUTHENTICATED, "Must login to revoke grant")
        })?;

        // Get engine URL (optional - revoke is best effort)
        let engine_url = match std::env::var("EKKA_ENGINE_URL") {
            Ok(url) => url,
            Err(_) => return Ok(()), // No engine, just return success
        };

        // Make revoke request (best effort)
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| EkkaError::from_source(ops::codes::ENGINE_ERROR, "HTTP client error", e))?;

        let request_id = Uuid::new_v4().to_string();
        let _ = client
            .post(format!("{}/engine/grants/revoke", engine_url))
            .header("Authorization", format!("Bearer {}", auth.jwt))
            .header("Content-Type", "application/json")
            .header("X-REQUEST-ID", &request_id)
            .json(&serde_json::json!({ "grant_id": grant_id }))
            .send();

        Ok(())
    }
}
