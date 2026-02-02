//! Kimi CLI configuration
//!
//! Path and configuration utilities for the Kimi Code CLI.

use std::path::PathBuf;

/// Get the path where Kimi CLI should be installed
/// Kimi CLI is installed via uv (Python package manager)
pub fn get_kimi_cli_path() -> Result<PathBuf, String> {
    // Kimi CLI binary name is `kimi`
    let binary_name = "kimi";

    #[cfg(target_os = "macos")]
    {
        // Check if installed and available in PATH
        if let Ok(output) = std::process::Command::new("which").arg(binary_name).output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }

        // Check common uv tool installation paths on macOS
        let home = dirs::home_dir().ok_or("Could not determine home directory")?;
        let paths = [
            home.join(".local/bin/kimi"),                      // Standard uv tool path
            home.join(".local/share/uv/tools/kimi-cli/bin/kimi"), // uv tool specific path
            PathBuf::from("/usr/local/bin/kimi"),
            PathBuf::from("/opt/homebrew/bin/kimi"),
        ];

        for path in &paths {
            if path.exists() {
                return Ok(path.clone());
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = std::process::Command::new("which").arg(binary_name).output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }

        let home = dirs::home_dir().ok_or("Could not determine home directory")?;
        let paths = [
            home.join(".local/bin/kimi"),
            home.join(".local/share/uv/tools/kimi-cli/bin/kimi"),
            PathBuf::from("/usr/local/bin/kimi"),
            PathBuf::from("/usr/bin/kimi"),
        ];

        for path in &paths {
            if path.exists() {
                return Ok(path.clone());
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("where")
            .arg(binary_name)
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }

        // Check Windows-specific paths
        if let Some(home) = dirs::home_dir() {
            let paths = [
                home.join("AppData\\Local\\uv\\tools\\kimi-cli\\bin\\kimi.exe"),
                home.join(".local\\bin\\kimi.exe"),
            ];

            for path in &paths {
                if path.exists() {
                    return Ok(path.clone());
                }
            }
        }
    }

    Err("Kimi CLI not found".to_string())
}

/// Get the Kimi CLI config directory
pub fn get_kimi_config_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".kimi"))
}

/// Check if uv is installed (required for Kimi CLI installation)
pub fn is_uv_installed() -> bool {
    std::process::Command::new("which")
        .arg("uv")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}
