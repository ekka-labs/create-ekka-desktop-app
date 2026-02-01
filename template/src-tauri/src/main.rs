//! EKKA Desktop - CDA Stub Entry Point
//!
//! Standalone demo implementation for CDA-generated apps.
//! Returns demo responses for all operations (no SDK dependencies).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::State;

// =============================================================================
// Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineRequest {
    pub op: String,
    #[serde(default)]
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub code: String,
    pub message: String,
}

impl EngineResponse {
    pub fn ok(data: Value) -> Self {
        Self { ok: true, data: Some(data), error: None }
    }

    pub fn err(code: &str, message: &str) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(ErrorInfo {
                code: code.to_string(),
                message: message.to_string(),
            }),
        }
    }
}

// =============================================================================
// State
// =============================================================================

#[derive(Default)]
pub struct EngineState {
    connected: Mutex<bool>,
    auth: Mutex<Option<AuthContext>>,
    home_granted: Mutex<bool>,
}

#[derive(Debug, Clone)]
struct AuthContext {
    tenant_id: String,
    sub: String,
    #[allow(dead_code)]
    jwt: String,
}

// =============================================================================
// Commands
// =============================================================================

#[tauri::command]
fn engine_connect(state: State<EngineState>) -> Result<(), String> {
    let mut connected = state.connected.lock().map_err(|e| e.to_string())?;
    *connected = true;
    Ok(())
}

#[tauri::command]
fn engine_disconnect(state: State<EngineState>) {
    if let Ok(mut connected) = state.connected.lock() {
        *connected = false;
    }
    if let Ok(mut auth) = state.auth.lock() {
        *auth = None;
    }
    if let Ok(mut home) = state.home_granted.lock() {
        *home = false;
    }
}

#[tauri::command]
fn engine_request(req: EngineRequest, state: State<EngineState>) -> EngineResponse {
    // Check connected (except for status operations)
    if !matches!(req.op.as_str(), "runtime.info" | "home.status") {
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

    // Dispatch
    match req.op.as_str() {
        // Runtime
        "runtime.info" => {
            let home_state = get_home_state(&state);
            EngineResponse::ok(json!({
                "runtime": "cda-stub",
                "engine_present": false,
                "mode": "demo",
                "homeState": home_state,
                "homePath": "/demo/home"
            }))
        }

        // Auth
        "auth.set" => {
            let tenant_id = req.payload.get("tenantId").and_then(|v| v.as_str());
            let sub = req.payload.get("sub").and_then(|v| v.as_str());
            let jwt = req.payload.get("jwt").and_then(|v| v.as_str());

            match (tenant_id, sub, jwt) {
                (Some(t), Some(s), Some(j)) => {
                    if let Ok(mut auth) = state.auth.lock() {
                        *auth = Some(AuthContext {
                            tenant_id: t.to_string(),
                            sub: s.to_string(),
                            jwt: j.to_string(),
                        });
                    }
                    EngineResponse::ok(json!({ "ok": true }))
                }
                _ => EngineResponse::err("INVALID_PAYLOAD", "Missing tenantId, sub, or jwt"),
            }
        }

        // Home
        "home.status" => {
            let home_state = get_home_state(&state);
            let home_granted = state.home_granted.lock().map(|g| *g).unwrap_or(false);
            EngineResponse::ok(json!({
                "state": home_state,
                "homePath": "/demo/home",
                "grantPresent": home_granted,
                "reason": if home_granted { Value::Null } else { json!("Demo mode - call home.grant to simulate") }
            }))
        }

        "home.grant" => {
            let has_auth = state.auth.lock().map(|g| g.is_some()).unwrap_or(false);
            if !has_auth {
                return EngineResponse::err("NOT_AUTHENTICATED", "Must call auth.set before home.grant");
            }

            if let Ok(mut home) = state.home_granted.lock() {
                *home = true;
            }

            let now = chrono::Utc::now();
            let expires = now + chrono::Duration::days(365);

            EngineResponse::ok(json!({
                "success": true,
                "grant_id": format!("demo-grant-{}", now.timestamp_millis()),
                "expires_at": expires.to_rfc3339()
            }))
        }

        // Node Session (stub - return demo status)
        "nodeSession.ensureIdentity" => {
            let node_id = uuid::Uuid::new_v4();
            EngineResponse::ok(json!({
                "ok": true,
                "node_id": node_id.to_string(),
                "public_key_b64": "DEMO_PUBLIC_KEY",
                "private_key_vault_ref": "vault://node/identity.key",
                "created_at": chrono::Utc::now().to_rfc3339()
            }))
        }

        "nodeSession.bootstrap" => {
            EngineResponse::ok(json!({
                "ok": true,
                "node_id": uuid::Uuid::new_v4().to_string(),
                "public_key_b64": "DEMO_PUBLIC_KEY",
                "registered": true,
                "session": {
                    "session_id": uuid::Uuid::new_v4().to_string(),
                    "tenant_id": "demo-tenant",
                    "workspace_id": "demo-workspace",
                    "expires_at": (chrono::Utc::now() + chrono::Duration::hours(24)).to_rfc3339()
                }
            }))
        }

        "nodeSession.status" => {
            EngineResponse::ok(json!({
                "hasIdentity": false,
                "hasSession": false,
                "sessionValid": false,
                "identity": Value::Null,
                "session": Value::Null
            }))
        }

        // Runner (stub)
        "runner.status" => {
            EngineResponse::ok(json!({
                "state": "stopped",
                "active_task_id": Value::Null,
                "last_error": Value::Null
            }))
        }

        // Paths (stub - return empty/demo)
        "paths.check" => EngineResponse::ok(json!({ "allowed": false, "reason": "Demo mode" })),
        "paths.list" => EngineResponse::ok(json!({ "grants": [] })),
        "paths.get" => EngineResponse::err("NOT_FOUND", "No grants in demo mode"),
        "paths.request" => EngineResponse::err("NOT_IMPLEMENTED", "Path grants not available in demo mode"),
        "paths.remove" => EngineResponse::err("NOT_IMPLEMENTED", "Path grants not available in demo mode"),

        // Vault (stub - return demo status)
        "vault.status" => EngineResponse::ok(json!({ "available": false, "reason": "Demo mode" })),
        "vault.capabilities" => EngineResponse::ok(json!({ "secrets": false, "bundles": false, "files": false })),

        // Vault secrets (stub)
        "vault.secrets.list" => EngineResponse::ok(json!({ "secrets": [] })),
        "vault.secrets.get" => EngineResponse::err("NOT_FOUND", "No secrets in demo mode"),
        "vault.secrets.create" | "vault.secrets.update" | "vault.secrets.delete" | "vault.secrets.upsert" => {
            EngineResponse::err("NOT_IMPLEMENTED", "Vault not available in demo mode")
        }

        // Vault bundles (stub)
        "vault.bundles.list" => EngineResponse::ok(json!({ "bundles": [] })),
        "vault.bundles.get" => EngineResponse::err("NOT_FOUND", "No bundles in demo mode"),
        "vault.bundles.create" | "vault.bundles.rename" | "vault.bundles.delete" => {
            EngineResponse::err("NOT_IMPLEMENTED", "Vault not available in demo mode")
        }
        "vault.bundles.listSecrets" => EngineResponse::ok(json!({ "secrets": [] })),
        "vault.bundles.addSecret" | "vault.bundles.removeSecret" => {
            EngineResponse::err("NOT_IMPLEMENTED", "Vault not available in demo mode")
        }

        // Vault files (stub)
        "vault.files.list" => EngineResponse::ok(json!({ "entries": [] })),
        "vault.files.exists" => EngineResponse::ok(json!({ "exists": false })),
        "vault.files.writeText" | "vault.files.writeBytes" | "vault.files.readText" | "vault.files.readBytes" |
        "vault.files.delete" | "vault.files.mkdir" | "vault.files.move" => {
            EngineResponse::err("NOT_IMPLEMENTED", "Vault files not available in demo mode")
        }

        // Vault audit (stub)
        "vault.audit.list" => EngineResponse::ok(json!({ "events": [], "total": 0 })),

        // Vault injection (stub)
        "vault.attachSecretsToConnector" | "vault.injectSecretsIntoRun" => {
            EngineResponse::err("NOT_IMPLEMENTED", "Vault injection not available in demo mode")
        }

        // Debug
        "debug.isDevMode" => EngineResponse::ok(json!({ "isDevMode": true })),
        "debug.openFolder" => EngineResponse::err("NOT_IMPLEMENTED", "Not available in demo mode"),
        "debug.resolveVaultPath" => EngineResponse::err("NOT_IMPLEMENTED", "Not available in demo mode"),

        // DB/Queue/Pipeline (not implemented)
        "db.get" | "db.put" | "db.delete" |
        "queue.enqueue" | "queue.claim" | "queue.ack" | "queue.nack" | "queue.heartbeat" |
        "pipeline.submit" | "pipeline.events" => {
            EngineResponse::err("NOT_IMPLEMENTED", &format!("{} not available in demo mode", req.op))
        }

        // Unknown
        _ => EngineResponse::err("INVALID_OP", &format!("Unknown operation: {}", req.op)),
    }
}

fn get_home_state(state: &EngineState) -> &'static str {
    let home_granted = state.home_granted.lock().map(|g| *g).unwrap_or(false);
    let has_auth = state.auth.lock().map(|g| g.is_some()).unwrap_or(false);

    if home_granted {
        "HOME_GRANTED"
    } else if has_auth {
        "AUTHENTICATED_NO_HOME_GRANT"
    } else {
        "BOOTSTRAP_PRE_LOGIN"
    }
}

// =============================================================================
// Main
// =============================================================================

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(EngineState::default())
        .invoke_handler(tauri::generate_handler![
            engine_connect,
            engine_disconnect,
            engine_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
