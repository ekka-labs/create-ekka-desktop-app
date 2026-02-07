//! Security Epoch Resolution
//!
//! Resolves the security epoch used for vault key derivation.
//! Resolution order:
//! 1. EKKA_SECURITY_EPOCH env var (override for dev/testing)
//! 2. Marker file epoch_seen field (canonical source)
//! 3. Default to 1 (new installations)

use std::path::Path;
use std::sync::OnceLock;

/// Cached resolved epoch (env var source only - marker is read fresh)
static ENV_EPOCH_CACHE: OnceLock<Option<u32>> = OnceLock::new();

/// Source of the resolved epoch
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EpochSource {
    Env,
    Marker,
    Default,
}

impl std::fmt::Display for EpochSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EpochSource::Env => write!(f, "env"),
            EpochSource::Marker => write!(f, "marker"),
            EpochSource::Default => write!(f, "default"),
        }
    }
}

/// Resolve security epoch from env var
fn try_env_epoch() -> Option<u32> {
    *ENV_EPOCH_CACHE.get_or_init(|| {
        std::env::var("EKKA_SECURITY_EPOCH")
            .ok()
            .and_then(|s| s.parse().ok())
    })
}

/// Read epoch_seen from marker file
fn try_marker_epoch(home: &Path) -> Option<u32> {
    let marker_path = home.join(".ekka-marker.json");
    let content = std::fs::read_to_string(&marker_path).ok()?;
    let marker: serde_json::Value = serde_json::from_str(&content).ok()?;
    marker.get("epoch_seen").and_then(|v| v.as_u64()).map(|v| v as u32)
}

/// Resolve security epoch with precedence: env > marker > default
///
/// Logs the resolution once per unique (home, source) combination.
pub fn resolve_security_epoch(home: &Path) -> u32 {
    let (epoch, source) = resolve_with_source(home);

    tracing::info!(
        op = "security_epoch.resolved",
        source = %source,
        value = epoch,
        "Security epoch resolved"
    );

    epoch
}

/// Resolve epoch and return both value and source
pub fn resolve_with_source(home: &Path) -> (u32, EpochSource) {
    // 1. Check env var override
    if let Some(epoch) = try_env_epoch() {
        return (epoch, EpochSource::Env);
    }

    // 2. Read from marker file
    if let Some(epoch) = try_marker_epoch(home) {
        return (epoch, EpochSource::Marker);
    }

    // 3. Default
    (1, EpochSource::Default)
}
