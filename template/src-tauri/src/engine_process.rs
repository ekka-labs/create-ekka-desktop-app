//! Engine Process Management
//!
//! Handles spawning and readiness checking for the external ekka-engine binary.
//!
//! ═══════════════════════════════════════════════════════════════════════════════════════════
//! ARCHITECTURE NOTE
//! ═══════════════════════════════════════════════════════════════════════════════════════════
//! The spawned engine is a RUNNER RUNTIME (ekka-runner-local), NOT a request router.
//! It provides:
//! - /health endpoint for readiness check
//! - Task execution via runner_tasks_v2 polling
//!
//! It does NOT provide:
//! - /request endpoint (removed - never existed in runner)
//! - Command routing (all commands go to local Rust handlers + cloud API)
//!
//! Responsibilities:
//! - Spawn ekka-engine binary on startup
//! - Check readiness via /health endpoint
//! - Clean shutdown on Desktop exit
//! - Read-only status visibility (installed, running, available, pid)
//! - Log streaming (stdout/stderr forwarding)
//! ═══════════════════════════════════════════════════════════════════════════════════════════

use crate::bootstrap::resolve_home_path;
use crate::node_credentials;
use regex::Regex;
use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

// =============================================================================
// Log Cleaning Utilities
// =============================================================================

/// Strip ANSI escape codes from a string (colors, formatting, etc.)
fn strip_ansi_codes(s: &str) -> String {
    // Match ANSI escape sequences: ESC [ ... m (and other variants)
    lazy_static::lazy_static! {
        static ref ANSI_RE: Regex = Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]").unwrap();
    }
    ANSI_RE.replace_all(s, "").to_string()
}

/// Log engine output with clean formatting
///
/// Bootstrap lines are prefixed with [BOOTSTRAP] and logged as bootstrap op.
/// Engine lines with ERROR/error are logged as errors.
/// Everything else is logged as engine info.
fn log_engine_output(line: &str, stream: &str) {
    let clean = strip_ansi_codes(line);
    let trimmed = clean.trim();

    if trimmed.is_empty() {
        return;
    }

    if trimmed.starts_with("[BOOTSTRAP]") {
        // Bootstrap output - log with bootstrap op
        tracing::info!(op = "bootstrap", stream = stream, "{}", trimmed);
    } else if trimmed.contains("ERROR") || trimmed.contains("error:") {
        // Error line
        tracing::error!(op = "engine", stream = stream, "{}", trimmed);
    } else {
        // Regular engine output
        tracing::info!(op = "engine", stream = stream, "{}", trimmed);
    }
}

// =============================================================================
// Engine Environment Builder
// =============================================================================

/// Build environment variables for engine process spawn.
/// Returns Err with missing key name if a required var is missing/invalid.
///
/// Order of precedence for node credentials:
/// 1. OS Keychain (stored via nodeCredentials.set)
/// 2. Environment variables (EKKA_NODE_ID, EKKA_NODE_SECRET)
fn build_engine_env() -> Result<Vec<(&'static str, String)>, &'static str> {
    let mut env = Vec::new();

    // EKKA_RUNNER_MODE=engine (always set)
    env.push(("EKKA_RUNNER_MODE", "engine".to_string()));

    // EKKA_ENGINE_URL - baked at build time
    if let Some(url) = option_env!("EKKA_ENGINE_URL") {
        env.push(("EKKA_ENGINE_URL", url.to_string()));
    }

    // Node credentials: Try keychain first, fall back to env vars
    // This enables headless engine startup without manual env exports
    if let Ok((node_id, node_secret)) = node_credentials::load_credentials() {
        env.push(("EKKA_NODE_ID", node_id.to_string()));
        env.push(("EKKA_NODE_SECRET", node_secret));

        tracing::info!(
            op = "desktop.node.identity.loaded",
            keys = ?["node_id", "node_secret"],
            node_id = %node_id,
            "Node credentials loaded from keychain for engine spawn"
        );
    } else {
        // Fallback to environment variables
        if let Ok(node_id) = std::env::var("EKKA_NODE_ID") {
            env.push(("EKKA_NODE_ID", node_id));
        }
        if let Ok(node_secret) = std::env::var("EKKA_NODE_SECRET") {
            env.push(("EKKA_NODE_SECRET", node_secret));
        }
    }

    Ok(env)
}

/// Engine status for diagnostics (read-only)
#[derive(Debug, Clone, Serialize)]
pub struct EngineStatus {
    pub installed: bool,
    pub running: bool,
    pub available: bool,
    pub pid: Option<u32>,
    pub version: Option<String>,
    pub build: Option<String>,
}

/// Engine process holder
pub struct EngineProcess {
    child: Mutex<Option<Child>>,
    available: Mutex<bool>,
    installed: Mutex<bool>,
}

impl EngineProcess {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            available: Mutex::new(false),
            installed: Mutex::new(false),
        }
    }

    /// Check if engine is available
    pub fn is_available(&self) -> bool {
        self.available.lock().map(|g| *g).unwrap_or(false)
    }

    /// Check if engine binary is installed
    pub fn is_installed(&self) -> bool {
        self.installed.lock().map(|g| *g).unwrap_or(false)
    }

    /// Check if engine process is running (has child and not exited)
    pub fn is_running(&self) -> bool {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(ref mut child) = *guard {
                // try_wait returns Ok(Some(_)) if exited, Ok(None) if still running
                return child.try_wait().ok().flatten().is_none();
            }
        }
        false
    }

    /// Get engine process ID (if running)
    pub fn get_pid(&self) -> Option<u32> {
        if let Ok(guard) = self.child.lock() {
            if let Some(ref child) = *guard {
                return Some(child.id());
            }
        }
        None
    }

    /// Get engine status (read-only diagnostics)
    pub fn get_status(&self) -> EngineStatus {
        EngineStatus {
            installed: self.is_installed(),
            running: self.is_running(),
            available: self.is_available(),
            pid: self.get_pid(),
            // Version/build require engine info endpoint (not yet available)
            version: None,
            build: None,
        }
    }

    /// Set availability
    fn set_available(&self, available: bool) {
        if let Ok(mut guard) = self.available.lock() {
            *guard = available;
        }
    }

    /// Set installed flag
    fn set_installed(&self, installed: bool) {
        if let Ok(mut guard) = self.installed.lock() {
            *guard = installed;
        }
    }

}

impl Default for EngineProcess {
    fn default() -> Self {
        Self::new()
    }
}

/// Compute bootstrap binary path using ekka_home_folder
/// Bootstrap is installed from resources and always runs first
fn compute_bootstrap_path() -> Result<PathBuf, String> {
    let home = resolve_home_path()?;
    Ok(home.join("engine").join("ekka-engine-bootstrap"))
}

/// Compute engine binary path using ekka_home_folder
/// Engine is downloaded by bootstrap and exec'd into
fn compute_engine_path() -> Result<PathBuf, String> {
    let home = resolve_home_path()?;
    Ok(home.join("engine").join("ekka-engine"))
}

// =============================================================================
// Orphan Detection & Cleanup
// =============================================================================

/// Path to engine PID file for orphan detection
fn engine_pidfile_path() -> Option<PathBuf> {
    resolve_home_path()
        .ok()
        .map(|home| home.join("engine").join("engine.pid"))
}

/// Write engine child PID to pidfile
fn write_engine_pidfile(pid: u32) {
    if let Some(path) = engine_pidfile_path() {
        if let Err(e) = fs::write(&path, pid.to_string()) {
            tracing::warn!(op = "engine.pidfile.write_failed", error = %e, "Failed to write pidfile");
        }
    }
}

/// Remove engine pidfile (called on shutdown)
fn remove_engine_pidfile() {
    if let Some(path) = engine_pidfile_path() {
        let _ = fs::remove_file(&path);
    }
}

/// Kill an orphan engine process from a previous run using pidfile
#[cfg(unix)]
fn kill_orphan_engine() {
    let path = match engine_pidfile_path() {
        Some(p) if p.exists() => p,
        _ => return,
    };

    let pid_str = match fs::read_to_string(&path) {
        Ok(c) if !c.trim().is_empty() => c.trim().to_string(),
        _ => {
            let _ = fs::remove_file(&path);
            return;
        }
    };

    tracing::info!(op = "engine.orphan.kill", pid = %pid_str, "Killing orphan engine process");

    // SIGTERM
    let _ = Command::new("kill").arg(&pid_str).output();
    std::thread::sleep(Duration::from_secs(1));

    // SIGKILL if still alive
    let still_alive = Command::new("kill")
        .args(["-0", &pid_str])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if still_alive {
        let _ = Command::new("kill").args(["-9", &pid_str]).output();
        std::thread::sleep(Duration::from_millis(500));
    }

    let _ = fs::remove_file(&path);
    tracing::info!(op = "engine.orphan.cleaned", "Orphan engine cleaned up");
}

#[cfg(not(unix))]
fn kill_orphan_engine() {
    // No-op on non-Unix platforms
}

/// Check if a healthy engine is already running on the health port
fn check_existing_engine_healthy() -> bool {
    let port: u16 = std::env::var("EKKA_ENGINE_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(9473);

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    match std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(250)) {
        Ok(_) => {
            tracing::info!(
                op = "engine.existing.found",
                port = port,
                "Existing engine found on health port, reusing"
            );
            true
        }
        Err(_) => false,
    }
}

/// Ensure bootstrap engine is installed from embedded resources
///
/// Extracts the bundled ekka-engine-bootstrap binary to ekka_home_folder/engine/ekka-engine-bootstrap
/// if it doesn't already exist. The bootstrap will then download the real engine to ekka-engine.
///
/// Returns Ok(true) if installed, Ok(false) if already present.
pub fn ensure_bootstrap_installed_from_resources(resource_path: Option<PathBuf>) -> Result<bool, String> {
    let bootstrap_path = compute_bootstrap_path()?;

    // Already installed - return silently
    if bootstrap_path.exists() {
        return Ok(false);
    }

    // Get resource bytes - try packaged path first, fall back to dev path
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("ekka-engine-bootstrap");

    let effective_path = match &resource_path {
        Some(path) if path.exists() => path.clone(),
        _ => dev_path.clone(),
    };

    if !effective_path.exists() {
        tracing::warn!(
            op = "engine.bootstrap.resource_missing",
            resource = %effective_path.display(),
            "Bootstrap resource not found"
        );
        return Err("Bootstrap resource not found".to_string());
    }

    let resource_bytes = fs::read(&effective_path).map_err(|e| {
        tracing::warn!(
            op = "engine.bootstrap.resource_missing",
            resource = %effective_path.display(),
            error = %e,
            "Bootstrap resource not readable"
        );
        format!("Failed to read resource: {}", e)
    })?;

    // Create engine directory
    let engine_dir = bootstrap_path.parent().ok_or("Invalid bootstrap path")?;
    fs::create_dir_all(engine_dir)
        .map_err(|e| format!("Failed to create engine directory: {}", e))?;

    // Write atomically: tmp file -> chmod +x -> rename
    let tmp_path = bootstrap_path.with_extension("tmp");

    let mut file = fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    file.write_all(&resource_bytes)
        .map_err(|e| format!("Failed to write bootstrap binary: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync file: {}", e))?;
    drop(file);

    // Set executable permission (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&tmp_path)
            .map_err(|e| format!("Failed to get permissions: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&tmp_path, perms)
            .map_err(|e| format!("Failed to set executable: {}", e))?;
    }

    // Atomic rename
    fs::rename(&tmp_path, &bootstrap_path)
        .map_err(|e| format!("Failed to rename to final path: {}", e))?;

    tracing::info!(
        op = "engine.bootstrap.install",
        path = %bootstrap_path.display(),
        "Bootstrap installed from resources"
    );

    Ok(true)
}

/// Spawn and wait for engine readiness
///
/// Two-binary architecture:
/// 1. Desktop spawns ekka-engine-bootstrap
/// 2. Bootstrap checks release service and downloads ekka-engine if needed
/// 3. Bootstrap execs into ekka-engine (same PID)
/// 4. Desktop waits for engine health check
///
/// Returns true if engine is ready, false otherwise.
/// Stores result in EngineProcess.available.
pub fn spawn_and_wait(engine: &EngineProcess) -> bool {
    // Pre-spawn guard: reuse existing healthy engine (survives hot reload)
    if check_existing_engine_healthy() {
        engine.set_installed(true);
        engine.set_available(true);
        return true;
    }

    // Kill orphan from previous run if pidfile exists
    kill_orphan_engine();

    // Get both paths
    let bootstrap_path = match compute_bootstrap_path() {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(
                op = "engine.path.error",
                error = %e,
                "Failed to compute bootstrap path"
            );
            engine.set_available(false);
            return false;
        }
    };

    let engine_path = match compute_engine_path() {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(
                op = "engine.path.error",
                error = %e,
                "Failed to compute engine path"
            );
            engine.set_available(false);
            return false;
        }
    };

    // Check if bootstrap binary exists (must be installed from resources)
    let installed = bootstrap_path.exists();
    engine.set_installed(installed);

    if !installed {
        tracing::info!(
            op = "engine.spawn.missing",
            path = %bootstrap_path.display(),
            "Bootstrap binary not found, using local handlers"
        );
        engine.set_available(false);
        return false;
    }

    tracing::info!(
        op = "desktop.bootstrap.start",
        path = %bootstrap_path.display(),
        exists = bootstrap_path.exists(),
        "Starting bootstrap"
    );

    // Build engine environment from process env
    let engine_env = match build_engine_env() {
        Ok(env) => env,
        Err(missing_key) => {
            tracing::error!(
                op = "engine.spawn.missing_required_env",
                key = %missing_key,
                "Required environment variable missing or invalid"
            );
            engine.set_available(false);
            return false;
        }
    };

    tracing::debug!(
        op = "engine.spawn.env",
        keys = ?engine_env.iter().map(|(k, _)| *k).collect::<Vec<_>>(),
        "Setting engine environment"
    );

    // Spawn the BOOTSTRAP process (not engine directly) with piped stdout/stderr
    let mut child = match Command::new(&bootstrap_path)
        .envs(engine_env)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(
                op = "engine.spawn.failed",
                error = %e,
                path = %bootstrap_path.display(),
                "Failed to spawn bootstrap process"
            );
            engine.set_available(false);
            return false;
        }
    };

    // Spawn log reader threads with clean formatting
    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => log_engine_output(&l, "stdout"),
                    Err(_) => break,
                }
            }
            tracing::debug!(op = "engine.stdout.closed", "Engine stdout stream closed");
        });
    }

    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(l) => log_engine_output(&l, "stderr"),
                    Err(_) => break,
                }
            }
            tracing::debug!(op = "engine.stderr.closed", "Engine stderr stream closed");
        });
    }

    // Get pid for logging
    let pid = child.id();
    write_engine_pidfile(pid);

    // Store child process
    if let Ok(mut guard) = engine.child.lock() {
        *guard = Some(child);
    }

    tracing::info!(op = "engine.spawn.success", pid = pid, "Bootstrap process spawned");

    // Allow bootstrap time to download engine (if needed) and exec into it
    // Bootstrap either: execs real engine (same PID), or exits with error code
    std::thread::sleep(Duration::from_secs(2));

    // Check if bootstrap exited early (indicates failure)
    let bootstrap_failed = if let Ok(mut guard) = engine.child.lock() {
        if let Some(ref mut c) = *guard {
            match c.try_wait() {
                Ok(Some(status)) => {
                    let code = status.code();
                    tracing::warn!(
                        op = "engine.bootstrap.failed",
                        pid = pid,
                        exit_code = ?code,
                        "Bootstrap exited early - real engine not started"
                    );
                    true
                }
                Ok(None) => false, // Still running = bootstrap exec'd into real engine
                Err(_) => true,
            }
        } else {
            true
        }
    } else {
        true
    };

    if bootstrap_failed {
        tracing::error!(
            op = "engine.bootstrap.fatal",
            pid = pid,
            "FATAL: Bootstrap failed to start engine. Check logs above for error details."
        );
        engine.set_available(false);
        return false;
    }

    tracing::debug!(
        op = "engine.bootstrap.exec",
        pid = pid,
        engine_path = %engine_path.display(),
        "Bootstrap exec'd into real engine, starting readiness check"
    );

    // Wait for readiness (real engine should now be running)
    let ready = wait_for_ready(15);
    engine.set_available(ready);

    if ready {
        tracing::info!(op = "desktop.engine.ready", "Engine is ready");
    } else {
        tracing::warn!(op = "engine.ready.timeout", "Engine readiness timeout");
    }

    ready
}

/// Wait for engine to become ready by checking health endpoint
fn wait_for_ready(timeout_secs: u64) -> bool {
    // Default port for engine health check
    let port: u16 = std::env::var("EKKA_ENGINE_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(9473);

    let url = format!("http://127.0.0.1:{}/health", port);

    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let start = Instant::now();
    let timeout = Duration::from_secs(timeout_secs);

    while start.elapsed() < timeout {
        if let Ok(resp) = client.get(&url).send() {
            if resp.status().is_success() {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(500));
    }

    false
}

/// Shutdown engine process (called on app exit)
pub fn shutdown(engine: &EngineProcess) {
    if let Ok(mut guard) = engine.child.lock() {
        if let Some(mut child) = guard.take() {
            tracing::info!(op = "engine.shutdown", "Shutting down engine process");
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    remove_engine_pidfile();
    engine.set_available(false);
}

// NOTE: route_to_engine() was removed.
// The spawned engine is a runner runtime (ekka-runner-local), not a request router.
// All commands go directly to local Rust handlers + cloud API.
// See commit history for removed code if needed.
