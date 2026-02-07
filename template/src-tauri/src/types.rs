//! Contract types for TypeScript ↔ Rust communication
//!
//! These types define the RPC protocol between the frontend and EKKA Bridge.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Incoming request from TypeScript
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineRequest {
    pub op: String,
    #[allow(dead_code)]
    pub v: u32,
    pub payload: Value,
    #[allow(dead_code)]
    pub correlation_id: String,
}

/// Response sent back to TypeScript
#[derive(Debug, Serialize, Deserialize)]
pub struct EngineResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<EngineError>,
}

/// Error details in response
#[derive(Debug, Serialize, Deserialize)]
pub struct EngineError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
}

impl EngineResponse {
    /// Success response with result value
    pub fn ok(result: Value) -> Self {
        Self {
            ok: true,
            result: Some(result),
            error: None,
        }
    }

    /// Error response
    pub fn err(code: &str, message: &str) -> Self {
        Self {
            ok: false,
            result: None,
            error: Some(EngineError {
                code: code.to_string(),
                message: message.to_string(),
                status: None,
            }),
        }
    }

}
