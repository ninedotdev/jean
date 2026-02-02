//! Codex usage fetcher
//!
//! Fetches usage data from OpenAI Codex CLI using RPC or session logs.
//! The Codex CLI stores credentials in ~/.codex/auth.json

use chrono::Utc;
use serde::Deserialize;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::time::Duration;

use super::types::{ProviderUsageSnapshot, RateWindow};

/// Auth file structure from ~/.codex/auth.json
#[derive(Debug, Deserialize)]
struct AuthFile {
    tokens: Option<Tokens>,
}

#[derive(Debug, Deserialize)]
struct Tokens {
    #[serde(rename = "idToken")]
    id_token: Option<String>,
}

/// RPC response for rate limits
#[derive(Debug, Deserialize)]
struct RpcRateLimitsResponse {
    result: Option<RateLimitsResult>,
}

#[derive(Debug, Deserialize)]
struct RateLimitsResult {
    #[serde(rename = "rateLimits")]
    rate_limits: Option<RateLimitSnapshot>,
}

#[derive(Debug, Deserialize)]
struct RateLimitSnapshot {
    primary: Option<RpcWindow>,
    secondary: Option<RpcWindow>,
    #[allow(dead_code)]
    credits: Option<RpcCredits>,
}

#[derive(Debug, Deserialize)]
struct RpcWindow {
    #[serde(rename = "usedPercent")]
    used_percent: f64,
    #[serde(rename = "windowDurationMins")]
    window_duration_mins: Option<i32>,
    #[serde(rename = "resetsAt")]
    resets_at: Option<i64>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct RpcCredits {
    #[serde(rename = "hasCredits")]
    has_credits: Option<bool>,
    unlimited: Option<bool>,
    balance: Option<String>,
}

/// RPC response for account info
#[derive(Debug, Deserialize)]
struct RpcAccountResponse {
    result: Option<AccountResult>,
}

#[derive(Debug, Deserialize)]
struct AccountResult {
    account: Option<AccountDetails>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum AccountDetails {
    #[serde(rename = "chatgpt")]
    ChatGPT { email: Option<String>, #[serde(rename = "planType")] plan_type: Option<String> },
    #[serde(rename = "apikey")]
    ApiKey,
}

/// Fetch Codex usage data
pub async fn fetch_codex_usage() -> ProviderUsageSnapshot {
    let now = Utc::now();

    match fetch_codex_usage_inner().await {
        Ok(snapshot) => snapshot,
        Err(e) => ProviderUsageSnapshot {
            provider_id: "codex".to_string(),
            available: false,
            error: Some(e),
            updated_at: now.to_rfc3339(),
            ..Default::default()
        },
    }
}

async fn fetch_codex_usage_inner() -> Result<ProviderUsageSnapshot, String> {
    let now = Utc::now();

    // Try RPC approach first
    match fetch_via_rpc().await {
        Ok(snapshot) => return Ok(snapshot),
        Err(e) => {
            log::debug!("Codex RPC failed, will return error: {e}");
        }
    }

    // If RPC fails, check if auth exists at least
    let (email, plan) = get_account_info();

    if email.is_none() && plan.is_none() {
        return Err("Codex CLI not logged in".to_string());
    }

    // We have auth but couldn't fetch usage - return partial data
    Ok(ProviderUsageSnapshot {
        provider_id: "codex".to_string(),
        primary: None,
        secondary: None,
        account_email: email,
        plan_type: plan,
        updated_at: now.to_rfc3339(),
        available: false,
        error: Some("Could not fetch usage data. Run a Codex command first.".to_string()),
    })
}

async fn fetch_via_rpc() -> Result<ProviderUsageSnapshot, String> {
    let now = Utc::now();

    // Find codex binary
    let codex_path = which::which("codex")
        .map_err(|_| "Codex CLI not installed")?;

    // Start codex app-server process
    let mut child = Command::new(&codex_path)
        .args(["-s", "read-only", "-a", "untrusted", "app-server"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start Codex: {e}"))?;

    let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;

    // Wrap in async task with timeout
    let result = tokio::time::timeout(
        Duration::from_secs(10),
        tokio::task::spawn_blocking(move || {
            rpc_communication(stdin, stdout)
        }),
    )
    .await;

    // Kill child process
    let _ = child.kill();

    let (limits, account) = result
        .map_err(|_| "RPC timeout".to_string())?
        .map_err(|e| format!("RPC task error: {e}"))??;

    // Extract account info
    let (email, plan) = match account {
        Some(AccountDetails::ChatGPT { email, plan_type }) => (email, plan_type),
        _ => (None, None),
    };

    // Build rate windows
    let primary = limits.primary.map(|w| RateWindow {
        used_percent: w.used_percent,
        window_minutes: w.window_duration_mins,
        resets_at: w.resets_at.map(|ts| {
            chrono::DateTime::from_timestamp(ts, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default()
        }),
        reset_description: w.resets_at.and_then(|ts| {
            chrono::DateTime::from_timestamp(ts, 0).map(|dt| format_reset_time(&dt))
        }),
    });

    let secondary = limits.secondary.map(|w| RateWindow {
        used_percent: w.used_percent,
        window_minutes: w.window_duration_mins,
        resets_at: w.resets_at.map(|ts| {
            chrono::DateTime::from_timestamp(ts, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default()
        }),
        reset_description: w.resets_at.and_then(|ts| {
            chrono::DateTime::from_timestamp(ts, 0).map(|dt| format_reset_time(&dt))
        }),
    });

    let is_available = primary.is_some() || secondary.is_some();

    Ok(ProviderUsageSnapshot {
        provider_id: "codex".to_string(),
        primary,
        secondary,
        account_email: email,
        plan_type: plan,
        updated_at: now.to_rfc3339(),
        available: is_available,
        error: None,
    })
}

fn rpc_communication(
    mut stdin: std::process::ChildStdin,
    stdout: std::process::ChildStdout,
) -> Result<(RateLimitSnapshot, Option<AccountDetails>), String> {
    let mut reader = BufReader::new(stdout);

    // Send initialize request
    let init_req = r#"{"id":1,"method":"initialize","params":{"clientInfo":{"name":"jean","version":"1.0"}}}"#;
    writeln!(stdin, "{init_req}").map_err(|e| format!("Write error: {e}"))?;

    // Read until we get a response with id: 1
    let mut line = String::new();
    loop {
        line.clear();
        if reader.read_line(&mut line).map_err(|e| format!("Read error: {e}"))? == 0 {
            return Err("EOF while waiting for initialize response".to_string());
        }
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
            if json.get("id") == Some(&serde_json::json!(1)) {
                break;
            }
        }
    }

    // Send initialized notification
    let initialized = r#"{"method":"initialized","params":{}}"#;
    writeln!(stdin, "{initialized}").map_err(|e| format!("Write error: {e}"))?;

    // Request rate limits
    let limits_req = r#"{"id":2,"method":"account/rateLimits/read","params":{}}"#;
    writeln!(stdin, "{limits_req}").map_err(|e| format!("Write error: {e}"))?;

    // Read rate limits response
    let limits: RateLimitSnapshot = loop {
        line.clear();
        if reader.read_line(&mut line).map_err(|e| format!("Read error: {e}"))? == 0 {
            return Err("EOF while waiting for rate limits".to_string());
        }
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
            if json.get("id") == Some(&serde_json::json!(2)) {
                let response: RpcRateLimitsResponse = serde_json::from_str(&line)
                    .map_err(|e| format!("Parse error: {e}"))?;
                break response
                    .result
                    .and_then(|r| r.rate_limits)
                    .ok_or("No rate limits in response")?;
            }
        }
    };

    // Request account info
    let account_req = r#"{"id":3,"method":"account/read","params":{}}"#;
    writeln!(stdin, "{account_req}").map_err(|e| format!("Write error: {e}"))?;

    // Read account response (optional, don't fail if it errors)
    let account: Option<AccountDetails> = loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break None,
            Err(_) => break None,
            Ok(_) => {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                    if json.get("id") == Some(&serde_json::json!(3)) {
                        if let Ok(response) = serde_json::from_str::<RpcAccountResponse>(&line) {
                            break response.result.and_then(|r| r.account);
                        }
                        break None;
                    }
                }
            }
        }
    };

    Ok((limits, account))
}

fn get_account_info() -> (Option<String>, Option<String>) {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return (None, None),
    };

    let auth_path = home.join(".codex").join("auth.json");
    if !auth_path.exists() {
        return (None, None);
    }

    let content = match fs::read_to_string(&auth_path) {
        Ok(c) => c,
        Err(_) => return (None, None),
    };

    let auth: AuthFile = match serde_json::from_str(&content) {
        Ok(a) => a,
        Err(_) => return (None, None),
    };

    let id_token = match auth.tokens.and_then(|t| t.id_token) {
        Some(t) => t,
        None => return (None, None),
    };

    // Parse JWT to extract email and plan
    parse_jwt_claims(&id_token)
}

fn parse_jwt_claims(token: &str) -> (Option<String>, Option<String>) {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() < 2 {
        return (None, None);
    }

    let mut payload = parts[1].replace('-', "+").replace('_', "/");
    while payload.len() % 4 != 0 {
        payload.push('=');
    }

    let decoded = match base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &payload) {
        Ok(d) => d,
        Err(_) => return (None, None),
    };

    let json: serde_json::Value = match serde_json::from_slice(&decoded) {
        Ok(j) => j,
        Err(_) => return (None, None),
    };

    let email = json.get("email")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let plan = json
        .get("https://api.openai.com/auth")
        .and_then(|a| a.get("chatgpt_plan_type"))
        .or_else(|| json.get("chatgpt_plan_type"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    (email, plan)
}

fn format_reset_time(dt: &chrono::DateTime<Utc>) -> String {
    let now = Utc::now();
    let diff = *dt - now;

    if diff.num_seconds() <= 0 {
        return "Resets soon".to_string();
    }

    let hours = diff.num_hours();
    let minutes = (diff.num_minutes() % 60).abs();

    if hours > 0 {
        format!("Resets in {hours}h {minutes}m")
    } else {
        format!("Resets in {minutes}m")
    }
}
