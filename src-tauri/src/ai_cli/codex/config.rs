//! Codex CLI configuration
//!
//! Path and configuration utilities for the OpenAI Codex CLI.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Directory name for storing the Codex CLI binary
pub const CLI_DIR_NAME: &str = "codex-cli";

/// Name of the Codex CLI binary
#[cfg(not(target_os = "windows"))]
pub const CLI_BINARY_NAME: &str = "codex";

#[cfg(target_os = "windows")]
pub const CLI_BINARY_NAME: &str = "codex.exe";

/// GitHub API URL for Codex releases
pub const CODEX_RELEASES_API: &str = "https://api.github.com/repos/openai/codex/releases";

/// Get the directory where Codex CLI is installed (app data)
pub fn get_cli_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;
    Ok(app_data_dir.join(CLI_DIR_NAME))
}

/// Get the full path to the embedded Codex CLI binary
pub fn get_embedded_cli_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_cli_dir(app)?.join(CLI_BINARY_NAME))
}

/// Ensure the CLI directory exists
pub fn ensure_cli_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let cli_dir = get_cli_dir(app)?;
    std::fs::create_dir_all(&cli_dir)
        .map_err(|e| format!("Failed to create CLI directory: {e}"))?;
    Ok(cli_dir)
}

/// Try to find a globally installed Codex CLI binary
fn find_global_cli_binary() -> Option<PathBuf> {
    // Try `which codex` via shell to get user's PATH
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = crate::platform::shell_command("which codex").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path_str.is_empty() {
                    let path = PathBuf::from(&path_str);
                    if path.exists() {
                        log::debug!("Found global Codex CLI via 'which': {path_str}");
                        return Some(path);
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, npm installs create .cmd wrapper scripts
        // Look for codex.cmd first, then codex.exe
        if let Ok(output) = std::process::Command::new("where").arg("codex.cmd").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !path_str.is_empty() {
                    let path = PathBuf::from(&path_str);
                    if path.exists() {
                        log::info!("Found global Codex CLI via 'where codex.cmd': {path_str}");
                        return Some(path);
                    }
                }
            }
        }

        // Try codex.exe as fallback
        if let Ok(output) = std::process::Command::new("where").arg("codex.exe").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !path_str.is_empty() {
                    let path = PathBuf::from(&path_str);
                    if path.exists() {
                        log::info!("Found global Codex CLI via 'where codex.exe': {path_str}");
                        return Some(path);
                    }
                }
            }
        }
    }

    // Check common installation paths
    if let Some(home) = dirs::home_dir() {
        #[cfg(not(windows))]
        let paths: Vec<PathBuf> = vec![
            home.join(".local/bin/codex"),
            home.join(".npm-global/bin/codex"),
        ];

        #[cfg(windows)]
        let paths: Vec<PathBuf> = vec![
            home.join(".local/bin/codex.exe"),
            home.join(".npm-global/codex.cmd"),
            home.join("AppData/Roaming/npm/codex.cmd"),
            home.join("AppData/Roaming/npm/node_modules/@openai/codex/bin/codex.exe"),
            home.join("AppData/Local/Programs/codex/codex.exe"),
            // Scoop
            home.join("scoop/apps/codex/current/codex.exe"),
        ];

        for path in &paths {
            log::debug!("Checking path: {}", path.display());
            if path.exists() {
                log::info!("Found global Codex CLI at: {}", path.display());
                return Some(path.clone());
            }
        }
    }

    // System paths
    #[cfg(target_os = "macos")]
    {
        let paths = ["/usr/local/bin/codex", "/opt/homebrew/bin/codex"];
        for path_str in paths {
            let path = PathBuf::from(path_str);
            if path.exists() {
                log::debug!("Found global Codex CLI at: {path_str}");
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let path = PathBuf::from("/usr/local/bin/codex");
        if path.exists() {
            log::debug!("Found global Codex CLI at: /usr/local/bin/codex");
            return Some(path);
        }
    }

    None
}

/// Get the path where Codex CLI is installed
/// Checks embedded path first, then falls back to global installation
pub fn get_codex_cli_path(app: &AppHandle) -> Result<PathBuf, String> {
    // First check the app's embedded directory
    let embedded_path = get_embedded_cli_path(app)?;
    if embedded_path.exists() {
        log::debug!("Using embedded Codex CLI: {}", embedded_path.display());
        return Ok(embedded_path);
    }

    // Fall back to global installation
    if let Some(global_path) = find_global_cli_binary() {
        log::debug!("Using global Codex CLI: {}", global_path.display());
        return Ok(global_path);
    }

    Err("Codex CLI not found. Please install it from Settings.".to_string())
}

/// Get the path without AppHandle (for backward compatibility)
/// Only checks global paths
#[allow(dead_code)]
pub fn get_codex_cli_path_global() -> Result<PathBuf, String> {
    if let Some(global_path) = find_global_cli_binary() {
        return Ok(global_path);
    }
    Err("Codex CLI not found".to_string())
}

/// Get the platform-specific asset name and extracted binary name for GitHub releases
pub fn get_codex_asset() -> Result<(&'static str, &'static str), String> {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        Ok((
            "codex-macos-arm64.tar.gz",
            "codex",
        ))
    }

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        Ok((
            "codex-macos-x64.tar.gz",
            "codex",
        ))
    }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        Ok((
            "codex-linux-x64.tar.gz",
            "codex",
        ))
    }

    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        Ok((
            "codex-linux-arm64.tar.gz",
            "codex",
        ))
    }

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        Ok((
            "codex-win32-x64.zip",
            "codex.exe",
        ))
    }

    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    {
        Ok((
            "codex-win32-arm64.zip",
            "codex.exe",
        ))
    }

    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "windows", target_arch = "aarch64"),
    )))]
    {
        Err("Unsupported platform for Codex CLI".to_string())
    }
}
