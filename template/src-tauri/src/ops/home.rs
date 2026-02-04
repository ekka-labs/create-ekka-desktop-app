//! Home operations (DEPRECATED - use handlers/home.rs)
//!
//! Handles: home.status, home.grant
//!
//! This module is deprecated in favor of SDK-based handlers.

#![allow(dead_code)]

use crate::bootstrap::resolve_home_path;
use crate::grants::get_home_status;
use crate::state::EngineState;
use crate::types::EngineResponse;
use serde_json::{json, Value};

/// Handle home.status operation
pub fn handle_status(state: &EngineState) -> EngineResponse {
    let (home_state, home_path, grant_present, reason) = get_home_status(state);

    EngineResponse::ok(json!({
        "state": home_state,
        "homePath": home_path.to_string_lossy(),
        "grantPresent": grant_present,
        "reason": reason,
    }))
}

/// Handle home.grant operation
pub fn handle_grant(state: &EngineState) -> EngineResponse {
    // 1. Must have auth with JWT
    let auth = match state.auth.lock() {
        Ok(guard) => guard.clone(),
        Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
    };

    let auth = match auth {
        Some(a) => a,
        None => {
            return EngineResponse::err("NOT_AUTHENTICATED", "Must call auth.set before home.grant")
        }
    };

    // 2. Get home path
    let home_path = match state.home_path.lock() {
        Ok(guard) => guard.clone(),
        Err(e) => return EngineResponse::err("INTERNAL_ERROR", &e.to_string()),
    };

    let home_path = match home_path {
        Some(p) => p,
        None => match resolve_home_path() {
            Ok(p) => p,
            Err(e) => return EngineResponse::err("HOME_PATH_ERROR", &e),
        },
    };

    // 3. Load marker to get instance_id (used as node_id in grants)
    let marker_path = home_path.join(".ekka-marker.json");
    let marker_content = match std::fs::read_to_string(&marker_path) {
        Ok(c) => c,
        Err(e) => {
            return EngineResponse::err(
                "MARKER_READ_ERROR",
                &format!("Failed to read marker: {}", e),
            )
        }
    };

    let marker: Value = match serde_json::from_str(&marker_content) {
        Ok(m) => m,
        Err(e) => {
            return EngineResponse::err(
                "MARKER_PARSE_ERROR",
                &format!("Failed to parse marker: {}", e),
            )
        }
    };

    let node_id = match marker.get("instance_id").and_then(|v| v.as_str()) {
        Some(n) => n.to_string(),
        None => return EngineResponse::err("MARKER_INVALID", "Marker missing instance_id"),
    };

    // 4. Get engine URL (baked at build time)
    let engine_url = match option_env!("EKKA_ENGINE_URL") {
        Some(u) => u,
        None => {
            return EngineResponse::err(
                "ENGINE_NOT_CONFIGURED",
                "EKKA_ENGINE_URL not baked at build time. Rebuild with EKKA_ENGINE_URL set.",
            )
        }
    };

    // 5. Build grant request
    let grant_request = json!({
        "resource": {
            "kind": "path",
            "path_prefix": home_path.to_string_lossy(),
            "attrs": {
                "path_type": "HOME"
            }
        },
        "permissions": {
            "ops": ["read", "write", "delete"],
            "access": "READ_WRITE"
        },
        "purpose": "home_bootstrap",
        "expires_in_seconds": 31536000,
        "node_id": node_id,
        "consent": {
            "mode": "user_click"
        }
    });

    // 6. Make HTTP request to engine
    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
    {
        Ok(c) => c,
        Err(e) => return EngineResponse::err("HTTP_CLIENT_ERROR", &e.to_string()),
    };

    let request_id = uuid::Uuid::new_v4().to_string();
    let response = match client
        .post(format!("{}/engine/grants/issue", engine_url))
        .header("Authorization", format!("Bearer {}", auth.jwt))
        .header("Content-Type", "application/json")
        .header("X-EKKA-PROOF-TYPE", "jwt")
        .header("X-REQUEST-ID", &request_id)
        .header("X-EKKA-CORRELATION-ID", &request_id)
        .header("X-EKKA-MODULE", "desktop.home")
        .header("X-EKKA-ACTION", "grant")
        .header("X-EKKA-CLIENT", "desktop")
        .header("X-EKKA-CLIENT-VERSION", "0.2.0")
        .json(&grant_request)
        .send()
    {
        Ok(r) => r,
        Err(e) => {
            return EngineResponse::err(
                "ENGINE_REQUEST_FAILED",
                &format!("HTTP request failed: {}", e),
            )
        }
    };

    // 7. Check response status
    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().unwrap_or_else(|_| "No error body".to_string());
        return EngineResponse::err(
            "ENGINE_GRANT_DENIED",
            &format!("Engine returned {}: {}", status, error_body),
        );
    }

    // 8. Parse response
    let grant_response: Value = match response.json() {
        Ok(v) => v,
        Err(e) => {
            return EngineResponse::err(
                "RESPONSE_PARSE_ERROR",
                &format!("Failed to parse response: {}", e),
            )
        }
    };

    // 9. Extract signed grant
    let signed_grant = match grant_response.get("signed_grant") {
        Some(sg) => sg.clone(),
        None => return EngineResponse::err("INVALID_RESPONSE", "Response missing signed_grant"),
    };

    let grant_id = signed_grant
        .get("grant")
        .and_then(|g| g.get("grant_id"))
        .and_then(|id| id.as_str())
        .unwrap_or("unknown")
        .to_string();

    let expires_at = grant_response
        .get("expires_at")
        .and_then(|e| e.as_str())
        .map(|s| s.to_string());

    // 10. Load or create grants.json
    let grants_path = home_path.join("grants.json");
    let mut grants_file: Value = if grants_path.exists() {
        match std::fs::read_to_string(&grants_path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or(json!({
                "schema_version": "1.0",
                "grants": []
            })),
            Err(_) => json!({
                "schema_version": "1.0",
                "grants": []
            }),
        }
    } else {
        json!({
            "schema_version": "1.0",
            "grants": []
        })
    };

    // 11. Add grant to grants array
    let path_grant = json!({
        "schema": signed_grant.get("schema"),
        "canon_alg": signed_grant.get("canon_alg"),
        "signing_alg": signed_grant.get("signing_alg"),
        "grant": signed_grant.get("grant"),
        "grant_canonical_b64": signed_grant.get("grant_canonical_b64"),
        "signature_b64": signed_grant.get("signature_b64"),
        "path_type": "HOME",
        "path_access": "READ_WRITE"
    });

    if let Some(grants_array) = grants_file.get_mut("grants").and_then(|g| g.as_array_mut()) {
        grants_array.push(path_grant);
    }

    // 12. Write grants.json atomically
    let grants_json = match serde_json::to_string_pretty(&grants_file) {
        Ok(j) => j,
        Err(e) => {
            return EngineResponse::err(
                "SERIALIZE_ERROR",
                &format!("Failed to serialize grants: {}", e),
            )
        }
    };

    let temp_path = grants_path.with_extension("json.tmp");
    if let Err(e) = std::fs::write(&temp_path, &grants_json) {
        return EngineResponse::err("WRITE_ERROR", &format!("Failed to write grants: {}", e));
    }
    if let Err(e) = std::fs::rename(&temp_path, &grants_path) {
        return EngineResponse::err(
            "RENAME_ERROR",
            &format!("Failed to rename grants file: {}", e),
        );
    }

    // 13. Return success
    EngineResponse::ok(json!({
        "success": true,
        "grant_id": grant_id,
        "expires_at": expires_at,
    }))
}
