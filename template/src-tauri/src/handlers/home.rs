//! Home operation handlers
//!
//! Thin wrappers that call SDK operations.

use crate::state::{EngineHttpGrantIssuer, EngineState};
use crate::types::EngineResponse;
use ekka_sdk_core::ekka_ops::home;
use serde_json::json;

// handle_status removed — now handled by Desktop Core (BS#19)

/// Handle home.grant operation
pub fn handle_grant(state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    // Check auth
    if ctx.auth.is_none() {
        return EngineResponse::err("NOT_AUTHENTICATED", "Must call auth.set before home.grant");
    }

    let issuer = EngineHttpGrantIssuer::new();

    match home::grant(&ctx, &issuer) {
        Ok(result) => EngineResponse::ok(json!({
            "success": result.success,
            "grant_id": result.grant_id,
            "expires_at": result.expires_at,
        })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}
