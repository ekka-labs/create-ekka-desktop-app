//! Desktop Core Process Manager
//!
//! Spawns and communicates with the ekka-desktop-core child process
//! using JSON-RPC over stdio (newline-delimited JSON).
//!
//! # Architecture
//!
//! - Desktop Core is spawned once on first request (lazy init)
//! - stdin is used to send requests, stdout to receive responses
//! - Each request has a unique `id` for correlation
//! - Timeout: 10s per request
//! - On process death, auto-restarts on next request

use crate::types::EngineResponse;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Request envelope sent to Desktop Core
#[derive(Debug, Serialize)]
struct CoreRequest {
    id: String,
    op: String,
    payload: Value,
}

/// Response envelope received from Desktop Core
#[derive(Debug, Deserialize)]
struct CoreResponse {
    id: String,
    ok: bool,
    result: Option<Value>,
    error: Option<CoreError>,
}

#[derive(Debug, Deserialize)]
struct CoreError {
    code: String,
    message: String,
}

/// Desktop Core process holder
struct CoreProcess {
    child: Child,
    stdin: std::process::ChildStdin,
    /// Pending responses keyed by request ID
    pending: Arc<Mutex<HashMap<String, CoreResponse>>>,
    /// Reader thread handle (reads stdout in background)
    _reader_thread: std::thread::JoinHandle<()>,
}

/// Thread-safe manager for the Desktop Core process
pub struct CoreProcessManager {
    inner: Mutex<Option<CoreProcess>>,
}

impl CoreProcessManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    /// Send a request to Desktop Core and wait for response
    ///
    /// Spawns the process lazily on first call. Auto-restarts on death.
    pub fn request(&self, op: &str, payload: &Value) -> EngineResponse {
        let request_id = uuid::Uuid::new_v4().to_string();
        let req = CoreRequest {
            id: request_id.clone(),
            op: op.to_string(),
            payload: payload.clone(),
        };

        // Serialize request
        let mut req_line = match serde_json::to_string(&req) {
            Ok(s) => s,
            Err(e) => {
                return EngineResponse::err("CORE_SERIALIZE_ERROR", &e.to_string());
            }
        };
        req_line.push('\n');

        // Get or spawn process, then send request
        let pending = {
            let mut guard = match self.inner.lock() {
                Ok(g) => g,
                Err(e) => {
                    return EngineResponse::err("CORE_LOCK_ERROR", &e.to_string());
                }
            };

            // Spawn if needed (or if previous process died)
            let needs_spawn = match guard.as_mut() {
                None => true,
                Some(proc) => {
                    // Check if child is still alive
                    match proc.child.try_wait() {
                        Ok(Some(_)) => {
                            tracing::warn!(
                                op = "core.process.died",
                                "Desktop Core process died, will restart"
                            );
                            true
                        }
                        Ok(None) => false, // Still running
                        Err(_) => true,
                    }
                }
            };

            if needs_spawn {
                match spawn_core_process() {
                    Ok(proc) => {
                        tracing::info!(
                            op = "core.process.spawned",
                            pid = proc.child.id(),
                            "Desktop Core process spawned"
                        );
                        *guard = Some(proc);
                    }
                    Err(e) => {
                        return EngineResponse::err("CORE_SPAWN_ERROR", &e);
                    }
                }
            }

            let proc = guard.as_mut().unwrap();

            // Write request to stdin
            if let Err(e) = proc.stdin.write_all(req_line.as_bytes()) {
                tracing::error!(op = "core.stdin.error", error = %e, "Failed to write to Core stdin");
                *guard = None; // Kill reference, will respawn next time
                return EngineResponse::err("CORE_WRITE_ERROR", &e.to_string());
            }
            if let Err(e) = proc.stdin.flush() {
                tracing::error!(op = "core.stdin.error", error = %e, "Failed to flush Core stdin");
                *guard = None;
                return EngineResponse::err("CORE_WRITE_ERROR", &e.to_string());
            }

            proc.pending.clone()
        };

        // Wait for response with timeout
        let timeout = Duration::from_secs(10);
        let start = Instant::now();

        loop {
            if start.elapsed() > timeout {
                tracing::error!(
                    op = "core.timeout",
                    id = %request_id,
                    "Desktop Core request timed out after 10s"
                );
                return EngineResponse::err(
                    "CORE_TIMEOUT",
                    &format!("Desktop Core did not respond within 10s for op: {}", op),
                );
            }

            // Check if response arrived
            {
                let mut map = match pending.lock() {
                    Ok(g) => g,
                    Err(e) => {
                        return EngineResponse::err("CORE_LOCK_ERROR", &e.to_string());
                    }
                };

                if let Some(resp) = map.remove(&request_id) {
                    // Convert CoreResponse → EngineResponse
                    if resp.ok {
                        return EngineResponse::ok(resp.result.unwrap_or(Value::Null));
                    } else {
                        let err = resp.error.unwrap_or(CoreError {
                            code: "CORE_ERROR".to_string(),
                            message: "Unknown error from Desktop Core".to_string(),
                        });
                        return EngineResponse::err(&err.code, &err.message);
                    }
                }
            }

            // Brief sleep before checking again
            std::thread::sleep(Duration::from_millis(5));
        }
    }
}

impl Default for CoreProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Spawn the Desktop Core child process
fn spawn_core_process() -> Result<CoreProcess, String> {
    // Find the Desktop Core binary
    let core_binary = find_core_binary()?;

    tracing::info!(
        op = "core.process.spawn",
        binary = %core_binary.display(),
        "Spawning Desktop Core process"
    );

    let mut child = Command::new(&core_binary)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit()) // Core logs go to stderr, which we inherit
        .spawn()
        .map_err(|e| format!("Failed to spawn Desktop Core: {}", e))?;

    let stdin = child.stdin.take().ok_or("Failed to capture Core stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to capture Core stdout")?;

    // Shared map for correlating responses
    let pending: Arc<Mutex<HashMap<String, CoreResponse>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let pending_for_reader = pending.clone();

    // Background reader thread: reads JSON lines from Core stdout
    let reader_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(e) => {
                    tracing::warn!(
                        op = "core.stdout.closed",
                        error = %e,
                        "Desktop Core stdout closed"
                    );
                    break;
                }
            };

            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            // Parse response
            match serde_json::from_str::<CoreResponse>(trimmed) {
                Ok(resp) => {
                    let resp_id = resp.id.clone();
                    if let Ok(mut map) = pending_for_reader.lock() {
                        map.insert(resp_id, resp);
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        op = "core.stdout.parse_error",
                        error = %e,
                        line = %trimmed,
                        "Failed to parse Core response"
                    );
                }
            }
        }
    });

    Ok(CoreProcess {
        child,
        stdin,
        pending,
        _reader_thread: reader_thread,
    })
}

/// Find the Desktop Core binary
///
/// Search order:
/// 1. EKKA_DESKTOP_CORE_BIN env var (dev override)
/// 2. Same directory as current executable
/// 3. Cargo target directory (dev builds)
fn find_core_binary() -> Result<std::path::PathBuf, String> {
    // 1. Env var override
    if let Ok(path) = std::env::var("EKKA_DESKTOP_CORE_BIN") {
        let p = std::path::PathBuf::from(&path);
        if p.exists() {
            return Ok(p);
        }
        tracing::warn!(
            op = "core.binary.env_not_found",
            path = %path,
            "EKKA_DESKTOP_CORE_BIN set but binary not found"
        );
    }

    // 2. Same directory as current executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join("ekka-desktop-core");
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    // 3. Cargo target directory (dev builds)
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let dev_path = std::path::PathBuf::from(manifest_dir)
        .join("crates")
        .join("ekka-desktop-core")
        .join("target")
        .join("debug")
        .join("ekka-desktop-core");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // Also check release
    let release_path = std::path::PathBuf::from(manifest_dir)
        .join("crates")
        .join("ekka-desktop-core")
        .join("target")
        .join("release")
        .join("ekka-desktop-core");
    if release_path.exists() {
        return Ok(release_path);
    }

    Err(format!(
        "Desktop Core binary not found. Build it first:\n  \
         cd {}/crates/ekka-desktop-core && cargo build\n  \
         Or set EKKA_DESKTOP_CORE_BIN env var.",
        manifest_dir
    ))
}
