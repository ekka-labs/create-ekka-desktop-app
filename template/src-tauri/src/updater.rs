//! EKKA Desktop Core Updater
//!
//! Platform-level self-update mechanism using the built-in updater plugin.
//! This runs AFTER node identity is resolved but BEFORE login/engine spawn.
//!
//! # Endpoints Used
//! - GET /desktop/releases/latest.json (manifest, requires X-EKKA-NODE-ID)
//! - GET /desktop/releases/download/:version/:platform (artifact)
//!
//! # Security Model
//! - Node identity REQUIRED (X-EKKA-NODE-ID header)
//! - Artifacts are cryptographically signed
//! - Updater verifies signature before applying
//!
//! # Error Semantics
//! - Network/manifest errors → log, return Ok (soft fail, app continues)
//! - Signature/integrity errors → return Err (FATAL, app exits)

use http::{HeaderName, HeaderValue};
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use uuid::Uuid;

/// Check for updates and apply if available.
///
/// # Soft Failures (log + continue)
/// - Network errors
/// - Manifest fetch failures (404, timeout, etc.)
/// - Server unavailable
///
/// # Hard Failures (FATAL)
/// - Signature verification failure
/// - Integrity check failure
pub async fn check_and_apply_update(app: &AppHandle, node_id: Uuid) -> Result<(), UpdateError> {
    tracing::info!(
        op = "desktop.updater.check",
        node_id = %node_id,
        endpoint = "https://api.ekka.ai/desktop/releases/latest.json",
        "Checking for desktop updates (node-gated)"
    );

    // Build updater with node_id header
    let updater = match app
        .updater_builder()
        .header(
            HeaderName::from_static("x-ekka-node-id"),
            HeaderValue::from_str(&node_id.to_string()).unwrap(),
        )
        .and_then(|b| {
            b.header(
                HeaderName::from_static("x-ekka-client"),
                HeaderValue::from_static("ekka-desktop"),
            )
        })
        .and_then(|b| {
            b.header(
                HeaderName::from_static("x-ekka-client-version"),
                HeaderValue::from_static("0.2.0"),
            )
        })
        .map(|b| b.build())
    {
        Ok(Ok(u)) => u,
        Ok(Err(e)) => {
            // Soft fail: updater init error (non-security)
            tracing::warn!(
                op = "desktop.updater.unavailable",
                node_id = %node_id,
                error = %e,
                "Updater unavailable - continuing without update check"
            );
            return Ok(());
        }
        Err(e) => {
            // Soft fail: header build error (non-security)
            tracing::warn!(
                op = "desktop.updater.unavailable",
                node_id = %node_id,
                error = %e,
                "Updater unavailable - continuing without update check"
            );
            return Ok(());
        }
    };

    // Check for available update
    let update = match updater.check().await {
        Ok(Some(update)) => {
            tracing::info!(
                op = "desktop.updater.available",
                node_id = %node_id,
                current_version = %update.current_version,
                new_version = %update.version,
                "Update available"
            );
            update
        }
        Ok(None) => {
            tracing::info!(
                op = "desktop.updater.current",
                node_id = %node_id,
                "Desktop is up to date"
            );
            return Ok(());
        }
        Err(e) => {
            // Soft fail: network error, 404, manifest parse error, etc.
            tracing::warn!(
                op = "desktop.updater.unavailable",
                node_id = %node_id,
                error = %e,
                "Update check failed - continuing without update"
            );
            return Ok(());
        }
    };

    // Download and install the update
    tracing::info!(
        op = "desktop.updater.download",
        node_id = %node_id,
        version = %update.version,
        url = %update.download_url,
        "Downloading update"
    );

    let mut downloaded: usize = 0;

    let result = update
        .download_and_install(
            |chunk_len, content_len| {
                downloaded += chunk_len;
                let percent = if let Some(total) = content_len {
                    if total > 0 {
                        (downloaded as f64 / total as f64 * 100.0) as u32
                    } else {
                        0
                    }
                } else {
                    0
                };
                tracing::debug!(
                    op = "desktop.updater.progress",
                    downloaded = downloaded,
                    total = ?content_len,
                    percent = percent,
                    "Download progress"
                );
            },
            || {
                tracing::info!(
                    op = "desktop.updater.download.complete",
                    "Download complete, verifying signature and installing"
                );
            },
        )
        .await;

    if let Err(e) = result {
        let error_str = e.to_string().to_lowercase();

        // HARD FAIL: Signature or integrity errors are FATAL (security)
        if error_str.contains("signature")
            || error_str.contains("integrity")
            || error_str.contains("verification")
            || error_str.contains("invalid")
        {
            tracing::error!(
                op = "desktop.updater.fatal.signature",
                node_id = %node_id,
                error = %e,
                "FATAL: Signature/integrity verification failed"
            );
            return Err(UpdateError::SignatureFailure(e.to_string()));
        }

        // Soft fail: download error, network timeout, etc.
        tracing::warn!(
            op = "desktop.updater.unavailable",
            node_id = %node_id,
            error = %e,
            "Update download/install failed - continuing without update"
        );
        return Ok(());
    }

    tracing::info!(
        op = "desktop.updater.restart",
        node_id = %node_id,
        version = %update.version,
        "Update installed successfully, restarting application"
    );

    // Restart the application to apply update
    app.restart()
}

/// Update error types
#[derive(Debug, Clone)]
pub enum UpdateError {
    /// Signature or integrity verification failed (FATAL - security issue)
    SignatureFailure(String),
}

impl std::fmt::Display for UpdateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UpdateError::SignatureFailure(e) => {
                write!(f, "Signature verification failed: {}", e)
            }
        }
    }
}

impl std::error::Error for UpdateError {}
