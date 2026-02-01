//! Tauri commands
//!
//! Entry points for TypeScript → Rust communication.

use crate::bootstrap::initialize_home;
use crate::grants::require_home_granted;
use crate::handlers;
use crate::node_auth;
use crate::ops::{auth, runtime};
use crate::state::EngineState;
use crate::types::{EngineRequest, EngineResponse};
use serde_json::Value;
use tauri::State;

/// Initialize the SDK and store in state
#[tauri::command]
pub fn engine_connect(state: State<EngineState>) -> Result<(), String> {
    let mut connected = state.connected.lock().map_err(|e| e.to_string())?;

    if *connected {
        return Ok(());
    }

    // Initialize home directory structure
    let bootstrap = initialize_home()?;

    // Store home path
    if let Ok(mut hp) = state.home_path.lock() {
        *hp = Some(bootstrap.home_path().to_path_buf());
    }

    // Store node_id from marker
    let marker_path = bootstrap.home_path().join(".ekka-marker.json");
    if let Ok(content) = std::fs::read_to_string(&marker_path) {
        if let Ok(marker) = serde_json::from_str::<Value>(&content) {
            if let Some(node_id_str) = marker.get("node_id").and_then(|v| v.as_str()) {
                if let Ok(node_id) = uuid::Uuid::parse_str(node_id_str) {
                    if let Ok(mut nid) = state.node_id.lock() {
                        *nid = Some(node_id);
                    }
                }
            }
        }
    }

    *connected = true;
    Ok(())
}

/// Clean up
#[tauri::command]
pub fn engine_disconnect(state: State<EngineState>) {
    // Clear vault cache first (before clearing auth)
    state.clear_vault_cache();

    if let Ok(mut connected) = state.connected.lock() {
        *connected = false;
    }
    if let Ok(mut auth) = state.auth.lock() {
        *auth = None;
    }
}

/// Main RPC dispatcher - routes all operations to handlers
#[tauri::command]
pub fn engine_request(req: EngineRequest, state: State<EngineState>) -> EngineResponse {
    // Check connected (except for status operations)
    if !matches!(req.op.as_str(), "runtime.info" | "home.status" | "vault.status") {
        let connected = match state.connected.lock() {
            Ok(guard) => *guard,
            Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
        };

        if !connected {
            return EngineResponse::err(
                "NOT_CONNECTED",
                "Engine not connected. Call engine_connect first.",
            );
        }
    }

    // Dispatch based on operation
    match req.op.as_str() {
        // Auth
        "auth.set" => auth::handle_set(&req.payload, &state),

        // Node Session Authentication
        "nodeSession.ensureIdentity" => handle_ensure_node_identity(&state),
        "nodeSession.bootstrap" => handle_bootstrap_node_session(&req.payload, &state),
        "nodeSession.status" => handle_node_session_status(&state),

        // Home (use new SDK handlers)
        "home.status" => handlers::home::handle_status(&state),
        "home.grant" => handlers::home::handle_grant(&state),

        // Paths (new SDK operations)
        "paths.check" => handlers::paths::handle_check(&req.payload, &state),
        "paths.list" => handlers::paths::handle_list(&req.payload, &state),
        "paths.get" => handlers::paths::handle_get(&req.payload, &state),
        "paths.request" => handlers::paths::handle_request(&req.payload, &state),
        "paths.remove" => handlers::paths::handle_remove(&req.payload, &state),

        // Runtime
        "runtime.info" => runtime::handle_info(&state),

        // Runner status (local runner loop status)
        "runner.status" => {
            let status = state.runner_state.get();
            EngineResponse::ok(serde_json::json!(status))
        }

        // Database (require HOME_GRANTED)
        "db.get" | "db.put" | "db.delete" => {
            if let Err(e) = require_home_granted(&state) {
                return e;
            }
            EngineResponse::err("NOT_IMPLEMENTED", &format!("{} not yet implemented", req.op))
        }

        // Queue (require HOME_GRANTED)
        "queue.enqueue" | "queue.claim" | "queue.ack" | "queue.nack" | "queue.heartbeat" => {
            if let Err(e) = require_home_granted(&state) {
                return e;
            }
            EngineResponse::err("NOT_IMPLEMENTED", &format!("{} not yet implemented", req.op))
        }

        // Pipeline (require HOME_GRANTED)
        "pipeline.submit" | "pipeline.events" => {
            if let Err(e) = require_home_granted(&state) {
                return e;
            }
            EngineResponse::err("NOT_IMPLEMENTED", &format!("{} not yet implemented", req.op))
        }

        // Vault - Status/Capabilities (require HOME_GRANTED)
        "vault.status" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_status(&state)
        }
        "vault.capabilities" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_capabilities(&state)
        }

        // Vault - Secrets (require HOME_GRANTED)
        "vault.secrets.list" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_secrets_list(&req.payload, &state)
        }
        "vault.secrets.get" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_secrets_get(&req.payload, &state)
        }
        "vault.secrets.create" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_secrets_create(&req.payload, &state)
        }
        "vault.secrets.update" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_secrets_update(&req.payload, &state)
        }
        "vault.secrets.delete" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_secrets_delete(&req.payload, &state)
        }
        "vault.secrets.upsert" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_secrets_upsert(&req.payload, &state)
        }

        // Vault - Bundles (require HOME_GRANTED)
        "vault.bundles.list" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_bundles_list(&req.payload, &state)
        }
        "vault.bundles.get" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_bundles_get(&req.payload, &state)
        }
        "vault.bundles.create" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_bundles_create(&req.payload, &state)
        }
        "vault.bundles.rename" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_bundles_rename(&req.payload, &state)
        }
        "vault.bundles.delete" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_bundles_delete(&req.payload, &state)
        }
        "vault.bundles.listSecrets" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_bundles_list_secrets(&req.payload, &state)
        }
        "vault.bundles.addSecret" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_bundles_add_secret(&req.payload, &state)
        }
        "vault.bundles.removeSecret" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_bundles_remove_secret(&req.payload, &state)
        }

        // Vault - Files (require HOME_GRANTED)
        "vault.files.writeText" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_files_write_text(&req.payload, &state)
        }
        "vault.files.writeBytes" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_files_write_bytes(&req.payload, &state)
        }
        "vault.files.readText" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_files_read_text(&req.payload, &state)
        }
        "vault.files.readBytes" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_files_read_bytes(&req.payload, &state)
        }
        "vault.files.list" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_files_list(&req.payload, &state)
        }
        "vault.files.exists" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_files_exists(&req.payload, &state)
        }
        "vault.files.delete" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_files_delete(&req.payload, &state)
        }
        "vault.files.mkdir" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_files_mkdir(&req.payload, &state)
        }
        "vault.files.move" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_files_move(&req.payload, &state)
        }

        // Vault - Injection (require HOME_GRANTED) - DEFERRED
        "vault.attachSecretsToConnector" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_attach_secrets_to_connector(&req.payload, &state)
        }
        "vault.injectSecretsIntoRun" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_inject_secrets_into_run(&req.payload, &state)
        }

        // Vault - Audit (require HOME_GRANTED)
        "vault.audit.list" => {
            if let Err(e) = require_home_granted(&state) { return e; }
            handlers::vault::handle_audit_list(&req.payload, &state)
        }

        // Legacy vault operations (deprecated)
        "vault.init" | "vault.isInitialized" | "vault.install" | "vault.listBundles"
        | "vault.showPolicy" | "vault.folders.list" | "vault.folders.get"
        | "vault.folders.create" | "vault.folders.rename" | "vault.folders.delete" => {
            if let Err(e) = require_home_granted(&state) {
                return e;
            }
            EngineResponse::err("DEPRECATED", &format!("{} is deprecated, use vault.* API instead", req.op))
        }

        // Debug utilities (dev mode only)
        "debug.isDevMode" => handle_is_dev_mode(),
        "debug.openFolder" => handle_open_folder(&req.payload, &state),
        "debug.resolveVaultPath" => handle_resolve_vault_path(&req.payload, &state),

        // Unknown
        _ => EngineResponse::err("INVALID_OP", &format!("Unknown operation: {}", req.op)),
    }
}

// =============================================================================
// Debug Handlers
// =============================================================================

/// Check if running in development mode (EKKA_ENV=development)
fn handle_is_dev_mode() -> EngineResponse {
    let is_dev = std::env::var("EKKA_ENV")
        .map(|v| v == "development")
        .unwrap_or(false);

    EngineResponse::ok(serde_json::json!({ "isDevMode": is_dev }))
}

/// Open a folder in the system file browser
fn handle_open_folder(payload: &Value, state: &EngineState) -> EngineResponse {
    // Only allow in dev mode
    let is_dev = std::env::var("EKKA_ENV")
        .map(|v| v == "development")
        .unwrap_or(false);

    if !is_dev {
        return EngineResponse::err("DEV_MODE_ONLY", "debug.openFolder is only available in development mode");
    }

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "path is required"),
    };

    // If path starts with vault://, resolve it to filesystem path
    let resolved_path = if path.starts_with("vault://") {
        // Get home path
        let home_path = match state.home_path.lock() {
            Ok(guard) => match guard.as_ref() {
                Some(p) => p.clone(),
                None => return EngineResponse::err("NOT_CONNECTED", "Home path not initialized"),
            },
            Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
        };

        // vault://tmp/... -> {EKKA_HOME}/vault/tmp/...
        let vault_path = path.strip_prefix("vault://").unwrap_or(path);
        home_path.join("vault").join(vault_path)
    } else {
        std::path::PathBuf::from(path)
    };

    // Check if path exists
    if !resolved_path.exists() {
        return EngineResponse::err("PATH_NOT_FOUND", &format!("Path does not exist: {}", resolved_path.display()));
    }

    // Open folder using system default
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&resolved_path)
            .spawn()
            .map_err(|e| e.to_string())
            .ok();
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&resolved_path)
            .spawn()
            .map_err(|e| e.to_string())
            .ok();
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&resolved_path)
            .spawn()
            .map_err(|e| e.to_string())
            .ok();
    }

    EngineResponse::ok(serde_json::json!({
        "ok": true,
        "path": resolved_path.display().to_string()
    }))
}

/// Resolve a vault:// path to filesystem path (dev mode only)
fn handle_resolve_vault_path(payload: &Value, state: &EngineState) -> EngineResponse {
    // Only allow in dev mode
    let is_dev = std::env::var("EKKA_ENV")
        .map(|v| v == "development")
        .unwrap_or(false);

    if !is_dev {
        return EngineResponse::err("DEV_MODE_ONLY", "debug.resolveVaultPath is only available in development mode");
    }

    let vault_uri = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "path is required"),
    };

    if !vault_uri.starts_with("vault://") {
        return EngineResponse::err("INVALID_PATH", "Path must start with vault://");
    }

    // Get home path
    let home_path = match state.home_path.lock() {
        Ok(guard) => match guard.as_ref() {
            Some(p) => p.clone(),
            None => return EngineResponse::err("NOT_CONNECTED", "Home path not initialized"),
        },
        Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
    };

    // vault://tmp/... -> {EKKA_HOME}/vault/tmp/...
    let vault_path = vault_uri.strip_prefix("vault://").unwrap_or(vault_uri);
    let resolved_path = home_path.join("vault").join(vault_path);

    EngineResponse::ok(serde_json::json!({
        "vaultUri": vault_uri,
        "filesystemPath": resolved_path.display().to_string(),
        "exists": resolved_path.exists()
    }))
}

// =============================================================================
// Node Session Handlers
// =============================================================================

/// Ensure node identity exists (keypair generation)
///
/// Called during startup to ensure node has an Ed25519 keypair.
/// Does NOT require authentication.
fn handle_ensure_node_identity(state: &EngineState) -> EngineResponse {
    // Get home_path and node_id
    let home_path = match state.home_path.lock() {
        Ok(guard) => match guard.as_ref() {
            Some(p) => p.clone(),
            None => return EngineResponse::err("NOT_CONNECTED", "Home path not initialized"),
        },
        Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
    };

    let node_id = match state.node_id.lock() {
        Ok(guard) => match guard.as_ref() {
            Some(id) => *id,
            None => return EngineResponse::err("NOT_CONNECTED", "Node ID not initialized"),
        },
        Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
    };

    // Get device fingerprint from marker if available
    let marker_path = home_path.join(".ekka-marker.json");
    let device_fingerprint = std::fs::read_to_string(&marker_path)
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .and_then(|marker| marker.get("device_id_fingerprint").and_then(|v| v.as_str()).map(|s| s.to_string()));

    // Ensure identity
    match node_auth::ensure_node_identity(&home_path, node_id, device_fingerprint.as_deref()) {
        Ok(identity) => {
            // Store identity in state
            if let Ok(mut guard) = state.node_identity.lock() {
                *guard = Some(identity.clone());
            }

            EngineResponse::ok(serde_json::json!({
                "ok": true,
                "node_id": identity.node_id.to_string(),
                "public_key_b64": identity.public_key_b64,
                "private_key_vault_ref": identity.private_key_vault_ref,
                "created_at": identity.created_at_iso_utc
            }))
        }
        Err(e) => EngineResponse::err("NODE_IDENTITY_ERROR", &e.to_string()),
    }
}

/// Bootstrap node session (register, challenge, sign, create session)
///
/// Requires authentication (JWT) for registration.
fn handle_bootstrap_node_session(payload: &Value, state: &EngineState) -> EngineResponse {
    // Get home_path
    let home_path = match state.home_path.lock() {
        Ok(guard) => match guard.as_ref() {
            Some(p) => p.clone(),
            None => return EngineResponse::err("NOT_CONNECTED", "Home path not initialized"),
        },
        Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
    };

    // Get node_id
    let node_id = match state.node_id.lock() {
        Ok(guard) => match guard.as_ref() {
            Some(id) => *id,
            None => return EngineResponse::err("NOT_CONNECTED", "Node ID not initialized"),
        },
        Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
    };

    // Get JWT, workspace_id, and user_sub from auth context
    let (jwt, default_workspace_id, user_sub) = match state.auth.lock() {
        Ok(guard) => match guard.as_ref() {
            Some(auth) => {
                // Workspace ID defaults to tenant_id if not provided
                let ws_id = auth.workspace_id.clone().unwrap_or_else(|| auth.tenant_id.clone());
                (auth.jwt.clone(), ws_id, Some(auth.sub.clone()))
            }
            None => return EngineResponse::err("NOT_AUTHENTICATED", "Must login before bootstrapping node session"),
        },
        Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
    };

    // Get engine URL
    let engine_url = match std::env::var("EKKA_ENGINE_URL") {
        Ok(url) => url,
        Err(_) => return EngineResponse::err("CONFIG_ERROR", "EKKA_ENGINE_URL not set"),
    };

    // Get device fingerprint from marker
    let marker_path = home_path.join(".ekka-marker.json");
    let device_fingerprint = std::fs::read_to_string(&marker_path)
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .and_then(|marker| marker.get("device_id_fingerprint").and_then(|v| v.as_str()).map(|s| s.to_string()));

    // Bootstrap node session
    match node_auth::bootstrap_node_session(
        &home_path,
        node_id,
        &engine_url,
        &jwt,
        &default_workspace_id,
        device_fingerprint.as_deref(),
    ) {
        Ok(result) => {
            // Store identity in state
            if let Ok(mut guard) = state.node_identity.lock() {
                *guard = Some(result.identity.clone());
            }

            // Store session in state
            if let Some(session) = &result.session {
                state.node_session.set(session.clone());
            }

            // Check if we should start the runner
            let start_runner = payload.get("startRunner").and_then(|v| v.as_bool()).unwrap_or(false);

            if start_runner {
                if let Some(session) = &result.session {
                    // Build runner config from session
                    match node_auth::NodeSessionRunnerConfig::from_session(session, node_id) {
                        Ok(runner_config) => {
                            let runner_state = state.runner_state.clone();
                            let session_holder = state.node_session.clone();
                            let home_path_clone = home_path.clone();
                            let device_fp = device_fingerprint.clone();
                            let user_sub_clone = user_sub.clone();

                            // Spawn runner in background
                            tauri::async_runtime::spawn(async move {
                                let _ = crate::node_runner::start_node_runner(
                                    runner_state,
                                    session_holder,
                                    runner_config,
                                    home_path_clone,
                                    device_fp,
                                    user_sub_clone,
                                ).await;
                            });
                        }
                        Err(e) => {
                            tracing::warn!(op = "node_session.runner_start_failed", error = %e, "Failed to start runner");
                        }
                    }
                }
            }

            let session_info = result.session.as_ref().map(|s| serde_json::json!({
                "session_id": s.session_id.to_string(),
                "tenant_id": s.tenant_id.to_string(),
                "workspace_id": s.workspace_id.to_string(),
                "expires_at": s.expires_at.to_rfc3339()
            }));

            EngineResponse::ok(serde_json::json!({
                "ok": true,
                "node_id": result.identity.node_id.to_string(),
                "public_key_b64": result.identity.public_key_b64,
                "registered": result.registered,
                "session": session_info
            }))
        }
        Err(e) => EngineResponse::err("NODE_SESSION_ERROR", &e.to_string()),
    }
}

/// Get current node session status
fn handle_node_session_status(state: &EngineState) -> EngineResponse {
    let identity = state.node_identity.lock().ok().and_then(|g| g.clone());
    let session = state.node_session.get();

    EngineResponse::ok(serde_json::json!({
        "hasIdentity": identity.is_some(),
        "hasSession": session.is_some(),
        "sessionValid": state.node_session.get_valid().is_some(),
        "identity": identity.map(|i| serde_json::json!({
            "node_id": i.node_id.to_string(),
            "public_key_b64": i.public_key_b64,
            "created_at": i.created_at_iso_utc
        })),
        "session": session.map(|s| serde_json::json!({
            "session_id": s.session_id.to_string(),
            "tenant_id": s.tenant_id.to_string(),
            "workspace_id": s.workspace_id.to_string(),
            "expires_at": s.expires_at.to_rfc3339(),
            "is_expired": s.is_expired()
        }))
    }))
}
