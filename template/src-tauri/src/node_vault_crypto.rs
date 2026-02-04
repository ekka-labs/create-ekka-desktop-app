//! Node Vault Cryptography
//!
//! Provides key derivation and AES-256-GCM encryption for node-level secrets.
//! Uses the existing ekka-crypto primitives for consistency.

use crate::device_secret::load_or_create_device_secret;
use ekka_sdk_core::ekka_crypto::{self, KeyDerivationConfig, KeyMaterial};
use std::path::Path;

/// Purpose label for node vault key derivation
const NODE_VAULT_PURPOSE: &str = "node-vault";

/// Derive the encryption key for the node vault
///
/// Key derivation inputs:
/// - device_secret: 32 bytes from device secret file (device-bound)
/// - security_epoch: Current security epoch (for key rotation)
///
/// Note: node_id is NOT used in key derivation because it's a business
/// identifier stored inside the encrypted credentials, not a cryptographic input.
///
/// Uses PBKDF2-SHA256 with 100k iterations (via ekka-crypto).
pub fn derive_node_vault_key(home: &Path, epoch: u32) -> anyhow::Result<KeyMaterial> {
    let device_secret = load_or_create_device_secret(home)?;

    // Convert device secret to hex string for derivation
    let device_secret_hex = hex::encode(device_secret);

    // User context is fixed for node vault (no user-specific data needed)
    let user_context = "node-vault-context";

    let config = KeyDerivationConfig::default();

    let key = ekka_crypto::derive_key(
        &device_secret_hex,
        user_context,
        epoch,
        NODE_VAULT_PURPOSE,
        &config,
    );

    Ok(key)
}

/// Encrypt plaintext bytes using AES-256-GCM
///
/// Returns the encrypted envelope as bytes (version || nonce || ciphertext).
pub fn encrypt_node_value(key: &KeyMaterial, plaintext: &[u8]) -> anyhow::Result<Vec<u8>> {
    ekka_crypto::encrypt(plaintext, key).map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))
}

/// Decrypt ciphertext bytes using AES-256-GCM
///
/// Expects the encrypted envelope format (version || nonce || ciphertext).
pub fn decrypt_node_value(key: &KeyMaterial, ciphertext: &[u8]) -> anyhow::Result<Vec<u8>> {
    ekka_crypto::decrypt(ciphertext, key).map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_derive_node_vault_key_deterministic() {
        let temp_dir = TempDir::new().unwrap();
        let epoch = 1u32;

        let key1 = derive_node_vault_key(temp_dir.path(), epoch).unwrap();
        let key2 = derive_node_vault_key(temp_dir.path(), epoch).unwrap();

        // Same inputs should produce same key
        assert_eq!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn test_derive_node_vault_key_different_epoch() {
        let temp_dir = TempDir::new().unwrap();

        let key1 = derive_node_vault_key(temp_dir.path(), 1).unwrap();
        let key2 = derive_node_vault_key(temp_dir.path(), 2).unwrap();

        // Different epochs should produce different keys
        assert_ne!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let temp_dir = TempDir::new().unwrap();
        let key = derive_node_vault_key(temp_dir.path(), 1).unwrap();

        let plaintext = b"test secret data";
        let ciphertext = encrypt_node_value(&key, plaintext).unwrap();
        let decrypted = decrypt_node_value(&key, &ciphertext).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_decrypt_wrong_key_fails() {
        let temp_dir = TempDir::new().unwrap();

        let key1 = derive_node_vault_key(temp_dir.path(), 1).unwrap();
        let key2 = derive_node_vault_key(temp_dir.path(), 2).unwrap();

        let plaintext = b"secret";
        let ciphertext = encrypt_node_value(&key1, plaintext).unwrap();

        // Decrypting with wrong key should fail
        let result = decrypt_node_value(&key2, &ciphertext);
        assert!(result.is_err());
    }
}
