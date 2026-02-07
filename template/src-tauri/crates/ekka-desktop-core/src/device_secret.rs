//! Device Secret Management
//!
//! Generates and stores a device-bound secret for encrypting node-level data.
//! The device secret is stored as a 32-byte file with 0600 permissions.
//! This secret never leaves the device and is used to derive encryption keys.

use rand::RngCore;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Device secret filename
const DEVICE_SECRET_FILENAME: &str = ".ekka-device-secret";

/// Device secret size in bytes (256 bits)
const DEVICE_SECRET_SIZE: usize = 32;

/// Get the path to the device secret file
pub fn device_secret_path(home: &Path) -> PathBuf {
    home.join(DEVICE_SECRET_FILENAME)
}

/// Load or create the device secret
///
/// If the secret file exists, reads exactly 32 bytes.
/// If not, generates 32 random bytes and writes with 0600 permissions.
///
/// # Returns
/// * `Ok([u8; 32])` - The device secret bytes
/// * `Err` - If file operations fail
pub fn load_or_create_device_secret(home: &Path) -> anyhow::Result<[u8; 32]> {
    let path = device_secret_path(home);

    if path.exists() {
        // Load existing secret
        let mut file = fs::File::open(&path)?;
        let mut secret = [0u8; DEVICE_SECRET_SIZE];
        file.read_exact(&mut secret)?;

        tracing::info!(
            op = "device_secret.ready",
            created = false,
            "Device secret loaded"
        );

        Ok(secret)
    } else {
        // Generate new secret
        let mut secret = [0u8; DEVICE_SECRET_SIZE];
        rand::thread_rng().fill_bytes(&mut secret);

        // Write with secure permissions
        let mut file = fs::File::create(&path)?;
        file.write_all(&secret)?;

        // Set 0600 permissions on Unix
        #[cfg(unix)]
        {
            let perms = fs::Permissions::from_mode(0o600);
            fs::set_permissions(&path, perms)?;
        }

        tracing::info!(
            op = "device_secret.ready",
            created = true,
            "Device secret created"
        );

        Ok(secret)
    }
}
