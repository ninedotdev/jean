//! AI CLI types
//!
//! Common types for AI CLI provider abstraction.

use serde::{Deserialize, Serialize};

/// Available AI CLI providers
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AiCliProvider {
    /// Claude Code CLI (Anthropic)
    #[default]
    Claude,
    /// Gemini CLI (Google)
    Gemini,
    /// Codex CLI (OpenAI)
    Codex,
    /// Kimi Code CLI (Moonshot AI)
    Kimi,
}

#[allow(dead_code)]
impl AiCliProvider {
    /// Get the display name for the provider
    pub fn display_name(&self) -> &'static str {
        match self {
            AiCliProvider::Claude => "Claude (Anthropic)",
            AiCliProvider::Gemini => "Gemini (Google)",
            AiCliProvider::Codex => "Codex (OpenAI)",
            AiCliProvider::Kimi => "Kimi (Moonshot AI)",
        }
    }

    /// Get the CLI binary name
    pub fn binary_name(&self) -> &'static str {
        match self {
            AiCliProvider::Claude => "claude",
            AiCliProvider::Gemini => "gemini",
            AiCliProvider::Codex => "codex",
            AiCliProvider::Kimi => "kimi",
        }
    }

    /// Parse from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "claude" => Some(AiCliProvider::Claude),
            "gemini" => Some(AiCliProvider::Gemini),
            "codex" => Some(AiCliProvider::Codex),
            "kimi" => Some(AiCliProvider::Kimi),
            _ => None,
        }
    }
}

/// Status of an AI CLI installation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliStatus {
    /// Whether the CLI is installed
    pub installed: bool,
    /// Version string if installed
    pub version: Option<String>,
    /// Path to the CLI binary
    pub path: Option<String>,
}

/// Authentication status for an AI CLI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliAuthStatus {
    /// Whether the CLI is authenticated
    pub authenticated: bool,
    /// Error message if authentication check failed
    pub error: Option<String>,
}
