//! Runtime operations
//!
//! Handles: runtime.info

use crate::grants::get_home_status;
use crate::state::EngineState;
use crate::types::EngineResponse;
use serde_json::json;

/// Handle runtime.info operation
pub fn handle_info(state: &EngineState) -> EngineResponse {
    let (home_state, home_path, _, _) = get_home_status(state);

    EngineResponse::ok(json!({
        "runtime": "tauri",
        "engine_present": true,
        "mode": "engine",
        "homeState": home_state,
        "homePath": home_path.to_string_lossy(),
    }))
}
