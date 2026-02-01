//! Path operation handlers
//!
//! Thin wrappers that call SDK operations.

use crate::state::{EngineHttpGrantIssuer, EngineState};
use crate::types::EngineResponse;
use ekka_sdk_core::ekka_ops::{paths, PathAccess, PathType};
use serde_json::{json, Value};
use std::path::Path;

/// Handle paths.check operation
pub fn handle_check(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    let operation = payload
        .get("operation")
        .and_then(|v| v.as_str())
        .unwrap_or("read");

    let result = paths::check_detailed(&ctx, Path::new(path), operation);

    EngineResponse::ok(json!({
        "allowed": result.allowed,
        "reason": result.reason,
        "pathType": result.path_type,
        "access": result.access,
    }))
}

/// Handle paths.list operation
pub fn handle_list(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path_type: Option<PathType> = payload
        .get("pathType")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str(&format!("\"{}\"", s)).ok());

    match paths::list(&ctx, path_type) {
        Ok(paths_list) => EngineResponse::ok(json!({ "paths": paths_list })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle paths.get operation
pub fn handle_get(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    match paths::get(&ctx, Path::new(path)) {
        Ok(Some(info)) => EngineResponse::ok(json!(info)),
        Ok(None) => EngineResponse::ok(Value::Null),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle paths.request operation
pub fn handle_request(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    // Check auth
    if ctx.auth.is_none() {
        return EngineResponse::err("NOT_AUTHENTICATED", "Must login before requesting path access");
    }

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    let path_type: PathType = payload
        .get("pathType")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str(&format!("\"{}\"", s)).ok())
        .unwrap_or(PathType::General);

    let access: PathAccess = payload
        .get("access")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str(&format!("\"{}\"", s)).ok())
        .unwrap_or(PathAccess::ReadOnly);

    let issuer = EngineHttpGrantIssuer::new();

    match paths::request(&ctx, &issuer, Path::new(path), path_type, access) {
        Ok(result) => EngineResponse::ok(json!(result)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle paths.remove operation
pub fn handle_remove(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    match paths::remove(&ctx, Path::new(path)) {
        Ok(removed) => EngineResponse::ok(json!({ "removed": removed })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}
