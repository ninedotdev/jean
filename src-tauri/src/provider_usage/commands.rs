//! Tauri commands for multi-provider usage tracking

use super::codex::fetch_codex_usage;
use super::types::{AllProvidersUsage, ProviderUsageSnapshot, RateWindow};
use crate::claude_usage::api::fetch_usage_limits as fetch_claude_limits;
use crate::claude_usage::credentials::has_oauth_credentials;
use chrono::Utc;

/// Get usage for a specific provider
#[tauri::command]
pub async fn get_provider_usage(provider: String) -> Result<ProviderUsageSnapshot, String> {
    match provider.as_str() {
        "claude" => Ok(fetch_claude_usage().await),
        "codex" => Ok(fetch_codex_usage().await),
        _ => Err(format!("Unknown provider: {provider}")),
    }
}

/// Get usage for all providers
#[tauri::command]
pub async fn get_all_providers_usage() -> AllProvidersUsage {
    // Fetch all providers sequentially (simpler, avoids tokio::join! issues)
    let claude = fetch_claude_usage().await;
    let codex = fetch_codex_usage().await;

    AllProvidersUsage {
        claude: Some(claude),
        codex: Some(codex),
    }
}

/// Fetch Claude usage and convert to ProviderUsageSnapshot format
async fn fetch_claude_usage() -> ProviderUsageSnapshot {
    let now = Utc::now();

    // Check if credentials exist
    if !has_oauth_credentials().await {
        return ProviderUsageSnapshot {
            provider_id: "claude".to_string(),
            available: false,
            error: Some("Not logged in".to_string()),
            updated_at: now.to_rfc3339(),
            ..Default::default()
        };
    }

    // Fetch limits using existing API
    match fetch_claude_limits().await {
        Ok(limits) => {
            let primary = limits.five_hour.as_ref().map(|l| RateWindow {
                used_percent: l.utilization,
                window_minutes: Some(300), // 5 hours
                resets_at: l.resets_at.clone(),
                reset_description: l.resets_at.as_ref().map(|r| format_reset_time(r)),
            });

            let secondary = limits.seven_day.as_ref().map(|l| RateWindow {
                used_percent: l.utilization,
                window_minutes: Some(10080), // 7 days
                resets_at: l.resets_at.clone(),
                reset_description: l.resets_at.as_ref().map(|r| format_reset_time(r)),
            });

            ProviderUsageSnapshot {
                provider_id: "claude".to_string(),
                primary,
                secondary,
                account_email: None, // Could be extracted from OAuth if needed
                plan_type: None,
                updated_at: now.to_rfc3339(),
                available: true,
                error: None,
            }
        }
        Err(e) => ProviderUsageSnapshot {
            provider_id: "claude".to_string(),
            available: false,
            error: Some(e),
            updated_at: now.to_rfc3339(),
            ..Default::default()
        },
    }
}

fn format_reset_time(iso_string: &str) -> String {
    if let Ok(reset_date) = chrono::DateTime::parse_from_rfc3339(iso_string) {
        let now = Utc::now();
        let diff = reset_date.signed_duration_since(now);

        if diff.num_seconds() <= 0 {
            return "Resets soon".to_string();
        }

        let hours = diff.num_hours();
        let minutes = (diff.num_minutes() % 60).abs();

        if hours > 0 {
            format!("{hours}h {minutes}m")
        } else {
            format!("{minutes}m")
        }
    } else {
        "Unknown".to_string()
    }
}
