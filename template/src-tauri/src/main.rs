// EKKA Desktop - Tauri Entry Point
// DO NOT EDIT - Managed by EKKA
//
// This is a minimal Tauri shell that loads the web UI.
// No backend logic here - the app runs standalone with in-memory demo.
// If ekka-engine sidecar is present, it will be spawned on startup.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::sync::Mutex;
use tauri::{Manager, State};
use tauri_plugin_shell::ShellExt;

/// Engine state - tracks whether sidecar started successfully
struct EngineState {
    started: bool,
    path: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
struct RuntimeInfo {
    runtime: String,
    engine_present: bool,
    engine_path: Option<String>,
    engine_error: Option<String>,
}

/// Get runtime info including whether engine sidecar is running
#[tauri::command]
fn get_runtime_info(state: State<Mutex<EngineState>>) -> RuntimeInfo {
    let engine = state.lock().unwrap();
    RuntimeInfo {
        runtime: "tauri".to_string(),
        engine_present: engine.started,
        engine_path: engine.path.clone(),
        engine_error: engine.error.clone(),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(EngineState {
            started: false,
            path: None,
            error: None,
        }))
        .invoke_handler(tauri::generate_handler![get_runtime_info])
        .setup(|app| {
            // Try to spawn ekka-engine sidecar if present
            let shell = app.shell();
            let state = app.state::<Mutex<EngineState>>();

            match shell.sidecar("ekka-engine") {
                Ok(cmd) => {
                    // Get the sidecar path before spawning
                    let exe_path = std::env::current_exe().ok();
                    let sidecar_path = exe_path
                        .and_then(|p| p.parent().map(|d| d.join("ekka-engine")))
                        .map(|p| p.to_string_lossy().to_string());

                    match cmd.spawn() {
                        Ok(_child) => {
                            println!("[ekka] Engine sidecar started successfully");
                            let mut engine = state.lock().unwrap();
                            engine.started = true;
                            engine.path = sidecar_path;
                            engine.error = None;
                        }
                        Err(e) => {
                            let err_msg = format!("{}", e);
                            println!("[ekka] Engine spawn failed: {} (running in demo mode)", err_msg);
                            let mut engine = state.lock().unwrap();
                            engine.started = false;
                            engine.path = sidecar_path;
                            engine.error = Some(err_msg);
                        }
                    }
                }
                Err(e) => {
                    let err_msg = format!("{}", e);
                    println!("[ekka] Engine not configured: {} (running in demo mode)", err_msg);
                    let mut engine = state.lock().unwrap();
                    engine.started = false;
                    engine.path = None;
                    engine.error = Some(err_msg);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
