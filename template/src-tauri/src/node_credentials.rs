//! Node Credentials Management
//!
//! Stores node_id + node_secret encrypted in the node vault.
//! Used for headless engine startup without interactive login.
//!
//! ## Security Model
//!
//! - Credentials stored in node vault (AES-256-GCM encrypted)
//! - Device-bound key derivation (device secret + node_id + epoch)
//! - Credentials never logged
//! - No OS keychain prompts

use crate::bootstrap::{initialize_home, resolve_home_path};
use crate::node_vault_store::{
    delete_node_secret, has_node_secret, read_node_secret, write_node_secret,
    SECRET_ID_NODE_CREDENTIALS,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use std::time::Duration;
use uuid::Uuid;

// =============================================================================
// Types
// =============================================================================

/// Node credentials stored in vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeCredentials {
    pub node_id: String,
    pub node_secret: String,
}

/// Node authentication token received from server (role=node)
/// Stored in memory only - never persisted to disk
#[derive(Debug, Clone)]
pub struct NodeAuthToken {
    pub token: String,
    pub node_id: Uuid,
    pub tenant_id: Uuid,
    pub workspace_id: Uuid,
    pub session_id: Uuid,
    pub expires_at: DateTime<Utc>,
}

impl NodeAuthToken {
    /// Check if token is expired (with 60s buffer)
    pub fn is_expired(&self) -> bool {
        Utc::now() + chrono::Duration::seconds(60) >= self.expires_at
    }
}

/// Thread-safe holder for node auth token
pub struct NodeAuthTokenHolder {
    inner: RwLock<Option<NodeAuthToken>>,
}

impl NodeAuthTokenHolder {
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(None),
        }
    }

    pub fn get(&self) -> Option<NodeAuthToken> {
        self.inner.read().ok()?.clone()
    }

    pub fn set(&self, token: NodeAuthToken) {
        if let Ok(mut guard) = self.inner.write() {
            *guard = Some(token);
        }
    }

    #[allow(dead_code)]
    pub fn clear(&self) {
        if let Ok(mut guard) = self.inner.write() {
            *guard = None;
        }
    }

    /// Get valid token or None if missing/expired
    pub fn get_valid(&self) -> Option<NodeAuthToken> {
        let token = self.get()?;
        if token.is_expired() {
            None
        } else {
            Some(token)
        }
    }
}

impl Default for NodeAuthTokenHolder {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of loading credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialsStatus {
    pub has_credentials: bool,
    pub node_id: Option<String>,
}

/// Error type for credential operations
#[derive(Debug)]
pub enum CredentialsError {
    VaultError(String),
    InvalidNodeId(String),
    InvalidNodeSecret(String),
    NotConfigured,
    AuthFailed(u16, String),
    HttpError(String),
}

impl std::fmt::Display for CredentialsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CredentialsError::VaultError(msg) => write!(f, "Vault error: {}", msg),
            CredentialsError::InvalidNodeId(msg) => write!(f, "Invalid node_id: {}", msg),
            CredentialsError::InvalidNodeSecret(msg) => write!(f, "Invalid node_secret: {}", msg),
            CredentialsError::NotConfigured => write!(f, "Node credentials not configured"),
            CredentialsError::AuthFailed(status, msg) => {
                write!(f, "Node auth failed ({}): {}", status, msg)
            }
            CredentialsError::HttpError(msg) => write!(f, "HTTP error: {}", msg),
        }
    }
}

impl std::error::Error for CredentialsError {}

// =============================================================================
// Helper: Get epoch for vault operations
// =============================================================================

/// Get the security epoch from environment
fn get_security_epoch() -> u32 {
    std::env::var("EKKA_SECURITY_EPOCH")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1)
}

// =============================================================================
// Core Functions
// =============================================================================

/// Store node credentials in vault
///
/// # Arguments
/// * `node_id` - UUID of the node
/// * `node_secret` - Secret key for the node (NEVER logged)
///
/// # Returns
/// * `Ok(())` on success
/// * `Err(CredentialsError)` on failure
pub fn store_credentials(node_id: &Uuid, node_secret: &str) -> Result<(), CredentialsError> {
    // Validate inputs
    if node_secret.is_empty() {
        return Err(CredentialsError::InvalidNodeSecret(
            "node_secret cannot be empty".to_string(),
        ));
    }

    // Initialize home if needed
    let bootstrap = initialize_home().map_err(|e| CredentialsError::VaultError(e))?;
    let home = bootstrap.home_path();
    let epoch = get_security_epoch();

    // Store node_id + node_secret as JSON
    let creds = NodeCredentials {
        node_id: node_id.to_string(),
        node_secret: node_secret.to_string(),
    };

    let json = serde_json::to_vec(&creds)
        .map_err(|e| CredentialsError::VaultError(format!("JSON encode error: {}", e)))?;

    // Key derivation uses device_secret + epoch only (not node_id)
    write_node_secret(home, epoch, SECRET_ID_NODE_CREDENTIALS, &json)
        .map_err(|e| CredentialsError::VaultError(e.to_string()))?;

    tracing::info!(
        op = "node_credentials.stored",
        storage = "vault",
        node_id = %node_id,
        "Node credentials stored in vault"
    );

    Ok(())
}

/// Load node credentials from vault
///
/// # Returns
/// * `Ok((node_id, node_secret))` on success
/// * `Err(CredentialsError)` if not found or invalid
pub fn load_credentials() -> Result<(Uuid, String), CredentialsError> {
    let home = resolve_home_path().map_err(|e| CredentialsError::VaultError(e))?;
    let epoch = get_security_epoch();

    // Key derivation uses device_secret + epoch only (not node_id)
    let plaintext = read_node_secret(&home, epoch, SECRET_ID_NODE_CREDENTIALS)
        .map_err(|e| CredentialsError::VaultError(e.to_string()))?
        .ok_or(CredentialsError::NotConfigured)?;

    let creds: NodeCredentials = serde_json::from_slice(&plaintext)
        .map_err(|e| CredentialsError::VaultError(format!("JSON decode error: {}", e)))?;

    let node_id = Uuid::parse_str(&creds.node_id)
        .map_err(|e| CredentialsError::InvalidNodeId(format!("Invalid UUID: {}", e)))?;

    tracing::info!(
        op = "node_credentials.loaded",
        storage = "vault",
        ok = true,
        "Node credentials loaded from vault"
    );

    Ok((node_id, creds.node_secret))
}

/// Check if credentials exist
pub fn has_credentials() -> bool {
    let Ok(home) = resolve_home_path() else {
        tracing::info!(
            op = "desktop.node.credentials.check",
            has_credentials = false,
            reason = "no_home_path",
            "Credentials check: no home path"
        );
        return false;
    };

    // Check if vault file exists
    let has_creds = has_node_secret(&home, SECRET_ID_NODE_CREDENTIALS);

    tracing::info!(
        op = "desktop.node.credentials.check",
        has_credentials = has_creds,
        storage = "vault",
        "Credentials check"
    );

    has_creds
}

/// Get credentials status (has credentials + node_id if present)
pub fn get_status() -> CredentialsStatus {
    let node_id = load_credentials().ok().map(|(id, _)| id.to_string());
    let has_creds = node_id.is_some();

    CredentialsStatus {
        has_credentials: has_creds,
        node_id,
    }
}

/// Clear node credentials from vault
pub fn clear_credentials() -> Result<(), CredentialsError> {
    let home = resolve_home_path().map_err(|e| CredentialsError::VaultError(e))?;

    delete_node_secret(&home, SECRET_ID_NODE_CREDENTIALS)
        .map_err(|e| CredentialsError::VaultError(e.to_string()))?;

    tracing::info!(
        op = "desktop.node.credentials.cleared",
        "Node credentials cleared from vault"
    );

    Ok(())
}

/// Validate node_id format (must be valid UUID)
pub fn validate_node_id(node_id_str: &str) -> Result<Uuid, CredentialsError> {
    Uuid::parse_str(node_id_str)
        .map_err(|e| CredentialsError::InvalidNodeId(format!("Invalid UUID format: {}", e)))
}

/// Validate node_secret (must be non-empty)
pub fn validate_node_secret(node_secret: &str) -> Result<(), CredentialsError> {
    if node_secret.is_empty() {
        return Err(CredentialsError::InvalidNodeSecret(
            "node_secret cannot be empty".to_string(),
        ));
    }
    if node_secret.len() < 16 {
        return Err(CredentialsError::InvalidNodeSecret(
            "node_secret must be at least 16 characters".to_string(),
        ));
    }
    Ok(())
}

// =============================================================================
// Node Authentication
// =============================================================================

/// Load instance_id from marker file for session reuse
fn load_instance_id_from_marker() -> Option<String> {
    let home = resolve_home_path().ok()?;
    let marker_path = home.join(".ekka-marker.json");

    let content = std::fs::read_to_string(&marker_path).ok()?;
    let marker: serde_json::Value = serde_json::from_str(&content).ok()?;

    marker
        .get("instance_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Response from POST /engine/nodes/auth
/// Server returns: token, session_id, tenant_id, workspace_id, expires_in_seconds, expires_at_iso_utc
/// Note: node_id is NOT in response - we already know it from the request
#[derive(Debug, Deserialize)]
struct NodeAuthResponse {
    token: String,
    #[serde(alias = "tenantId")]
    tenant_id: Option<String>,
    #[serde(alias = "workspaceId")]
    workspace_id: Option<String>,
    #[serde(alias = "sessionId")]
    session_id: Option<String>,
    #[serde(alias = "expiresAtIsoUtc", alias = "expiresAt", alias = "expires_at")]
    expires_at_iso_utc: Option<String>,
}

/// Error response from auth endpoints
#[derive(Debug, Deserialize)]
struct AuthErrorResponse {
    error: Option<String>,
}

// Error codes that indicate secret is invalid or revoked
const ERROR_INVALID_SECRET: &str = "invalid_secret";
const ERROR_SECRET_REVOKED: &str = "secret_revoked";
const ERROR_INVALID_CREDENTIALS: &str = "invalid_credentials";

/// Check if an auth failure indicates the secret is invalid or revoked.
pub fn is_secret_error(status: u16, body: &str) -> bool {
    if status == 401 || status == 403 {
        if let Ok(err) = serde_json::from_str::<AuthErrorResponse>(body) {
            if let Some(error) = err.error {
                return error == ERROR_INVALID_SECRET
                    || error == ERROR_SECRET_REVOKED
                    || error == ERROR_INVALID_CREDENTIALS;
            }
        }
    }
    false
}

/// Authenticate node with server using node_id + node_secret
/// Includes instance_id from marker for session reuse (avoids session_limit on restarts)
pub fn authenticate_node(engine_url: &str) -> Result<NodeAuthToken, CredentialsError> {
    // Load credentials from vault
    let (node_id, node_secret) = load_credentials()?;

    // Load instance_id from marker file (for session reuse)
    let instance_id = load_instance_id_from_marker();

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| CredentialsError::HttpError(format!("Client build error: {}", e)))?;

    let request_id = Uuid::new_v4().to_string();

    // Build request body with optional instance_id
    let mut body = serde_json::json!({
        "node_id": node_id.to_string(),
        "node_secret": node_secret
    });

    if let Some(ref iid) = instance_id {
        body["instance_id"] = serde_json::Value::String(iid.clone());
        tracing::info!(
            op = "desktop.node.auth.request",
            instance_id = %iid,
            "Authenticating with instance_id for session reuse"
        );
    }

    let response = client
        .post(format!("{}/engine/nodes/auth", engine_url))
        .header("Content-Type", "application/json")
        .header("X-EKKA-PROOF-TYPE", "node_secret")
        .header("X-REQUEST-ID", &request_id)
        .header("X-EKKA-CORRELATION-ID", &request_id)
        .header("X-EKKA-MODULE", "desktop.node_auth")
        .header("X-EKKA-ACTION", "authenticate")
        .header("X-EKKA-CLIENT", "ekka-desktop")
        .header("X-EKKA-CLIENT-VERSION", "0.2.0")
        .json(&body)
        .send()
        .map_err(|e| CredentialsError::HttpError(format!("Request failed: {}", e)))?;

    let status = response.status();

    if !status.is_success() {
        let status_code = status.as_u16();
        let body = response.text().unwrap_or_default();
        tracing::warn!(
            op = "desktop.node.auth.failed",
            status = status_code,
            body = %body,
            "Node authentication failed"
        );
        return Err(CredentialsError::AuthFailed(status_code, body));
    }

    // Get response text first to log it for debugging
    let response_text = response.text().map_err(|e| {
        CredentialsError::HttpError(format!("Failed to read response: {}", e))
    })?;

    tracing::debug!(
        op = "desktop.node.auth.response",
        body = %response_text,
        "Raw auth response"
    );

    let auth_response: NodeAuthResponse = serde_json::from_str(&response_text).map_err(|e| {
        tracing::error!(
            op = "desktop.node.auth.parse_error",
            error = %e,
            body = %response_text,
            "Failed to parse auth response"
        );
        CredentialsError::HttpError(format!("Parse error: {}. Response: {}", e, &response_text[..response_text.len().min(200)]))
    })?;

    // Extract fields with helpful error messages
    // Note: node_id is not in response - we use the one we sent in the request
    let tenant_id_str = auth_response.tenant_id.ok_or_else(|| {
        CredentialsError::HttpError("Response missing tenant_id/tenantId field".to_string())
    })?;
    let workspace_id_str = auth_response.workspace_id.ok_or_else(|| {
        CredentialsError::HttpError("Response missing workspace_id/workspaceId field".to_string())
    })?;
    let session_id_str = auth_response.session_id.ok_or_else(|| {
        CredentialsError::HttpError("Response missing session_id/sessionId field".to_string())
    })?;
    let expires_at_str = auth_response.expires_at_iso_utc.ok_or_else(|| {
        CredentialsError::HttpError("Response missing expires_at field".to_string())
    })?;

    let token = NodeAuthToken {
        token: auth_response.token,
        node_id, // Use the node_id from load_credentials() - already a Uuid
        tenant_id: Uuid::parse_str(&tenant_id_str)
            .map_err(|e| CredentialsError::HttpError(format!("Invalid tenant_id: {}", e)))?,
        workspace_id: Uuid::parse_str(&workspace_id_str)
            .map_err(|e| CredentialsError::HttpError(format!("Invalid workspace_id: {}", e)))?,
        session_id: Uuid::parse_str(&session_id_str)
            .map_err(|e| CredentialsError::HttpError(format!("Invalid session_id: {}", e)))?,
        expires_at: DateTime::parse_from_rfc3339(&expires_at_str)
            .map_err(|e| CredentialsError::HttpError(format!("Invalid expires_at: {}", e)))?
            .with_timezone(&Utc),
    };

    tracing::info!(
        op = "desktop.node.auth.success",
        keys = ?["node_id", "session_id"],
        node_id = %token.node_id,
        session_id = %token.session_id,
        "Node authenticated successfully"
    );

    Ok(token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_node_id() {
        // Valid UUID
        let result = validate_node_id("550e8400-e29b-41d4-a716-446655440000");
        assert!(result.is_ok());

        // Invalid UUID
        let result = validate_node_id("not-a-uuid");
        assert!(result.is_err());

        // Empty
        let result = validate_node_id("");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_node_secret() {
        // Valid secret
        let result = validate_node_secret("a-sufficiently-long-secret-key");
        assert!(result.is_ok());

        // Too short
        let result = validate_node_secret("short");
        assert!(result.is_err());

        // Empty
        let result = validate_node_secret("");
        assert!(result.is_err());
    }

    #[test]
    fn test_is_secret_error() {
        // 401 with invalid_secret
        assert!(is_secret_error(401, r#"{"error":"invalid_secret"}"#));

        // 401 with secret_revoked
        assert!(is_secret_error(401, r#"{"error":"secret_revoked"}"#));

        // 401 with invalid_credentials
        assert!(is_secret_error(401, r#"{"error":"invalid_credentials"}"#));

        // 403 with invalid_secret
        assert!(is_secret_error(403, r#"{"error":"invalid_secret"}"#));

        // 401 with different error
        assert!(!is_secret_error(401, r#"{"error":"some_other_error"}"#));

        // 200 with invalid_secret (should not trigger - wrong status)
        assert!(!is_secret_error(200, r#"{"error":"invalid_secret"}"#));

        // 401 with malformed JSON
        assert!(!is_secret_error(401, "not json"));

        // 401 with empty body
        assert!(!is_secret_error(401, ""));

        // 401 with no error field
        assert!(!is_secret_error(401, r#"{"message":"error"}"#));
    }
}
