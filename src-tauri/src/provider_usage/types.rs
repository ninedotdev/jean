//! Types for multi-provider usage tracking

use serde::{Deserialize, Serialize};

/// Rate limit window information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RateWindow {
    /// Percentage of the rate limit used (0-100)
    pub used_percent: f64,
    /// Window duration in minutes (if known)
    pub window_minutes: Option<i32>,
    /// When the window resets
    pub resets_at: Option<String>,
    /// Human-readable reset description
    pub reset_description: Option<String>,
}

impl RateWindow {
    /// Get the remaining percentage
    #[allow(dead_code)]
    pub fn remaining_percent(&self) -> f64 {
        (100.0 - self.used_percent).max(0.0)
    }
}

/// Usage snapshot for a provider
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUsageSnapshot {
    /// Provider ID (claude, codex)
    pub provider_id: String,
    /// Primary rate window (usually session/5-hour)
    pub primary: Option<RateWindow>,
    /// Secondary rate window (usually weekly/daily)
    pub secondary: Option<RateWindow>,
    /// Account email if available
    pub account_email: Option<String>,
    /// Plan type if available
    pub plan_type: Option<String>,
    /// When this data was fetched
    pub updated_at: String,
    /// Whether data is available (credentials present, etc.)
    pub available: bool,
    /// Error message if fetch failed
    pub error: Option<String>,
}

/// All providers usage data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AllProvidersUsage {
    pub claude: Option<ProviderUsageSnapshot>,
    pub codex: Option<ProviderUsageSnapshot>,
}
