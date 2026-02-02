use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::chat::storage::{load_metadata, load_sessions};
use crate::chat::types::UsageData;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageOverview {
    pub providers: Vec<ProviderUsageSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUsageSummary {
    pub provider: String,
    pub display_name: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_usage: Option<UsageData>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate_limit_5h: Option<RateLimitWindow>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate_limit_7d: Option<RateLimitWindow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitWindow {
    pub used_percent: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reset_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub window_hours: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delta_percent: Option<f64>,
}

#[derive(Debug, Clone)]
struct SessionUsageSummary {
    provider: String,
    model: Option<String>,
    usage: Option<UsageData>,
}

fn total_usage_from_session(app: &AppHandle, session_id: &str) -> Result<Option<UsageData>, String> {
    let metadata = load_metadata(app, session_id)?;
    let Some(metadata) = metadata else {
        return Ok(None);
    };

    let total_usage = metadata
        .runs
        .iter()
        .filter_map(|run| run.usage.as_ref())
        .fold(UsageData::default(), |mut acc, usage| {
            acc.input_tokens += usage.input_tokens;
            acc.output_tokens += usage.output_tokens;
            acc.cache_read_input_tokens += usage.cache_read_input_tokens;
            acc.cache_creation_input_tokens += usage.cache_creation_input_tokens;
            acc
        });

    Ok(Some(total_usage))
}

fn load_session_usage(
    app: &AppHandle,
    worktree_id: &str,
    worktree_path: &str,
    session_id: &str,
) -> Result<Option<SessionUsageSummary>, String> {
    let sessions = load_sessions(app, worktree_path, worktree_id)?;
    let session = match sessions.find_session(session_id) {
        Some(session) => session,
        None => return Ok(None),
    };

    let provider = session
        .selected_provider
        .clone()
        .unwrap_or_else(|| "claude".to_string());
    let model = session.selected_model.clone();
    let usage = total_usage_from_session(app, session_id)?;

    Ok(Some(SessionUsageSummary {
        provider,
        model,
        usage,
    }))
}

#[tauri::command]
pub async fn get_usage_overview(
    app: AppHandle,
    worktree_id: Option<String>,
    worktree_path: Option<String>,
    session_id: Option<String>,
) -> Result<UsageOverview, String> {
    let session_summary = match (worktree_id.as_deref(), worktree_path.as_deref(), session_id.as_deref()) {
        (Some(worktree_id), Some(worktree_path), Some(session_id)) => {
            load_session_usage(&app, worktree_id, worktree_path, session_id)?
        }
        _ => None,
    };

    let provider_usage = |provider: &str| -> ProviderUsageSummary {
        let (session_model, session_usage) = match session_summary.as_ref() {
            Some(summary) if summary.provider == provider => (summary.model.clone(), summary.usage.clone()),
            _ => (None, None),
        };

        let (status, message) = match provider {
            "claude" => ("ok".to_string(), None),
            "codex" => (
                "unavailable".to_string(),
                Some("Usage API not configured for Codex yet".to_string()),
            ),
            _ => ("unavailable".to_string(), Some("Unknown provider".to_string())),
        };

        ProviderUsageSummary {
            provider: provider.to_string(),
            display_name: match provider {
                "claude" => "Claude".to_string(),
                "codex" => "Codex".to_string(),
                _ => provider.to_string(),
            },
            status,
            message,
            session_model,
            session_usage,
            rate_limit_5h: None,
            rate_limit_7d: None,
        }
    };

    Ok(UsageOverview {
        providers: vec![
            provider_usage("claude"),
            provider_usage("codex"),
        ],
    })
}
