//! Vault operation handlers
//!
//! Thin wrappers that call SDK vault operations.
//! Each handler is 5-15 lines max per architecture rules.

use crate::state::EngineState;
use crate::types::EngineResponse;
use ekka_sdk_core::ekka_ops::vault;
use serde_json::{json, Value};

// =============================================================================
// Status Handlers
// =============================================================================

/// Handle vault.status
pub fn handle_status(state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    match vault::status(&ctx) {
        Ok(status) => EngineResponse::ok(json!(status)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.capabilities
pub fn handle_capabilities(state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    match vault::capabilities(&ctx) {
        Ok(caps) => EngineResponse::ok(json!(caps)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

// =============================================================================
// Secrets Handlers
// =============================================================================

/// Handle vault.secrets.list
pub fn handle_secrets_list(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let opts: Option<vault::SecretListOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::secrets::list(&ctx, state.vault_cache(), opts) {
        Ok(secrets) => EngineResponse::ok(json!({ "secrets": secrets })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.secrets.get
pub fn handle_secrets_get(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let id = match payload.get("id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'id'"),
    };

    match vault::secrets::get(&ctx, state.vault_cache(), id) {
        Ok(secret) => EngineResponse::ok(json!(secret)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.secrets.create
pub fn handle_secrets_create(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let input: vault::SecretCreateInput = match serde_json::from_value(payload.clone()) {
        Ok(i) => i,
        Err(e) => return EngineResponse::err("INVALID_PAYLOAD", &e.to_string()),
    };

    match vault::secrets::create(&ctx, state.vault_cache(), input) {
        Ok(secret) => EngineResponse::ok(json!(secret)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.secrets.update
pub fn handle_secrets_update(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let id = match payload.get("id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'id'"),
    };

    let input: vault::SecretUpdateInput = match payload.get("input")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
    {
        Some(i) => i,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing or invalid 'input'"),
    };

    match vault::secrets::update(&ctx, state.vault_cache(), id, input) {
        Ok(secret) => EngineResponse::ok(json!(secret)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.secrets.delete
pub fn handle_secrets_delete(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let id = match payload.get("id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'id'"),
    };

    match vault::secrets::delete(&ctx, state.vault_cache(), id) {
        Ok(deleted) => EngineResponse::ok(json!({ "deleted": deleted })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.secrets.upsert
pub fn handle_secrets_upsert(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let input: vault::SecretCreateInput = match serde_json::from_value(payload.clone()) {
        Ok(i) => i,
        Err(e) => return EngineResponse::err("INVALID_PAYLOAD", &e.to_string()),
    };

    match vault::secrets::upsert(&ctx, state.vault_cache(), input) {
        Ok(secret) => EngineResponse::ok(json!(secret)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

// =============================================================================
// Bundles Handlers
// =============================================================================

/// Handle vault.bundles.list
pub fn handle_bundles_list(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let opts: Option<vault::BundleListOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::bundles::list(&ctx, state.vault_cache(), opts) {
        Ok(bundles) => EngineResponse::ok(json!({ "bundles": bundles })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.bundles.get
pub fn handle_bundles_get(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let id = match payload.get("id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'id'"),
    };

    match vault::bundles::get(&ctx, state.vault_cache(), id) {
        Ok(bundle) => EngineResponse::ok(json!(bundle)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.bundles.create
pub fn handle_bundles_create(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let input: vault::BundleCreateInput = match serde_json::from_value(payload.clone()) {
        Ok(i) => i,
        Err(e) => return EngineResponse::err("INVALID_PAYLOAD", &e.to_string()),
    };

    match vault::bundles::create(&ctx, state.vault_cache(), input) {
        Ok(bundle) => EngineResponse::ok(json!(bundle)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.bundles.rename
pub fn handle_bundles_rename(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let id = match payload.get("id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'id'"),
    };

    let name = match payload.get("name").and_then(|v| v.as_str()) {
        Some(n) => n,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'name'"),
    };

    match vault::bundles::rename(&ctx, state.vault_cache(), id, name) {
        Ok(bundle) => EngineResponse::ok(json!(bundle)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.bundles.delete
pub fn handle_bundles_delete(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let id = match payload.get("id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'id'"),
    };

    match vault::bundles::delete(&ctx, state.vault_cache(), id) {
        Ok(deleted) => EngineResponse::ok(json!({ "deleted": deleted })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.bundles.listSecrets
pub fn handle_bundles_list_secrets(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let bundle_id = match payload.get("bundleId").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'bundleId'"),
    };

    let opts: Option<vault::SecretListOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::bundles::list_secrets(&ctx, state.vault_cache(), bundle_id, opts) {
        Ok(secrets) => EngineResponse::ok(json!({ "secrets": secrets })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.bundles.addSecret
pub fn handle_bundles_add_secret(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let bundle_id = match payload.get("bundleId").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'bundleId'"),
    };

    let secret_id = match payload.get("secretId").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'secretId'"),
    };

    match vault::bundles::add_secret(&ctx, state.vault_cache(), bundle_id, secret_id) {
        Ok(bundle) => EngineResponse::ok(json!(bundle)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.bundles.removeSecret
pub fn handle_bundles_remove_secret(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let bundle_id = match payload.get("bundleId").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'bundleId'"),
    };

    let secret_id = match payload.get("secretId").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'secretId'"),
    };

    match vault::bundles::remove_secret(&ctx, state.vault_cache(), bundle_id, secret_id) {
        Ok(bundle) => EngineResponse::ok(json!(bundle)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

// =============================================================================
// Files Handlers
// =============================================================================

/// Handle vault.files.writeText
pub fn handle_files_write_text(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    let content = match payload.get("content").and_then(|v| v.as_str()) {
        Some(c) => c,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'content'"),
    };

    let opts: Option<vault::FileOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::files::write_text(&ctx, state.vault_cache(), path, content, opts) {
        Ok(()) => EngineResponse::ok(json!({ "written": true })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.files.writeBytes
pub fn handle_files_write_bytes(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    // contentBytes is expected as base64 encoded string
    let content_b64 = match payload.get("contentBytes").and_then(|v| v.as_str()) {
        Some(c) => c,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'contentBytes'"),
    };

    let content = match base64_decode(content_b64) {
        Ok(c) => c,
        Err(e) => return EngineResponse::err("INVALID_PAYLOAD", &format!("Invalid base64: {}", e)),
    };

    let opts: Option<vault::FileOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::files::write_bytes(&ctx, state.vault_cache(), path, &content, opts) {
        Ok(()) => EngineResponse::ok(json!({ "written": true })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.files.readText
pub fn handle_files_read_text(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    let opts: Option<vault::FileOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::files::read_text(&ctx, state.vault_cache(), path, opts) {
        Ok(content) => EngineResponse::ok(json!({ "content": content })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.files.readBytes
pub fn handle_files_read_bytes(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    let opts: Option<vault::FileOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::files::read_bytes(&ctx, state.vault_cache(), path, opts) {
        Ok(content) => {
            let content_b64 = base64_encode(&content);
            EngineResponse::ok(json!({ "contentBytes": content_b64 }))
        }
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.files.list
pub fn handle_files_list(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let dir_path = payload.get("dir").and_then(|v| v.as_str()).unwrap_or("");

    let opts: Option<vault::FileListOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::files::list(&ctx, state.vault_cache(), dir_path, opts) {
        Ok(entries) => EngineResponse::ok(json!({ "entries": entries })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.files.exists
pub fn handle_files_exists(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    let opts: Option<vault::FileOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::files::exists(&ctx, state.vault_cache(), path, opts) {
        Ok(exists) => EngineResponse::ok(json!({ "exists": exists })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.files.delete
pub fn handle_files_delete(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    let opts: Option<vault::FileDeleteOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::files::delete(&ctx, state.vault_cache(), path, opts) {
        Ok(deleted) => EngineResponse::ok(json!({ "deleted": deleted })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.files.mkdir
pub fn handle_files_mkdir(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let path = match payload.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'path'"),
    };

    let opts: Option<vault::FileOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::files::mkdir(&ctx, state.vault_cache(), path, opts) {
        Ok(()) => EngineResponse::ok(json!({ "created": true })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.files.move
pub fn handle_files_move(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let from = match payload.get("from").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'from'"),
    };

    let to = match payload.get("to").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'to'"),
    };

    let opts: Option<vault::FileOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::files::move_file(&ctx, state.vault_cache(), from, to, opts) {
        Ok(()) => EngineResponse::ok(json!({ "moved": true })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

// =============================================================================
// Injection Handlers (DEFERRED - return NOT_IMPLEMENTED)
// =============================================================================

/// Handle vault.attachSecretsToConnector (DEFERRED)
pub fn handle_attach_secrets_to_connector(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let connector_id = match payload.get("connectorId").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'connectorId'"),
    };

    let mappings: Vec<vault::SecretRef> = match payload.get("mappings")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
    {
        Some(m) => m,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing or invalid 'mappings'"),
    };

    match vault::attach_secrets_to_connector(&ctx, connector_id, mappings) {
        Ok(()) => EngineResponse::ok(json!({ "attached": true })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

/// Handle vault.injectSecretsIntoRun (DEFERRED)
/// Note: This returns success/failure only, NOT the injected values
pub fn handle_inject_secrets_into_run(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let run_id = match payload.get("runId").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing 'runId'"),
    };

    let mappings: Vec<vault::SecretRef> = match payload.get("mappings")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
    {
        Some(m) => m,
        None => return EngineResponse::err("INVALID_PAYLOAD", "Missing or invalid 'mappings'"),
    };

    match vault::inject_secrets_into_run(&ctx, run_id, mappings) {
        Ok(_env_map) => EngineResponse::ok(json!({ "injected": true })),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

// =============================================================================
// Audit Handler
// =============================================================================

/// Handle vault.audit.list
pub fn handle_audit_list(payload: &Value, state: &EngineState) -> EngineResponse {
    let ctx = match state.to_runtime_context() {
        Some(c) => c,
        None => return EngineResponse::err("NOT_CONNECTED", "Engine not initialized"),
    };

    let opts: Option<vault::AuditListOptions> = payload
        .get("opts")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    match vault::audit::list(&ctx, state.vault_cache(), opts) {
        Ok(result) => EngineResponse::ok(json!(result)),
        Err(e) => EngineResponse::err(e.code, &e.message),
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Simple base64 encoding
fn base64_encode(data: &[u8]) -> String {
    let mut encoded = String::new();
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    for chunk in data.chunks(3) {
        let mut n: u32 = 0;
        for (i, &byte) in chunk.iter().enumerate() {
            n |= (byte as u32) << (16 - i * 8);
        }

        let padding = 3 - chunk.len();
        for i in 0..4 - padding {
            let idx = ((n >> (18 - i * 6)) & 0x3f) as usize;
            encoded.push(ALPHABET[idx] as char);
        }
        for _ in 0..padding {
            encoded.push('=');
        }
    }
    encoded
}

/// Simple base64 decoding
fn base64_decode(encoded: &str) -> Result<Vec<u8>, &'static str> {
    fn decode_char(c: u8) -> Result<u8, &'static str> {
        match c {
            b'A'..=b'Z' => Ok(c - b'A'),
            b'a'..=b'z' => Ok(c - b'a' + 26),
            b'0'..=b'9' => Ok(c - b'0' + 52),
            b'+' => Ok(62),
            b'/' => Ok(63),
            _ => Err("invalid base64 character"),
        }
    }

    let input = encoded.trim_end_matches('=');

    let mut output = Vec::new();
    let mut buffer: u32 = 0;
    let mut bits: u32 = 0;

    for &byte in input.as_bytes() {
        buffer = (buffer << 6) | decode_char(byte)? as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
        }
    }

    Ok(output)
}
