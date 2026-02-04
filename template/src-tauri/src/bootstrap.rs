//! Home directory bootstrap
//!
//! Handles initialization and resolution of the EKKA home directory.

use ekka_sdk_core::ekka_home_bootstrap::{BootstrapConfig, EpochSource, HomeBootstrap, HomeStrategy};
use std::path::PathBuf;

/// Standard bootstrap configuration for EKKA Desktop
pub fn bootstrap_config() -> BootstrapConfig {
    BootstrapConfig {
        app_name: "ekka-desktop".to_string(),
        default_folder_name: ".ekka-desktop".to_string(),
        home_strategy: HomeStrategy::DataHome {
            env_var: "EKKA_DATA_HOME".to_string(),
        },
        marker_filename: ".ekka-marker.json".to_string(),
        keychain_service: "ai.ekka.desktop".to_string(),
        subdirs: vec!["vault".to_string(), "db".to_string(), "tmp".to_string()],
        epoch_source: EpochSource::EnvVar("EKKA_SECURITY_EPOCH".to_string()),
        storage_layout_version: "v1".to_string(),
    }
}

/// Resolve the home path without initializing
pub fn resolve_home_path() -> Result<PathBuf, String> {
    let config = bootstrap_config();
    let bootstrap = HomeBootstrap::new(config).map_err(|e| e.to_string())?;
    Ok(bootstrap.home_path().to_path_buf())
}

/// Initialize home directory and return the bootstrap instance
pub fn initialize_home() -> Result<HomeBootstrap, String> {
    let config = bootstrap_config();
    let bootstrap = HomeBootstrap::new(config).map_err(|e| e.to_string())?;
    bootstrap.initialize().map_err(|e| e.to_string())?;
    Ok(bootstrap)
}
