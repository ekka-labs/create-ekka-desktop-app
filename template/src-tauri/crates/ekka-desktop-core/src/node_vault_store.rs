//! Node Vault Store
//!
//! Encrypted storage for node-level secrets that works before user authentication.
//! Uses AES-256-GCM with device-bound key derivation.
//!
//! Storage layout:
//! ```text
//! {EKKA_HOME}/vault/node/
//!   values/
//!     node_credentials.enc    # Encrypted node credentials
//! ```

use crate::node_vault_crypto::{decrypt_node_value, derive_node_vault_key, encrypt_node_value};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Secret ID for node credentials
pub const SECRET_ID_NODE_CREDENTIALS: &str = "node_credentials";

/// Encrypted value envelope stored on disk
#[derive(Debug, Serialize, Deserialize)]
struct EncryptedEnvelope {
    /// Version for future format changes
    v: u8,
    /// Base64-encoded encrypted data (version || nonce || ciphertext)
    data_b64: String,
}

impl EncryptedEnvelope {
    const CURRENT_VERSION: u8 = 1;

    fn new(encrypted_bytes: &[u8]) -> Self {
        Self {
            v: Self::CURRENT_VERSION,
            data_b64: BASE64.encode(encrypted_bytes),
        }
    }

    fn decode(&self) -> anyhow::Result<Vec<u8>> {
        if self.v != Self::CURRENT_VERSION {
            anyhow::bail!("Unsupported envelope version: {}", self.v);
        }
        BASE64
            .decode(&self.data_b64)
            .map_err(|e| anyhow::anyhow!("Base64 decode failed: {}", e))
    }
}

/// Get the node vault directory path
pub fn node_vault_dir(home: &Path) -> PathBuf {
    home.join("vault").join("node")
}

/// Get the node vault values directory path
pub fn node_vault_values_dir(home: &Path) -> PathBuf {
    node_vault_dir(home).join("values")
}

/// Get the path for a specific secret
fn secret_path(home: &Path, secret_id: &str) -> PathBuf {
    node_vault_values_dir(home).join(format!("{}.enc", secret_id))
}

/// Ensure the node vault directory structure exists
fn ensure_dirs(home: &Path) -> anyhow::Result<()> {
    let values_dir = node_vault_values_dir(home);
    if !values_dir.exists() {
        fs::create_dir_all(&values_dir)?;

        // Set secure permissions on Unix
        #[cfg(unix)]
        {
            let perms = fs::Permissions::from_mode(0o700);
            fs::set_permissions(&node_vault_dir(home), perms.clone())?;
            fs::set_permissions(&values_dir, perms)?;
        }
    }
    Ok(())
}

/// Write a secret to the node vault
///
/// Encrypts the plaintext using the derived key and writes atomically.
pub fn write_node_secret(
    home: &Path,
    epoch: u32,
    secret_id: &str,
    plaintext: &[u8],
) -> anyhow::Result<()> {
    ensure_dirs(home)?;

    // Derive key (device-bound, no node_id needed)
    let key = derive_node_vault_key(home, epoch)?;

    // Encrypt
    let encrypted = encrypt_node_value(&key, plaintext)?;

    // Create envelope
    let envelope = EncryptedEnvelope::new(&encrypted);
    let json = serde_json::to_string_pretty(&envelope)?;

    // Atomic write: temp file + rename
    let final_path = secret_path(home, secret_id);
    let temp_path = final_path.with_extension("enc.tmp");

    {
        let mut file = fs::File::create(&temp_path)?;
        file.write_all(json.as_bytes())?;
        file.sync_all()?;

        // Set secure permissions on Unix
        #[cfg(unix)]
        {
            let perms = fs::Permissions::from_mode(0o600);
            fs::set_permissions(&temp_path, perms)?;
        }
    }

    fs::rename(&temp_path, &final_path)?;

    tracing::info!(
        op = "node_vault.write",
        secret_id = secret_id,
        "Node secret written"
    );

    Ok(())
}

/// Read a secret from the node vault
///
/// Returns None if the secret doesn't exist.
pub fn read_node_secret(
    home: &Path,
    epoch: u32,
    secret_id: &str,
) -> anyhow::Result<Option<Vec<u8>>> {
    let path = secret_path(home, secret_id);

    if !path.exists() {
        tracing::info!(
            op = "node_vault.read",
            secret_id = secret_id,
            hit = false,
            "Node secret not found"
        );
        return Ok(None);
    }

    // Read envelope
    let content = fs::read_to_string(&path)?;
    let envelope: EncryptedEnvelope = serde_json::from_str(&content)?;

    // Decode base64
    let encrypted = envelope.decode()?;

    // Derive key (device-bound, no node_id needed)
    let key = derive_node_vault_key(home, epoch)?;

    // Decrypt
    let plaintext = decrypt_node_value(&key, &encrypted)?;

    tracing::info!(
        op = "node_vault.read",
        secret_id = secret_id,
        hit = true,
        "Node secret read"
    );

    Ok(Some(plaintext))
}

/// Delete a secret from the node vault
pub fn delete_node_secret(home: &Path, secret_id: &str) -> anyhow::Result<()> {
    let path = secret_path(home, secret_id);

    if path.exists() {
        fs::remove_file(&path)?;
        tracing::info!(
            op = "node_vault.delete",
            secret_id = secret_id,
            "Node secret deleted"
        );
    }

    Ok(())
}

/// Check if a secret exists in the node vault
pub fn has_node_secret(home: &Path, secret_id: &str) -> bool {
    secret_path(home, secret_id).exists()
}
