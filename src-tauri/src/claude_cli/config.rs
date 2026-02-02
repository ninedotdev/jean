//! Configuration and path management for the embedded Claude CLI

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Directory name for storing the Claude CLI binary
pub const CLI_DIR_NAME: &str = "claude-cli";

/// Name of the Claude CLI binary
#[cfg(windows)]
pub const CLI_BINARY_NAME: &str = "claude.exe";
#[cfg(not(windows))]
pub const CLI_BINARY_NAME: &str = "claude";

/// Get the directory where Claude CLI is installed
///
/// Returns: `~/Library/Application Support/jean/claude-cli/`
pub fn get_cli_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;
    Ok(app_data_dir.join(CLI_DIR_NAME))
}

/// Try to find a globally installed Claude CLI binary
///
/// Checks:
/// 1. `which claude` (Unix) or `where claude` (Windows) command
/// 2. Common installation paths
fn find_global_cli_binary() -> Option<PathBuf> {
    // Try to find claude via shell command
    log::info!("Searching for global Claude CLI...");

    #[cfg(windows)]
    let which_cmd = "where claude";
    #[cfg(not(windows))]
    let which_cmd = "which claude";

    match crate::platform::shell_command(which_cmd).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            log::info!(
                "{which_cmd}: status={}, stdout='{}', stderr='{}'",
                output.status,
                stdout,
                stderr
            );
            if output.status.success() && !stdout.is_empty() {
                // On Windows, `where` may return multiple lines; take the first one
                let first_line = stdout.lines().next().unwrap_or(&stdout);
                let path = PathBuf::from(first_line);
                if path.exists() {
                    log::info!("Found global Claude CLI via '{which_cmd}': {first_line}");
                    return Some(path);
                }
            }
        }
        Err(e) => {
            log::warn!("Failed to run '{which_cmd}': {e}");
        }
    }

    // Check common installation paths (platform-specific)
    #[cfg(not(windows))]
    let common_paths: &[&str] = &[
        "/usr/local/bin/claude",
        "/opt/homebrew/bin/claude",
        "/opt/local/bin/claude",
    ];
    #[cfg(windows)]
    let common_paths: &[&str] = &[];

    // Also check user-specific paths
    if let Some(home) = dirs::home_dir() {
        #[cfg(not(windows))]
        {
            let local_bin_path = home.join(".local/bin/claude");
            log::info!("Checking ~/.local/bin/claude: {}", local_bin_path.display());
            if local_bin_path.exists() {
                log::info!(
                    "Found global Claude CLI at ~/.local/bin: {}",
                    local_bin_path.display()
                );
                return Some(local_bin_path);
            } else {
                log::info!("~/.local/bin/claude does not exist");
            }
        }

        // Check ~/.claude/local/claude[.exe] (npm global install location)
        let npm_path = home.join(".claude/local").join(CLI_BINARY_NAME);
        if npm_path.exists() {
            log::info!(
                "Found global Claude CLI at npm path: {}",
                npm_path.display()
            );
            return Some(npm_path);
        }

        // On Windows, also check AppData locations
        #[cfg(windows)]
        {
            let windows_paths: Vec<PathBuf> = vec![
                // npm global install locations
                home.join("AppData/Roaming/npm/claude.cmd"),
                home.join("AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/cli.js"),
                // Local Programs
                home.join("AppData/Local/Programs/claude/claude.exe"),
                // Scoop install location
                home.join("scoop/apps/claude/current/claude.exe"),
                // Chocolatey
                PathBuf::from("C:/ProgramData/chocolatey/bin/claude.exe"),
            ];

            for path in windows_paths {
                log::info!("Checking Windows path: {}", path.display());
                if path.exists() {
                    log::info!("Found global Claude CLI at: {}", path.display());
                    return Some(path);
                }
            }
        }
    } else {
        log::warn!("Could not get home directory");
    }

    for path_str in common_paths {
        let path = PathBuf::from(path_str);
        if path.exists() {
            log::debug!("Found global Claude CLI at common path: {path_str}");
            return Some(path);
        }
    }

    log::warn!("No global Claude CLI found");
    None
}

/// Get the full path to the Claude CLI binary
///
/// Checks in order:
/// 1. App's embedded directory: `~/Library/Application Support/jean/claude-cli/claude`
/// 2. Global installation via `which claude`
/// 3. Common installation paths
pub fn get_cli_binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    // First check the app's embedded directory
    let embedded_path = get_cli_dir(app)?.join(CLI_BINARY_NAME);
    log::info!("Checking embedded path: {}", embedded_path.display());
    if embedded_path.exists() {
        log::info!("Using embedded Claude CLI: {}", embedded_path.display());
        return Ok(embedded_path);
    }
    log::info!("Embedded path does not exist, checking global...");

    // Fall back to global installation
    if let Some(global_path) = find_global_cli_binary() {
        log::info!("Using global Claude CLI: {}", global_path.display());
        return Ok(global_path);
    }

    // Return the embedded path anyway (will fail existence check later with proper error)
    log::warn!("No Claude CLI found, returning embedded path for error handling");
    Ok(embedded_path)
}

/// Ensure the CLI directory exists, creating it if necessary
pub fn ensure_cli_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let cli_dir = get_cli_dir(app)?;
    std::fs::create_dir_all(&cli_dir)
        .map_err(|e| format!("Failed to create CLI directory: {e}"))?;
    Ok(cli_dir)
}
