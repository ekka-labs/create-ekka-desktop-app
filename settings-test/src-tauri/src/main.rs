// EKKA Desktop - Tauri Entry Point
// DO NOT EDIT - Managed by EKKA
//
// This is a minimal Tauri shell that loads the web UI.
// No backend logic here - the app runs standalone with in-memory demo.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::path::PathBuf;

/// Runtime information for diagnostics
#[derive(Serialize)]
struct RuntimeInfo {
    runtime: String,
    engine_present: bool,
    engine_path: Option<String>,
    app_version: String,
}

/// Get runtime diagnostics information
/// Called from TypeScript to display in Settings screen
#[tauri::command]
fn get_runtime_info() -> RuntimeInfo {
    // Get the app version from Cargo.toml (embedded at compile time)
    let app_version = env!("CARGO_PKG_VERSION").to_string();

    // Check for engine sidecar presence
    // On macOS, the app bundle structure is:
    //   MyApp.app/Contents/MacOS/MyApp (binary)
    //   MyApp.app/Contents/Resources/bin/ekka-engine (sidecar)
    //
    // std::env::current_exe() gives us the binary path, so we navigate from there
    let (engine_present, engine_path) = check_engine_presence();

    RuntimeInfo {
        runtime: "tauri".to_string(),
        engine_present,
        engine_path,
        app_version,
    }
}

/// Check if the ekka-engine sidecar binary exists in the app bundle
fn check_engine_presence() -> (bool, Option<String>) {
    // Get the current executable path
    let exe_path = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return (false, None),
    };

    // Navigate to the expected engine location
    // From: Contents/MacOS/app-binary
    // To:   Contents/Resources/bin/ekka-engine
    let engine_path: PathBuf = exe_path
        .parent() // Contents/MacOS
        .and_then(|p| p.parent()) // Contents
        .map(|p| p.join("Resources").join("bin").join("ekka-engine"))
        .unwrap_or_default();

    if engine_path.exists() {
        (true, Some(engine_path.to_string_lossy().to_string()))
    } else {
        (false, None)
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_runtime_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
