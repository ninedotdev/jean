//! Codex CLI Tauri commands
//!
//! Commands for checking, installing, and authenticating with the OpenAI Codex CLI.

use super::config::{
    ensure_cli_dir, get_codex_asset, get_codex_cli_path, get_embedded_cli_path, CODEX_RELEASES_API,
};
use crate::ai_cli::types::{AiCliAuthStatus, AiCliStatus};
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::Path;
use tar::Archive;
use tauri::{AppHandle, Emitter, Manager};

/// Information about a Codex CLI release
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexReleaseInfo {
    pub version: String,
    pub tag_name: String,
    pub published_at: String,
    pub prerelease: bool,
}

/// Progress event for installation
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexInstallProgress {
    pub stage: String,
    pub message: String,
    pub percent: u8,
}

/// GitHub release response
#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    #[allow(dead_code)]
    name: String,
    published_at: String,
    prerelease: bool,
    assets: Vec<GitHubAsset>,
}

/// GitHub asset response
#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

/// Emit installation progress event
fn emit_progress(app: &AppHandle, stage: &str, message: &str, percent: u8) {
    let progress = CodexInstallProgress {
        stage: stage.to_string(),
        message: message.to_string(),
        percent,
    };
    let _ = app.emit("codex-cli:install-progress", &progress);
    log::debug!("Codex install progress: {} - {} ({}%)", stage, message, percent);
}

/// Extract version number from tag name (e.g., "v0.1.0" -> "0.1.0")
fn extract_version_number(tag: &str) -> String {
    tag.trim_start_matches('v')
        .trim_start_matches("codex-")
        .to_string()
}

/// Check if Codex CLI is installed and get version info
#[tauri::command]
pub fn check_codex_cli_installed(app: AppHandle) -> AiCliStatus {
    log::trace!("Checking Codex CLI installation");

    match get_codex_cli_path(&app) {
        Ok(path) => {
            // Try to get version - use cli_command to handle .cmd files on Windows
            let version = crate::platform::cli_command(&path, &["--version"])
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

/// Check if Codex CLI is authenticated
///
/// Tries multiple methods:
/// 1. Check for OPENAI_API_KEY environment variable
/// 2. Check for config file with credentials
/// 3. Try running a simple command
#[tauri::command]
pub fn check_codex_cli_auth(app: AppHandle) -> AiCliAuthStatus {
    log::trace!("Checking Codex CLI authentication");

    let path = match get_codex_cli_path(&app) {
        Ok(p) => p,
        Err(e) => {
            return AiCliAuthStatus {
                authenticated: false,
                error: Some(format!("Codex CLI not installed: {e}")),
            }
        }
    };

    log::info!("Found Codex CLI at: {}", path.display());

    // Method 1: Check for OPENAI_API_KEY environment variable
    if std::env::var("OPENAI_API_KEY").is_ok() {
        log::info!("Found OPENAI_API_KEY environment variable");
        return AiCliAuthStatus {
            authenticated: true,
            error: None,
        };
    }

    // Method 2: Check for config file
    // Codex stores config in ~/.codex/ or similar
    if let Some(home) = dirs::home_dir() {
        let config_paths = [
            home.join(".codex/config.json"),
            home.join(".codex/auth.json"),
            home.join(".config/codex/config.json"),
        ];

        for config_path in &config_paths {
            if config_path.exists() {
                // Try to read and check if it contains credentials
                if let Ok(content) = std::fs::read_to_string(config_path) {
                    if content.contains("api_key") || content.contains("apiKey") || content.contains("token") {
                        log::info!("Found Codex credentials in config file: {}", config_path.display());
                        return AiCliAuthStatus {
                            authenticated: true,
                            error: None,
                        };
                    }
                }
            }
        }
    }

    // Method 3: Try running `codex auth` to see current status
    log::trace!("Trying 'codex auth' command");
    match crate::platform::cli_command(&path, &["auth"]).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let combined = format!("{} {}", stdout, stderr).to_lowercase();

            log::info!(
                "Codex auth result: exit_code={:?}, stdout='{}', stderr='{}'",
                output.status.code(),
                stdout.trim(),
                stderr.trim()
            );

            // Check for positive indicators
            if combined.contains("logged in")
                || combined.contains("authenticated")
                || combined.contains("api key")
                || (output.status.success() && !combined.contains("not logged"))
            {
                log::info!("Codex CLI appears to be authenticated");
                return AiCliAuthStatus {
                    authenticated: true,
                    error: None,
                };
            }
        }
        Err(e) => {
            log::warn!("Failed to run 'codex auth': {e}");
        }
    }

    // If we get here, authentication status is unknown or not authenticated
    log::info!("Codex CLI not authenticated (no credentials found)");
    AiCliAuthStatus {
        authenticated: false,
        error: Some("Not authenticated. Set OPENAI_API_KEY or run 'codex auth login'.".to_string()),
    }
}

/// Get available Codex CLI versions from GitHub releases
#[tauri::command]
pub async fn get_available_codex_versions() -> Result<Vec<CodexReleaseInfo>, String> {
    log::info!("Fetching available Codex CLI versions");

    let client = reqwest::Client::builder()
        .user_agent("Jean-App/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let url = format!("{CODEX_RELEASES_API}?per_page=50");
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API returned status: {}",
            response.status()
        ));
    }

    let releases: Vec<GitHubRelease> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse releases: {e}"))?;

    // Separate stable from prerelease
    let mut stable: Vec<CodexReleaseInfo> = Vec::new();
    let mut prerelease: Vec<CodexReleaseInfo> = Vec::new();

    for r in releases {
        let info = CodexReleaseInfo {
            version: extract_version_number(&r.tag_name),
            tag_name: r.tag_name,
            published_at: r.published_at,
            prerelease: r.prerelease,
        };

        if info.prerelease {
            prerelease.push(info);
        } else {
            stable.push(info);
        }
    }

    // Return top 5 stable + fill with prereleases if needed
    let mut versions: Vec<CodexReleaseInfo> = stable.into_iter().take(5).collect();
    if versions.len() < 5 {
        versions.extend(prerelease.into_iter().take(5 - versions.len()));
    }

    log::info!("Found {} Codex CLI versions", versions.len());
    Ok(versions)
}

/// Fetch a specific release from GitHub
async fn fetch_release(tag_name: &str) -> Result<GitHubRelease, String> {
    let client = reqwest::Client::builder()
        .user_agent("Jean-App/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let url = format!(
        "https://api.github.com/repos/openai/codex/releases/tags/{tag_name}"
    );
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API returned status: {}",
            response.status()
        ));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release: {e}"))
}

/// Fetch the latest stable release version
async fn fetch_latest_version() -> Result<String, String> {
    let versions = get_available_codex_versions().await?;
    versions
        .into_iter()
        .find(|v| !v.prerelease)
        .or_else(|| None)
        .map(|v| v.tag_name)
        .ok_or_else(|| "No releases found".to_string())
}

/// Extract tar.gz archive
fn extract_tar_gz(archive_content: &[u8], dest_dir: &Path) -> Result<(), String> {
    let cursor = Cursor::new(archive_content);
    let decoder = GzDecoder::new(cursor);
    let mut archive = Archive::new(decoder);

    archive
        .unpack(dest_dir)
        .map_err(|e| format!("Failed to extract archive: {e}"))?;

    Ok(())
}

/// Extract zip archive (Windows)
#[cfg(target_os = "windows")]
fn extract_zip(archive_content: &[u8], dest_dir: &Path) -> Result<(), String> {
    use zip::ZipArchive;

    let cursor = Cursor::new(archive_content);
    let mut archive =
        ZipArchive::new(cursor).map_err(|e| format!("Failed to read zip: {e}"))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {e}"))?;
        let outpath = dest_dir.join(file.name());

        if file.is_dir() {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create dir: {e}"))?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {e}"))?;
            }
            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {e}"))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to write file: {e}"))?;
        }
    }

    Ok(())
}

/// Install Codex CLI from GitHub releases
#[tauri::command]
pub async fn install_codex_cli(
    app: AppHandle,
    version: Option<String>,
) -> Result<String, String> {
    log::info!("Installing Codex CLI from GitHub releases");

    // Check no running sessions (would be problematic to replace binary)
    if !crate::chat::registry::get_running_sessions().is_empty() {
        return Err("Cannot install while chat sessions are running. Please stop all sessions first.".to_string());
    }

    emit_progress(&app, "starting", "Preparing installation...", 0);

    // Get version to install
    let tag_name = match version {
        Some(v) if !v.is_empty() => {
            if v.starts_with('v') {
                v
            } else {
                format!("v{v}")
            }
        }
        _ => {
            emit_progress(&app, "fetching_version", "Fetching latest version...", 5);
            fetch_latest_version().await?
        }
    };

    log::info!("Installing Codex CLI version: {tag_name}");

    // Get platform-specific asset info
    let (asset_name, binary_name) = get_codex_asset()?;
    log::debug!("Platform asset: {asset_name}, binary: {binary_name}");

    emit_progress(&app, "fetching_release", "Fetching release info...", 10);
    let release = fetch_release(&tag_name).await?;

    // Find the asset for this platform
    let asset = release
        .assets
        .iter()
        .find(|a| a.name == asset_name)
        .ok_or_else(|| {
            format!(
                "Asset '{asset_name}' not found in release {tag_name}. Available: {:?}",
                release.assets.iter().map(|a| &a.name).collect::<Vec<_>>()
            )
        })?;

    emit_progress(&app, "downloading", "Downloading Codex CLI...", 25);
    log::info!("Downloading from: {}", asset.browser_download_url);

    let client = reqwest::Client::builder()
        .user_agent("Jean-App/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(&asset.browser_download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let archive_content = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download: {e}"))?;

    log::info!("Downloaded {} bytes", archive_content.len());

    emit_progress(&app, "extracting", "Extracting archive...", 50);

    // Create temp directory for extraction
    let temp_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to get cache dir: {e}"))?
        .join("codex-install-temp");

    // Clean up any previous temp directory
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {e}"))?;

    // Extract based on archive type
    #[cfg(target_os = "windows")]
    {
        if asset_name.ends_with(".zip") {
            extract_zip(&archive_content, &temp_dir)?;
        } else {
            extract_tar_gz(&archive_content, &temp_dir)?;
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        extract_tar_gz(&archive_content, &temp_dir)?;
    }

    // Find the extracted binary
    let extracted_binary = temp_dir.join(binary_name);
    if !extracted_binary.exists() {
        // Try looking one level deeper (some archives have a subdirectory)
        let mut found = None;
        if let Ok(entries) = std::fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let nested = path.join(binary_name);
                    if nested.exists() {
                        found = Some(nested);
                        break;
                    }
                } else if path.file_name().map(|n| n.to_string_lossy().contains("codex")).unwrap_or(false) {
                    found = Some(path);
                    break;
                }
            }
        }

        if found.is_none() {
            // List what we found for debugging
            let contents: Vec<_> = std::fs::read_dir(&temp_dir)
                .map(|entries| {
                    entries
                        .flatten()
                        .map(|e| e.path().display().to_string())
                        .collect()
                })
                .unwrap_or_default();
            return Err(format!(
                "Binary '{binary_name}' not found after extraction. Contents: {:?}",
                contents
            ));
        }
    }

    let extracted_binary = if extracted_binary.exists() {
        extracted_binary
    } else {
        // Re-find using the nested logic
        let mut found_path = temp_dir.join(binary_name);
        if let Ok(entries) = std::fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let nested = path.join(binary_name);
                    if nested.exists() {
                        found_path = nested;
                        break;
                    }
                }
            }
        }
        found_path
    };

    emit_progress(&app, "installing", "Installing binary...", 70);

    // Ensure CLI directory exists
    let _cli_dir = ensure_cli_dir(&app)?;
    let binary_path = get_embedded_cli_path(&app)?;

    // Remove old binary if exists
    let _ = std::fs::remove_file(&binary_path);

    // Copy new binary
    std::fs::copy(&extracted_binary, &binary_path)
        .map_err(|e| format!("Failed to copy binary: {e}"))?;

    emit_progress(&app, "permissions", "Setting permissions...", 80);

    // Set executable permissions (Unix)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&binary_path)
            .map_err(|e| format!("Failed to get permissions: {e}"))?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&binary_path, perms)
            .map_err(|e| format!("Failed to set permissions: {e}"))?;
    }

    // Remove macOS quarantine attribute
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("xattr")
            .args(["-d", "com.apple.quarantine"])
            .arg(&binary_path)
            .output();
    }

    emit_progress(&app, "verifying", "Verifying installation...", 90);

    // Verify the binary works
    log::trace!("Verifying binary: {:?}", binary_path);
    let verify = crate::platform::cli_command(&binary_path, &["--version"])
        .output()
        .map_err(|e| format!("Failed to verify binary: {e}"))?;

    if !verify.status.success() {
        let stderr = String::from_utf8_lossy(&verify.stderr);
        return Err(format!("Binary verification failed: {stderr}"));
    }

    let version_str = String::from_utf8_lossy(&verify.stdout).trim().to_string();
    log::info!("Codex CLI installed successfully: {version_str}");

    // Cleanup temp directory
    let _ = std::fs::remove_dir_all(&temp_dir);

    emit_progress(&app, "complete", "Installation complete!", 100);

    Ok(format!("Codex CLI {version_str} installed successfully"))
}

/// Uninstall Codex CLI (only removes embedded version)
#[tauri::command]
pub async fn uninstall_codex_cli(app: AppHandle) -> Result<String, String> {
    log::info!("Uninstalling Codex CLI");

    let binary_path = get_embedded_cli_path(&app)?;

    if binary_path.exists() {
        std::fs::remove_file(&binary_path)
            .map_err(|e| format!("Failed to remove binary: {e}"))?;
        log::info!("Removed Codex CLI at: {}", binary_path.display());
        Ok("Codex CLI uninstalled successfully".to_string())
    } else {
        Ok("Codex CLI was not installed in app directory".to_string())
    }
}
