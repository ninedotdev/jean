//! Kimi CLI Tauri commands
//!
//! Commands for checking, installing, and authenticating with the Kimi Code CLI.

use super::config::{get_kimi_cli_path, get_kimi_config_dir, is_uv_installed};
use crate::ai_cli::types::{AiCliAuthStatus, AiCliStatus};
use std::process::Command;

/// Check if Kimi CLI is installed and get version info
#[tauri::command]
pub fn check_kimi_cli_installed() -> AiCliStatus {
    log::trace!("Checking Kimi CLI installation");

    match get_kimi_cli_path() {
        Ok(path) => {
            // Try to get version
            let version = Command::new(&path)
                .arg("--version")
                .output()
                .ok()
                .and_then(|output| {
                    if output.status.success() {
                        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
                    } else {
                        None
                    }
                });

            AiCliStatus {
                installed: true,
                version,
                path: Some(path.to_string_lossy().to_string()),
            }
        }
        Err(_) => AiCliStatus {
            installed: false,
            version: None,
            path: None,
        },
    }
}

/// Check if Kimi CLI is authenticated
/// Kimi CLI stores authentication in ~/.kimi/credentials/kimi-code.json
#[tauri::command]
pub fn check_kimi_cli_auth() -> AiCliAuthStatus {
    log::trace!("Checking Kimi CLI authentication");

    // Check if Kimi config directory and credentials exist
    if let Some(config_dir) = get_kimi_config_dir() {
        // Kimi stores OAuth credentials in ~/.kimi/credentials/kimi-code.json
        let credentials_dir = config_dir.join("credentials");
        let kimi_code_creds = credentials_dir.join("kimi-code.json");

        if kimi_code_creds.exists() {
            if let Ok(metadata) = std::fs::metadata(&kimi_code_creds) {
                // Check if file has meaningful content (OAuth tokens are typically > 100 bytes)
                if metadata.len() > 50 {
                    log::trace!("Kimi CLI credentials found at {:?}", kimi_code_creds);
                    return AiCliAuthStatus {
                        authenticated: true,
                        error: None,
                    };
                }
            }
        }

        // Also check for other credential files in the credentials directory
        if credentials_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&credentials_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map_or(false, |ext| ext == "json") {
                        if let Ok(metadata) = std::fs::metadata(&path) {
                            if metadata.len() > 50 {
                                log::trace!("Kimi CLI credentials found at {:?}", path);
                                return AiCliAuthStatus {
                                    authenticated: true,
                                    error: None,
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    // Check environment variables as fallback
    let has_kimi_api_key = std::env::var("KIMI_API_KEY")
        .map(|k| !k.is_empty())
        .unwrap_or(false);
    let has_moonshot_api_key = std::env::var("MOONSHOT_API_KEY")
        .map(|k| !k.is_empty())
        .unwrap_or(false);

    if has_kimi_api_key || has_moonshot_api_key {
        log::trace!("Kimi API key is set via environment variable");
        return AiCliAuthStatus {
            authenticated: true,
            error: None,
        };
    }

    AiCliAuthStatus {
        authenticated: false,
        error: Some("Not logged in. Run 'kimi' and use /login to authenticate.".to_string()),
    }
}

/// Install Kimi CLI via the official install script
/// Uses: curl -LsSf https://code.kimi.com/install.sh | bash
#[tauri::command]
pub async fn install_kimi_cli() -> Result<String, String> {
    log::info!("Installing Kimi CLI");

    // Check if uv is installed (required for Kimi CLI)
    if !is_uv_installed() {
        log::info!("uv not found, installing uv first");
        
        // Install uv first
        let uv_install_output = if cfg!(target_os = "windows") {
            Command::new("powershell")
                .args([
                    "-ExecutionPolicy",
                    "ByPass",
                    "-c",
                    "irm https://astral.sh/uv/install.ps1 | iex",
                ])
                .output()
        } else {
            Command::new("sh")
                .args([
                    "-c",
                    "curl -LsSf https://astral.sh/uv/install.sh | sh",
                ])
                .output()
        }
        .map_err(|e| format!("Failed to run uv installer: {e}"))?;

        if !uv_install_output.status.success() {
            let stderr = String::from_utf8_lossy(&uv_install_output.stderr);
            return Err(format!("Failed to install uv: {stderr}"));
        }
    }

    // Install Kimi CLI using the official script
    log::info!("Running Kimi CLI install script");
    let output = if cfg!(target_os = "windows") {
        Command::new("powershell")
            .args([
                "-ExecutionPolicy",
                "ByPass",
                "-c",
                "Invoke-RestMethod https://code.kimi.com/install.ps1 | Invoke-Expression",
            ])
            .output()
    } else {
        Command::new("sh")
            .args([
                "-c",
                "curl -LsSf https://code.kimi.com/install.sh | bash",
            ])
            .output()
    }
    .map_err(|e| format!("Failed to run Kimi installer: {e}"))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        log::info!("Kimi CLI installed successfully: {}", stdout);
        Ok("Kimi CLI installed successfully. Run 'kimi' and use /login to authenticate.".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to install Kimi CLI: {stderr}"))
    }
}

/// Alternative: Install Kimi CLI via uv tool install
#[allow(dead_code)]
pub async fn install_kimi_cli_via_uv() -> Result<String, String> {
    log::info!("Installing Kimi CLI via uv");

    if !is_uv_installed() {
        return Err("uv is not installed. Please install uv first.".to_string());
    }

    let output = Command::new("uv")
        .args(["tool", "install", "--python", "3.13", "kimi-cli"])
        .output()
        .map_err(|e| format!("Failed to run uv tool install: {e}"))?;

    if output.status.success() {
        Ok("Kimi CLI installed successfully via uv. Run 'kimi' and use /login to authenticate.".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to install Kimi CLI: {stderr}"))
    }
}
