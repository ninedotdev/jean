//! Tauri commands for GitHub CLI management

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::config::{ensure_gh_cli_dir, get_gh_cli_binary_path};

/// GitHub API URL for releases
const GITHUB_RELEASES_API: &str = "https://api.github.com/repos/cli/cli/releases";

/// Status of the GitHub CLI installation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhCliStatus {
    /// Whether GitHub CLI is installed
    pub installed: bool,
    /// Installed version (if any)
    pub version: Option<String>,
    /// Path to the CLI binary (if installed)
    pub path: Option<String>,
}

/// Information about a GitHub CLI release
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhReleaseInfo {
    /// Version string (e.g., "2.40.0")
    pub version: String,
    /// Git tag name (e.g., "v2.40.0")
    pub tag_name: String,
    /// Publication date in ISO format
    pub published_at: String,
    /// Whether this is a prerelease
    pub prerelease: bool,
}

/// Progress event for CLI installation
#[derive(Debug, Clone, Serialize)]
pub struct GhInstallProgress {
    /// Current stage of installation
    pub stage: String,
    /// Progress message
    pub message: String,
    /// Percentage complete (0-100)
    pub percent: u8,
}

/// GitHub API release response structure
#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    published_at: String,
    prerelease: bool,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

/// Check if GitHub CLI is installed and get its status
#[tauri::command]
pub async fn check_gh_cli_installed(app: AppHandle) -> Result<GhCliStatus, String> {
    log::trace!("Checking GitHub CLI installation status");

    let binary_path = get_gh_cli_binary_path(&app)?;

    if !binary_path.exists() {
        log::trace!("GitHub CLI not found at {:?}", binary_path);
        return Ok(GhCliStatus {
            installed: false,
            version: None,
            path: None,
        });
    }

    // Try to get the version by running gh --version
    // Use cli_command to handle .cmd files on Windows
    let version = match crate::platform::cli_command(&binary_path, &["--version"]).output() {
        Ok(output) => {
            if output.status.success() {
                let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                // gh --version returns "gh version 2.40.0 (2024-01-15)"
                // Extract just the version number
                let version = version_str
                    .split_whitespace()
                    .nth(2)
                    .map(|s| s.to_string())
                    .unwrap_or(version_str);
                log::trace!("GitHub CLI version: {}", version);
                Some(version)
            } else {
                log::warn!("Failed to get GitHub CLI version");
                None
            }
        }
        Err(e) => {
            log::warn!("Failed to execute GitHub CLI: {}", e);
            None
        }
    };

    Ok(GhCliStatus {
        installed: true,
        version,
        path: Some(binary_path.to_string_lossy().to_string()),
    })
}

/// Get available GitHub CLI versions from GitHub releases API
#[tauri::command]
pub async fn get_available_gh_versions() -> Result<Vec<GhReleaseInfo>, String> {
    log::trace!("Fetching available GitHub CLI versions from GitHub API");

    let client = reqwest::Client::builder()
        .user_agent("Jean-App/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(GITHUB_RELEASES_API)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API returned status: {}", response.status()));
    }

    let releases: Vec<GitHubRelease> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub API response: {e}"))?;

    // Convert to our format, filtering to releases with assets for our platform
    let versions: Vec<GhReleaseInfo> = releases
        .into_iter()
        .filter(|r| !r.assets.is_empty())
        .take(5) // Only take 5 most recent
        .map(|r| {
            // Remove 'v' prefix from tag_name for version
            let version = r
                .tag_name
                .strip_prefix('v')
                .unwrap_or(&r.tag_name)
                .to_string();
            GhReleaseInfo {
                version,
                tag_name: r.tag_name,
                published_at: r.published_at,
                prerelease: r.prerelease,
            }
        })
        .collect();

    log::trace!("Found {} GitHub CLI versions", versions.len());
    Ok(versions)
}

/// Get the platform string for the current system (for gh releases)
fn get_gh_platform() -> Result<(&'static str, &'static str), String> {
    // Returns (platform_string, archive_extension)
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        return Ok(("macOS_arm64", "zip"));
    }

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        return Ok(("macOS_amd64", "zip"));
    }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        return Ok(("linux_amd64", "tar.gz"));
    }

    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        return Ok(("linux_arm64", "tar.gz"));
    }

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        return Ok(("windows_amd64", "zip"));
    }

    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    {
        return Ok(("windows_arm64", "zip"));
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform".to_string())
}

/// Install GitHub CLI by downloading from GitHub releases
#[tauri::command]
pub async fn install_gh_cli(app: AppHandle, version: Option<String>) -> Result<(), String> {
    log::trace!("Installing GitHub CLI, version: {:?}", version);

    // Check if any Claude processes are running - Claude may use gh for GitHub operations
    let running_sessions = crate::chat::registry::get_running_sessions();
    if !running_sessions.is_empty() {
        let count = running_sessions.len();
        return Err(format!(
            "Cannot install GitHub CLI while {} Claude {} running. Please stop all active sessions first.",
            count,
            if count == 1 { "session is" } else { "sessions are" }
        ));
    }

    let cli_dir = ensure_gh_cli_dir(&app)?;
    let binary_path = get_gh_cli_binary_path(&app)?;

    // Emit progress: starting
    emit_progress(&app, "starting", "Preparing installation...", 0);

    // Determine version (use provided or fetch latest)
    let version = match version {
        Some(v) => v,
        None => fetch_latest_gh_version().await?,
    };

    // Detect platform
    let (platform, archive_ext) = get_gh_platform()?;
    log::trace!("Installing version {version} for platform {platform}");

    // Build download URL
    // Format: https://github.com/cli/cli/releases/download/v{version}/gh_{version}_{platform}.{ext}
    let archive_name = format!("gh_{version}_{platform}.{archive_ext}");
    let download_url =
        format!("https://github.com/cli/cli/releases/download/v{version}/{archive_name}");
    log::trace!("Downloading from: {download_url}");

    // Emit progress: downloading
    emit_progress(&app, "downloading", "Downloading GitHub CLI...", 20);

    // Download the archive
    let client = reqwest::Client::builder()
        .user_agent("Jean-App/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download GitHub CLI: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download GitHub CLI: HTTP {}",
            response.status()
        ));
    }

    let archive_content = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read archive content: {e}"))?;

    log::trace!("Downloaded {} bytes", archive_content.len());

    // Emit progress: extracting
    emit_progress(&app, "extracting", "Extracting archive...", 40);

    // Create temp directory for extraction
    let temp_dir = cli_dir.join("temp");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {e}"))?;

    // Extract the archive
    let extracted_binary_path = if archive_ext == "zip" {
        extract_zip(&archive_content, &temp_dir, &version, platform)?
    } else {
        extract_tar_gz(&archive_content, &temp_dir, &version, platform)?
    };

    // Emit progress: installing
    emit_progress(&app, "installing", "Installing GitHub CLI...", 60);

    // Move binary to final location
    std::fs::copy(&extracted_binary_path, &binary_path)
        .map_err(|e| format!("Failed to copy binary: {e}"))?;

    // Clean up temp directory
    let _ = std::fs::remove_dir_all(&temp_dir);

    // Emit progress: verifying
    emit_progress(&app, "verifying", "Verifying installation...", 80);

    // Make sure the binary is executable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&binary_path)
            .map_err(|e| format!("Failed to get binary metadata: {e}"))?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&binary_path, perms)
            .map_err(|e| format!("Failed to set binary permissions: {e}"))?;
    }

    // Verify the binary works
    log::trace!("Verifying binary: {:?}", binary_path);
    let version_output = crate::platform::cli_command(&binary_path, &["--version"])
        .output()
        .map_err(|e| format!("Failed to verify GitHub CLI: {e}"))?;

    if !version_output.status.success() {
        let stderr = String::from_utf8_lossy(&version_output.stderr);
        let stdout = String::from_utf8_lossy(&version_output.stdout);
        log::error!(
            "GitHub CLI verification failed - exit code: {:?}, stdout: {}, stderr: {}",
            version_output.status.code(),
            stdout,
            stderr
        );
        return Err(format!(
            "GitHub CLI binary verification failed: {}",
            if !stderr.is_empty() {
                stderr.to_string()
            } else {
                "Unknown error".to_string()
            }
        ));
    }

    let installed_version = String::from_utf8_lossy(&version_output.stdout)
        .trim()
        .to_string();
    log::trace!("Verified GitHub CLI version: {installed_version}");

    // Emit progress: complete
    emit_progress(&app, "complete", "Installation complete!", 100);

    log::trace!("GitHub CLI installed successfully at {:?}", binary_path);
    Ok(())
}

/// Fetch the latest GitHub CLI version from GitHub API
async fn fetch_latest_gh_version() -> Result<String, String> {
    log::trace!("Fetching latest GitHub CLI version");

    let client = reqwest::Client::builder()
        .user_agent("Jean-App/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(format!("{GITHUB_RELEASES_API}/latest"))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch latest release: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch latest release: HTTP {}",
            response.status()
        ));
    }

    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release info: {e}"))?;

    let version = release
        .tag_name
        .strip_prefix('v')
        .unwrap_or(&release.tag_name)
        .to_string();
    log::trace!("Latest GitHub CLI version: {version}");
    Ok(version)
}

/// Extract gh binary from a zip archive (macOS, Windows)
fn extract_zip(
    archive_content: &[u8],
    temp_dir: &std::path::Path,
    version: &str,
    platform: &str,
) -> Result<std::path::PathBuf, String> {
    use std::io::Cursor;

    let cursor = Cursor::new(archive_content);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("Failed to open zip archive: {e}"))?;

    #[cfg(not(target_os = "windows"))]
    let binary_name = "gh";
    #[cfg(target_os = "windows")]
    let binary_name = "gh.exe";

    let mut found_binary_path: Option<std::path::PathBuf> = None;

    // Extract all files and track the binary location
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {e}"))?;

        let outpath = match file.enclosed_name() {
            Some(path) => temp_dir.join(path),
            None => continue,
        };

        if file.is_dir() {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {e}"))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(p)
                        .map_err(|e| format!("Failed to create parent directory: {e}"))?;
                }
            }
            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {e}"))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {e}"))?;

            // Check if this is the binary we're looking for
            if outpath.file_name().map(|n| n == binary_name).unwrap_or(false) {
                // Prefer bin/gh over other locations
                if outpath.parent().map(|p| p.ends_with("bin")).unwrap_or(false) {
                    found_binary_path = Some(outpath.clone());
                } else if found_binary_path.is_none() {
                    found_binary_path = Some(outpath.clone());
                }
            }
        }
    }

    // If we found the binary during extraction, return it
    if let Some(path) = found_binary_path {
        log::trace!("Found binary at: {:?}", path);
        return Ok(path);
    }

    // Fallback: try the expected path structure
    let binary_path = temp_dir
        .join(format!("gh_{version}_{platform}"))
        .join("bin")
        .join(binary_name);

    if binary_path.exists() {
        return Ok(binary_path);
    }

    // Try alternative structure without underscore
    let binary_path_alt = temp_dir
        .join(format!("gh-{version}-{platform}"))
        .join("bin")
        .join(binary_name);

    if binary_path_alt.exists() {
        return Ok(binary_path_alt);
    }

    Err(format!(
        "Binary '{}' not found in archive. Searched in temp_dir: {:?}",
        binary_name, temp_dir
    ))
}

/// Extract gh binary from a tar.gz archive (Linux)
fn extract_tar_gz(
    archive_content: &[u8],
    temp_dir: &std::path::Path,
    version: &str,
    platform: &str,
) -> Result<std::path::PathBuf, String> {
    use flate2::read::GzDecoder;
    use std::io::Cursor;
    use tar::Archive;

    let cursor = Cursor::new(archive_content);
    let decoder = GzDecoder::new(cursor);
    let mut archive = Archive::new(decoder);

    archive
        .unpack(temp_dir)
        .map_err(|e| format!("Failed to extract tar.gz archive: {e}"))?;

    // The binary is at gh_{version}_{platform}/bin/gh
    let binary_path = temp_dir
        .join(format!("gh_{version}_{platform}"))
        .join("bin")
        .join("gh");

    if !binary_path.exists() {
        return Err(format!("Binary not found in archive at {:?}", binary_path));
    }

    Ok(binary_path)
}

/// Result of checking GitHub CLI authentication status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhAuthStatus {
    /// Whether the CLI is authenticated
    pub authenticated: bool,
    /// Error message if authentication check failed
    pub error: Option<String>,
}

/// Check if GitHub CLI is authenticated by running `gh auth status`
#[tauri::command]
pub async fn check_gh_cli_auth(app: AppHandle) -> Result<GhAuthStatus, String> {
    log::trace!("Checking GitHub CLI authentication status");

    let binary_path = get_gh_cli_binary_path(&app)?;

    if !binary_path.exists() {
        return Ok(GhAuthStatus {
            authenticated: false,
            error: Some("GitHub CLI not installed".to_string()),
        });
    }

    // Run gh auth status to check authentication
    // Use cli_command to handle .cmd files on Windows
    log::trace!("Running auth check for: {:?}", binary_path);

    let output = crate::platform::cli_command(&binary_path, &["auth", "status"])
        .output()
        .map_err(|e| format!("Failed to execute GitHub CLI: {e}"))?;

    // gh auth status returns exit code 0 if authenticated, non-zero otherwise
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        log::trace!("GitHub CLI auth check successful: {}", stdout);
        Ok(GhAuthStatus {
            authenticated: true,
            error: None,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log::warn!("GitHub CLI auth check failed: {}", stderr);
        Ok(GhAuthStatus {
            authenticated: false,
            error: Some(stderr),
        })
    }
}

/// Helper function to emit installation progress events
fn emit_progress(app: &AppHandle, stage: &str, message: &str, percent: u8) {
    let progress = GhInstallProgress {
        stage: stage.to_string(),
        message: message.to_string(),
        percent,
    };

    if let Err(e) = app.emit("gh-cli:install-progress", &progress) {
        log::warn!("Failed to emit install progress: {}", e);
    }
}

// =============================================================================
// GitHub Repository Listing Commands
// =============================================================================

use crate::projects::types::RemoteRepository;

/// GitHub API response for repository listing
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GhRepoListItem {
    name: String,
    #[serde(rename = "nameWithOwner")]
    name_with_owner: String,
    description: Option<String>,
    url: String,
    ssh_url: String,
    #[serde(rename = "isPrivate")]
    is_private: bool,
    #[serde(rename = "isFork")]
    is_fork: bool,
    #[serde(rename = "defaultBranchRef")]
    default_branch_ref: Option<GhDefaultBranch>,
    #[serde(rename = "updatedAt")]
    updated_at: String,
    #[serde(rename = "primaryLanguage")]
    primary_language: Option<GhLanguage>,
    #[serde(rename = "stargazerCount")]
    stargazer_count: u32,
}

#[derive(Debug, Deserialize)]
struct GhDefaultBranch {
    name: String,
}

#[derive(Debug, Deserialize)]
struct GhLanguage {
    name: String,
}

/// List repositories for the authenticated GitHub user or a specific owner/org
#[tauri::command]
pub async fn list_github_repos(
    app: AppHandle,
    owner: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<RemoteRepository>, String> {
    log::trace!(
        "Listing GitHub repositories for owner: {:?}, limit: {:?}",
        owner,
        limit
    );

    let binary_path = get_gh_cli_binary_path(&app)?;

    if !binary_path.exists() {
        return Err("GitHub CLI not installed".to_string());
    }

    let limit = limit.unwrap_or(100);
    let json_fields = "name,nameWithOwner,description,url,sshUrl,isPrivate,isFork,defaultBranchRef,updatedAt,primaryLanguage,stargazerCount";

    // Build command args
    let limit_str = limit.to_string();
    let mut args: Vec<&str> = vec!["repo", "list"];

    // Add owner if specified
    if let Some(ref o) = owner {
        args.push(o.as_str());
    }

    args.extend(["--json", json_fields, "--limit", &limit_str]);

    log::trace!("Running gh with args: {:?}", args);

    let output = crate::platform::cli_command(&binary_path, &args)
        .output()
        .map_err(|e| format!("Failed to execute gh command: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log::warn!("gh repo list failed: {}", stderr);

        if stderr.contains("auth login") || stderr.contains("authentication") {
            return Err("GitHub CLI not authenticated. Run 'gh auth login' first.".to_string());
        }

        return Err(format!("Failed to list repositories: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let repos: Vec<GhRepoListItem> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse gh output: {e}"))?;

    // Convert to RemoteRepository
    let remote_repos: Vec<RemoteRepository> = repos
        .into_iter()
        .map(|r| {
            // Convert HTTPS URL to proper clone URL
            let clone_url = if r.url.ends_with(".git") {
                r.url.clone()
            } else {
                format!("{}.git", r.url)
            };

            RemoteRepository {
                name: r.name,
                full_name: r.name_with_owner,
                description: r.description,
                clone_url,
                ssh_url: r.ssh_url,
                is_private: r.is_private,
                is_fork: r.is_fork,
                default_branch: r.default_branch_ref.map(|b| b.name).unwrap_or_else(|| "main".to_string()),
                updated_at: r.updated_at,
                language: r.primary_language.map(|l| l.name),
                stars_count: r.stargazer_count,
                provider: "github".to_string(),
            }
        })
        .collect();

    log::trace!("Found {} GitHub repositories", remote_repos.len());
    Ok(remote_repos)
}
