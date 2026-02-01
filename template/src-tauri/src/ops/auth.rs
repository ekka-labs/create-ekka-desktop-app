//! Auth operations
//!
//! Handles: auth.set

use crate::state::{AuthContext, EngineState};
use crate::types::EngineResponse;
use serde_json::{json, Value};

/// Handle auth.set operation
pub fn handle_set(payload: &Value, state: &EngineState) -> EngineResponse {
    let tenant_id = match payload.get("tenantId").and_then(|v| v.as_str()) {
        Some(t) if !t.is_empty() => t.to_string(),
        _ => return EngineResponse::err("INVALID_PAYLOAD", "Missing or empty 'tenantId'"),
    };

    let sub = match payload.get("sub").and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => return EngineResponse::err("INVALID_PAYLOAD", "Missing or empty 'sub'"),
    };

    let jwt = match payload.get("jwt").and_then(|v| v.as_str()) {
        Some(j) if !j.is_empty() => j.to_string(),
        _ => return EngineResponse::err("INVALID_PAYLOAD", "Missing or empty 'jwt'"),
    };

    // Workspace ID is optional - defaults to tenant_id if not provided
    let workspace_id = payload
        .get("workspaceId")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let auth_context = AuthContext {
        tenant_id,
        sub,
        jwt,
        workspace_id,
    };

    // Clear vault cache when auth changes (new tenant/user means new encryption key)
    state.clear_vault_cache();

    match state.auth.lock() {
        Ok(mut guard) => {
            *guard = Some(auth_context);
            EngineResponse::ok(json!({ "ok": true }))
        }
        Err(e) => EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
    }
}
