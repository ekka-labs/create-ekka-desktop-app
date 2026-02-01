//! Node Session Authentication
//!
//! Implements Ed25519-based node authentication for EKKA Desktop.
//!
//! ## Architecture
//!
//! - Node identity stored in `${EKKA_HOME}/node_identity.json` (public metadata only)
//! - Private key stored encrypted in vault at `node_keys/<node_id>/ed25519_private_key`
//! - Session tokens held in memory only (never persisted)
//!
//! ## Security Invariants
//!
//! - Private keys NEVER written to disk in plaintext
//! - Private keys NEVER logged
//! - Sign RAW NONCE BYTES only (no canonical JSON)
//! - Node identity = node_id + private key possession

#![allow(dead_code)] // API types may not all be used yet

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use ekka_sdk_core::ekka_crypto::{decrypt, derive_key, encrypt, KeyDerivationConfig, KeyMaterial};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::RwLock;
use uuid::Uuid;
use zeroize::Zeroizing;

// =============================================================================
// Types
// =============================================================================

/// Node identity metadata (safe to store in plaintext)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeIdentity {
    pub schema_version: String,
    pub node_id: Uuid,
    pub algorithm: String,
    pub public_key_b64: String,
    pub private_key_vault_ref: String,
    pub created_at_iso_utc: String,
}

impl NodeIdentity {
    pub fn new(node_id: Uuid, public_key: &VerifyingKey) -> Self {
        let public_key_bytes = public_key.to_bytes();
        Self {
            schema_version: "node_identity.v1".to_string(),
            node_id,
            algorithm: "ed25519".to_string(),
            public_key_b64: BASE64.encode(public_key_bytes),
            private_key_vault_ref: format!("vault://node_keys/{}/ed25519_private_key", node_id),
            created_at_iso_utc: Utc::now().to_rfc3339(),
        }
    }
}

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
// API Response Types
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct RegisterNodeResponse {
    pub node_id: String,
    pub tenant_id: String,
    pub status: String,
    #[serde(default)]
    pub registered_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChallengeResponse {
    pub challenge_id: String,
    pub nonce_b64: String,
    pub expires_at_iso_utc: String,
}

#[derive(Debug, Deserialize)]
pub struct SessionResponse {
    pub token: String,
    pub session_id: String,
    pub tenant_id: String,
    pub workspace_id: String,
    pub expires_at_iso_utc: String,
}

// =============================================================================
// Error Types
// =============================================================================

#[derive(Debug)]
pub enum NodeAuthError {
    IoError(std::io::Error),
    JsonError(serde_json::Error),
    CryptoError(String),
    HttpError(String),
    VaultError(String),
    IdentityMismatch(String),
    SessionExpired,
    NotRegistered,
}

impl std::fmt::Display for NodeAuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NodeAuthError::IoError(e) => write!(f, "I/O error: {}", e),
            NodeAuthError::JsonError(e) => write!(f, "JSON error: {}", e),
            NodeAuthError::CryptoError(e) => write!(f, "Crypto error: {}", e),
            NodeAuthError::HttpError(e) => write!(f, "HTTP error: {}", e),
            NodeAuthError::VaultError(e) => write!(f, "Vault error: {}", e),
            NodeAuthError::IdentityMismatch(e) => write!(f, "Identity mismatch: {}", e),
            NodeAuthError::SessionExpired => write!(f, "Session expired"),
            NodeAuthError::NotRegistered => write!(f, "Node not registered"),
        }
    }
}

impl std::error::Error for NodeAuthError {}

impl From<std::io::Error> for NodeAuthError {
    fn from(e: std::io::Error) -> Self {
        NodeAuthError::IoError(e)
    }
}

impl From<serde_json::Error> for NodeAuthError {
    fn from(e: serde_json::Error) -> Self {
        NodeAuthError::JsonError(e)
    }
}

// =============================================================================
// Core Functions
// =============================================================================

/// Load node identity from file, or return None if not found
pub fn load_node_identity(home_path: &PathBuf) -> Result<Option<NodeIdentity>, NodeAuthError> {
    let identity_path = home_path.join("node_identity.json");
    if !identity_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&identity_path)?;
    let identity: NodeIdentity = serde_json::from_str(&content)?;
    Ok(Some(identity))
}

/// Save node identity to file
pub fn save_node_identity(
    home_path: &PathBuf,
    identity: &NodeIdentity,
) -> Result<(), NodeAuthError> {
    let identity_path = home_path.join("node_identity.json");
    let content = serde_json::to_string_pretty(identity)?;
    std::fs::write(&identity_path, content)?;
    Ok(())
}

/// Generate a new Ed25519 keypair
///
/// Returns (signing_key, verifying_key) where signing_key contains the private key
pub fn generate_keypair() -> (SigningKey, VerifyingKey) {
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();
    (signing_key, verifying_key)
}

/// Get the vault path for the private key
pub fn get_private_key_vault_path(node_id: &Uuid) -> PathBuf {
    PathBuf::from(format!("node_keys/{}/ed25519_private_key.enc", node_id))
}

/// Derive encryption key for node-level secrets
///
/// Uses node_id as context, device_id for binding
fn derive_node_encryption_key(node_id: &Uuid, device_fingerprint: Option<&str>) -> KeyMaterial {
    // Use node_id + device fingerprint for key derivation
    // This binds the key to this specific node on this device
    let device_secret = device_fingerprint.unwrap_or("ekka-desktop-default-device");

    derive_key(
        device_secret,
        &node_id.to_string(),
        1, // security_epoch for node keys
        "node_private_key",
        &KeyDerivationConfig::default(),
    )
}

/// Store private key encrypted at rest
///
/// The private key is stored as encrypted base64-encoded 64-byte keypair
/// Uses node-level encryption (not tenant-scoped)
pub fn store_private_key_encrypted(
    home_path: &PathBuf,
    node_id: &Uuid,
    signing_key: &SigningKey,
    device_fingerprint: Option<&str>,
) -> Result<(), NodeAuthError> {
    let vault_path = home_path.join("vault").join(get_private_key_vault_path(node_id));

    // Ensure parent directory exists
    if let Some(parent) = vault_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Ed25519 private key is 64 bytes (32-byte seed + 32-byte public)
    let key_bytes = signing_key.to_keypair_bytes();
    let encoded = BASE64.encode(&key_bytes);

    // Derive encryption key for this node
    let encryption_key = derive_node_encryption_key(node_id, device_fingerprint);

    // Encrypt the key
    let encrypted = encrypt(encoded.as_bytes(), &encryption_key)
        .map_err(|e| NodeAuthError::CryptoError(format!("Encryption failed: {}", e)))?;

    // Write encrypted data
    std::fs::write(&vault_path, encrypted)?;

    tracing::info!(
        op = "node_auth.store_private_key",
        node_id = %node_id,
        vault_path = %vault_path.display(),
        "Private key stored encrypted"
    );

    Ok(())
}

/// Check if private key exists in vault
pub fn private_key_exists(home_path: &PathBuf, node_id: &Uuid) -> bool {
    let vault_path = home_path.join("vault").join(get_private_key_vault_path(node_id));
    vault_path.exists()
}

/// Load private key from encrypted storage
///
/// Returns the signing key or error if not found/corrupted
pub fn load_private_key_encrypted(
    home_path: &PathBuf,
    node_id: &Uuid,
    device_fingerprint: Option<&str>,
) -> Result<SigningKey, NodeAuthError> {
    let vault_path = home_path.join("vault").join(get_private_key_vault_path(node_id));

    if !vault_path.exists() {
        return Err(NodeAuthError::VaultError(format!(
            "Private key not found at {}",
            vault_path.display()
        )));
    }

    // Read encrypted data
    let encrypted = std::fs::read(&vault_path)?;

    // Derive encryption key
    let encryption_key = derive_node_encryption_key(node_id, device_fingerprint);

    // Decrypt
    let decrypted = decrypt(&encrypted, &encryption_key)
        .map_err(|e| NodeAuthError::CryptoError(format!("Decryption failed: {}", e)))?;

    // Decode base64
    let encoded = String::from_utf8(decrypted)
        .map_err(|e| NodeAuthError::CryptoError(format!("Invalid UTF-8: {}", e)))?;

    // Wrap in Zeroizing to clear memory after use
    let key_bytes_vec: Zeroizing<Vec<u8>> = Zeroizing::new(
        BASE64
            .decode(&encoded)
            .map_err(|e| NodeAuthError::CryptoError(format!("Invalid base64: {}", e)))?,
    );

    if key_bytes_vec.len() != 64 {
        return Err(NodeAuthError::CryptoError(format!(
            "Invalid key length: expected 64, got {}",
            key_bytes_vec.len()
        )));
    }

    let mut key_bytes: [u8; 64] = [0u8; 64];
    key_bytes.copy_from_slice(&key_bytes_vec);

    let signing_key = SigningKey::from_keypair_bytes(&key_bytes)
        .map_err(|e| NodeAuthError::CryptoError(format!("Invalid keypair bytes: {}", e)))?;

    // Zero out the array
    key_bytes.iter_mut().for_each(|b| *b = 0);

    Ok(signing_key)
}

/// Sign raw nonce bytes with Ed25519
///
/// IMPORTANT: Signs RAW BYTES, not JSON or any other encoding
pub fn sign_nonce(signing_key: &SigningKey, nonce_bytes: &[u8]) -> Signature {
    signing_key.sign(nonce_bytes)
}

// =============================================================================
// HTTP API Calls
// =============================================================================

/// Register node with engine (idempotent)
pub fn register_node(
    engine_url: &str,
    user_jwt: &str,
    node_id: &Uuid,
    public_key_b64: &str,
    default_workspace_id: &str,
    device_id_fingerprint: Option<&str>,
) -> Result<RegisterNodeResponse, NodeAuthError> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| NodeAuthError::HttpError(format!("Client build error: {}", e)))?;

    let request_id = Uuid::new_v4().to_string();

    let mut body = serde_json::json!({
        "node_id": node_id.to_string(),
        "public_key_b64": public_key_b64,
        "default_workspace_id": default_workspace_id,
        "display_name": "ekka-desktop",
        "node_type": "desktop"
    });

    if let Some(fingerprint) = device_id_fingerprint {
        body["device_id_fingerprint"] = serde_json::json!(fingerprint);
    }

    let response = client
        .post(format!("{}/engine/nodes/register", engine_url))
        .header("Authorization", format!("Bearer {}", user_jwt))
        .header("Content-Type", "application/json")
        .header("X-EKKA-PROOF-TYPE", "jwt")
        .header("X-REQUEST-ID", &request_id)
        .header("X-EKKA-CORRELATION-ID", &request_id)
        .header("X-EKKA-MODULE", "desktop.node_auth")
        .header("X-EKKA-ACTION", "register")
        .header("X-EKKA-CLIENT", "ekka-desktop")
        .header("X-EKKA-CLIENT-VERSION", "0.2.0")
        .json(&body)
        .send()
        .map_err(|e| NodeAuthError::HttpError(format!("Request failed: {}", e)))?;

    let status = response.status();

    // 201 = created, 409 = already exists (both are OK)
    if status.as_u16() == 201 || status.as_u16() == 409 {
        // For 409, engine returns { error: "node_exists", message: "..." }
        // We construct a synthetic response
        if status.as_u16() == 409 {
            tracing::info!(
                op = "node_auth.register.exists",
                node_id = %node_id,
                "Node already registered (409), continuing to challenge"
            );
            return Ok(RegisterNodeResponse {
                node_id: node_id.to_string(),
                tenant_id: String::new(), // Will be filled from session
                status: "active".to_string(),
                registered_at: None,
            });
        }

        let result: RegisterNodeResponse = response
            .json()
            .map_err(|e| NodeAuthError::HttpError(format!("Parse error: {}", e)))?;
        return Ok(result);
    }

    let body = response.text().unwrap_or_default();
    Err(NodeAuthError::HttpError(format!(
        "Register failed ({}): {}",
        status, body
    )))
}

/// Get challenge for node authentication
pub fn get_challenge(engine_url: &str, node_id: &Uuid) -> Result<ChallengeResponse, NodeAuthError> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| NodeAuthError::HttpError(format!("Client build error: {}", e)))?;

    let request_id = Uuid::new_v4().to_string();

    let response = client
        .post(format!("{}/engine/nodes/challenge", engine_url))
        .header("Content-Type", "application/json")
        .header("X-EKKA-PROOF-TYPE", "anonymous")
        .header("X-REQUEST-ID", &request_id)
        .header("X-EKKA-CORRELATION-ID", &request_id)
        .header("X-EKKA-MODULE", "desktop.node_auth")
        .header("X-EKKA-ACTION", "challenge")
        .header("X-EKKA-CLIENT", "ekka-desktop")
        .header("X-EKKA-CLIENT-VERSION", "0.2.0")
        .json(&serde_json::json!({ "node_id": node_id.to_string() }))
        .send()
        .map_err(|e| NodeAuthError::HttpError(format!("Request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(NodeAuthError::HttpError(format!(
            "Challenge failed ({}): {}",
            status, body
        )));
    }

    let result: ChallengeResponse = response
        .json()
        .map_err(|e| NodeAuthError::HttpError(format!("Parse error: {}", e)))?;

    Ok(result)
}

/// Create session by signing challenge
pub fn create_session(
    engine_url: &str,
    node_id: &Uuid,
    challenge_id: &str,
    signature_b64: &str,
) -> Result<SessionResponse, NodeAuthError> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| NodeAuthError::HttpError(format!("Client build error: {}", e)))?;

    let request_id = Uuid::new_v4().to_string();

    let response = client
        .post(format!("{}/engine/nodes/session", engine_url))
        .header("Content-Type", "application/json")
        .header("X-EKKA-PROOF-TYPE", "ed25519")
        .header("X-REQUEST-ID", &request_id)
        .header("X-EKKA-CORRELATION-ID", &request_id)
        .header("X-EKKA-MODULE", "desktop.node_auth")
        .header("X-EKKA-ACTION", "session")
        .header("X-EKKA-CLIENT", "ekka-desktop")
        .header("X-EKKA-CLIENT-VERSION", "0.2.0")
        .json(&serde_json::json!({
            "node_id": node_id.to_string(),
            "challenge_id": challenge_id,
            "signature_b64": signature_b64
        }))
        .send()
        .map_err(|e| NodeAuthError::HttpError(format!("Request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(NodeAuthError::HttpError(format!(
            "Session failed ({}): {}",
            status, body
        )));
    }

    let result: SessionResponse = response
        .json()
        .map_err(|e| NodeAuthError::HttpError(format!("Parse error: {}", e)))?;

    Ok(result)
}

// =============================================================================
// Orchestration
// =============================================================================

/// Bootstrap result containing identity and optional session
pub struct BootstrapResult {
    pub identity: NodeIdentity,
    pub session: Option<NodeSession>,
    pub registered: bool,
}

/// Ensure node identity exists (load or create)
///
/// This is called during engine_connect to set up node identity.
/// Does NOT require authentication - just ensures keypair exists.
pub fn ensure_node_identity(
    home_path: &PathBuf,
    node_id: Uuid,
    device_fingerprint: Option<&str>,
) -> Result<NodeIdentity, NodeAuthError> {
    // Try to load existing identity
    if let Some(existing) = load_node_identity(home_path)? {
        // Verify node_id matches
        if existing.node_id != node_id {
            return Err(NodeAuthError::IdentityMismatch(format!(
                "node_identity.json has node_id {} but marker has {}",
                existing.node_id, node_id
            )));
        }

        // Verify private key exists
        if !private_key_exists(home_path, &node_id) {
            // Private key missing - regenerate
            tracing::warn!(
                op = "node_auth.key_missing",
                node_id = %node_id,
                "Private key missing from vault, regenerating"
            );

            let (signing_key, verifying_key) = generate_keypair();
            store_private_key_encrypted(home_path, &node_id, &signing_key, device_fingerprint)?;

            // Update identity with new public key
            let identity = NodeIdentity::new(node_id, &verifying_key);
            save_node_identity(home_path, &identity)?;

            return Ok(identity);
        }

        return Ok(existing);
    }

    // Create new identity
    tracing::info!(
        op = "node_auth.create_identity",
        node_id = %node_id,
        "Creating new node identity"
    );

    let (signing_key, verifying_key) = generate_keypair();
    store_private_key_encrypted(home_path, &node_id, &signing_key, device_fingerprint)?;

    let identity = NodeIdentity::new(node_id, &verifying_key);
    save_node_identity(home_path, &identity)?;

    Ok(identity)
}

/// Bootstrap full node session
///
/// 1. Ensure identity exists
/// 2. Register node (idempotent)
/// 3. Get challenge
/// 4. Sign nonce
/// 5. Create session
pub fn bootstrap_node_session(
    home_path: &PathBuf,
    node_id: Uuid,
    engine_url: &str,
    user_jwt: &str,
    default_workspace_id: &str,
    device_fingerprint: Option<&str>,
) -> Result<BootstrapResult, NodeAuthError> {
    // Step 1: Ensure identity
    let identity = ensure_node_identity(home_path, node_id, device_fingerprint)?;

    // Step 2: Register node (idempotent)
    tracing::info!(
        op = "node_auth.register",
        node_id = %node_id,
        workspace_id = %default_workspace_id,
        "Registering node with engine"
    );

    let register_result = register_node(
        engine_url,
        user_jwt,
        &node_id,
        &identity.public_key_b64,
        default_workspace_id,
        device_fingerprint,
    )?;

    // Registration succeeded (HTTP 201) - status should be "active"
    tracing::info!(
        op = "node_auth.register.ok",
        node_id = %register_result.node_id,
        status = %register_result.status,
        "Node registered successfully"
    );

    // Step 3: Get challenge
    tracing::info!(
        op = "node_auth.challenge",
        node_id = %node_id,
        "Getting challenge from engine"
    );

    let challenge = get_challenge(engine_url, &node_id)?;

    // Step 4: Load private key and sign nonce
    let signing_key = load_private_key_encrypted(home_path, &node_id, device_fingerprint)?;

    let nonce_bytes = BASE64
        .decode(&challenge.nonce_b64)
        .map_err(|e| NodeAuthError::CryptoError(format!("Invalid nonce base64: {}", e)))?;

    // Sign RAW nonce bytes
    let signature = sign_nonce(&signing_key, &nonce_bytes);
    let signature_b64 = BASE64.encode(signature.to_bytes());

    // Drop signing key from memory
    drop(signing_key);

    // Step 5: Create session
    tracing::info!(
        op = "node_auth.session",
        node_id = %node_id,
        challenge_id = %challenge.challenge_id,
        "Creating node session"
    );

    let session_response = create_session(
        engine_url,
        &node_id,
        &challenge.challenge_id,
        &signature_b64,
    )?;

    let session = NodeSession {
        token: session_response.token,
        session_id: Uuid::parse_str(&session_response.session_id)
            .map_err(|e| NodeAuthError::HttpError(format!("Invalid session_id: {}", e)))?,
        tenant_id: Uuid::parse_str(&session_response.tenant_id)
            .map_err(|e| NodeAuthError::HttpError(format!("Invalid tenant_id: {}", e)))?,
        workspace_id: Uuid::parse_str(&session_response.workspace_id)
            .map_err(|e| NodeAuthError::HttpError(format!("Invalid workspace_id: {}", e)))?,
        expires_at: DateTime::parse_from_rfc3339(&session_response.expires_at_iso_utc)
            .map_err(|e| NodeAuthError::HttpError(format!("Invalid expires_at: {}", e)))?
            .with_timezone(&Utc),
    };

    tracing::info!(
        op = "node_auth.session_created",
        node_id = %node_id,
        session_id = %session.session_id,
        tenant_id = %session.tenant_id,
        workspace_id = %session.workspace_id,
        "Node session established"
    );

    Ok(BootstrapResult {
        identity,
        session: Some(session),
        registered: true,
    })
}

/// Refresh node session (challenge/sign/session only)
pub fn refresh_node_session(
    home_path: &PathBuf,
    node_id: &Uuid,
    engine_url: &str,
    device_fingerprint: Option<&str>,
) -> Result<NodeSession, NodeAuthError> {
    // Get challenge
    let challenge = get_challenge(engine_url, node_id)?;

    // Load private key and sign
    let signing_key = load_private_key_encrypted(home_path, node_id, device_fingerprint)?;

    let nonce_bytes = BASE64
        .decode(&challenge.nonce_b64)
        .map_err(|e| NodeAuthError::CryptoError(format!("Invalid nonce base64: {}", e)))?;

    let signature = sign_nonce(&signing_key, &nonce_bytes);
    let signature_b64 = BASE64.encode(signature.to_bytes());

    drop(signing_key);

    // Create session
    let session_response = create_session(
        engine_url,
        node_id,
        &challenge.challenge_id,
        &signature_b64,
    )?;

    let session = NodeSession {
        token: session_response.token,
        session_id: Uuid::parse_str(&session_response.session_id)
            .map_err(|e| NodeAuthError::HttpError(format!("Invalid session_id: {}", e)))?,
        tenant_id: Uuid::parse_str(&session_response.tenant_id)
            .map_err(|e| NodeAuthError::HttpError(format!("Invalid tenant_id: {}", e)))?,
        workspace_id: Uuid::parse_str(&session_response.workspace_id)
            .map_err(|e| NodeAuthError::HttpError(format!("Invalid workspace_id: {}", e)))?,
        expires_at: DateTime::parse_from_rfc3339(&session_response.expires_at_iso_utc)
            .map_err(|e| NodeAuthError::HttpError(format!("Invalid expires_at: {}", e)))?
            .with_timezone(&Utc),
    };

    Ok(session)
}

// =============================================================================
// Runner Integration
// =============================================================================

/// Runner configuration using node session (NOT internal service key)
#[derive(Debug, Clone)]
pub struct NodeSessionRunnerConfig {
    pub engine_url: String,
    pub node_url: String,
    pub session_token: String,
    pub tenant_id: Uuid,
    pub workspace_id: Uuid,
    pub node_id: Uuid,
}

impl NodeSessionRunnerConfig {
    pub fn from_session(session: &NodeSession, node_id: Uuid) -> Result<Self, String> {
        let engine_url = std::env::var("ENGINE_URL")
            .or_else(|_| std::env::var("EKKA_ENGINE_URL"))
            .map_err(|_| "ENGINE_URL or EKKA_ENGINE_URL required")?;

        let node_url = std::env::var("NODE_URL").unwrap_or_else(|_| "http://127.0.0.1:7777".to_string());

        Ok(Self {
            engine_url,
            node_url,
            session_token: session.token.clone(),
            tenant_id: session.tenant_id,
            workspace_id: session.workspace_id,
            node_id,
        })
    }

    /// Get security headers for runner HTTP calls
    ///
    /// Uses node_session proof type instead of internal
    pub fn security_headers(&self) -> Vec<(&'static str, String)> {
        vec![
            ("Authorization", format!("Bearer {}", self.session_token)),
            ("X-EKKA-PROOF-TYPE", "node_session".to_string()),
            ("X-REQUEST-ID", Uuid::new_v4().to_string()),
            ("X-EKKA-CORRELATION-ID", Uuid::new_v4().to_string()),
            ("X-EKKA-MODULE", "engine.runner_tasks".to_string()),
            ("X-EKKA-CLIENT", "ekka-desktop".to_string()),
            ("X-EKKA-CLIENT-VERSION", "0.2.0".to_string()),
            ("X-EKKA-NODE-ID", self.node_id.to_string()),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generation() {
        let (signing_key, verifying_key) = generate_keypair();

        // Verify signature works
        let message = b"test message";
        let signature = signing_key.sign(message);

        assert!(verifying_key.verify_strict(message, &signature).is_ok());
    }

    #[test]
    fn test_node_identity_serialization() {
        let node_id = Uuid::new_v4();
        let (_, verifying_key) = generate_keypair();

        let identity = NodeIdentity::new(node_id, &verifying_key);

        let json = serde_json::to_string_pretty(&identity).unwrap();
        let parsed: NodeIdentity = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.node_id, node_id);
        assert_eq!(parsed.algorithm, "ed25519");
        assert_eq!(parsed.schema_version, "node_identity.v1");
    }

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
