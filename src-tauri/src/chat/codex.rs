//! Codex CLI execution module
//!
//! Handles executing OpenAI Codex CLI for chat messages with streaming support.
//! Uses detached process execution + JSONL tailing for robustness.

use crate::ai_cli::codex::config::get_codex_cli_path;
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};
use tauri::Emitter;

use super::claude::{ChunkEvent, ClaudeResponse, ErrorEvent, ThinkingEvent, ToolResultEvent, ToolUseEvent};
use super::detached::{is_process_alive, spawn_detached_codex};
use super::tail::{NdjsonTailer, POLL_INTERVAL};

/// Timeout for waiting for first output from Codex
const STARTUP_TIMEOUT: Duration = Duration::from_secs(120);

/// Timeout after process dies to wait for final output
const DEAD_PROCESS_GRACE_PERIOD: Duration = Duration::from_secs(2);

/// Get Codex sandbox and approval flags based on execution mode
fn get_codex_sandbox_args(execution_mode: Option<&str>) -> Vec<&'static str> {
    match execution_mode {
        Some("build") => vec!["--sandbox", "workspace-write"],
        Some("plan") => vec!["--sandbox", "read-only"],
        _ => vec!["--full-auto"], // yolo or default
    }
}

/// Map thinking level to Codex reasoning effort
fn get_codex_reasoning_effort(thinking_level: Option<&str>) -> &'static str {
    match thinking_level {
        Some("off") => "low",
        Some("think") => "medium",
        Some("megathink") => "high",
        Some("ultrathink") => "xhigh",
        _ => "medium",
    }
}

/// Process a single Codex JSONL event and emit appropriate frontend events
fn process_codex_event(
    app: &tauri::AppHandle,
    session_id: &str,
    worktree_id: &str,
    line: &str,
    full_content: &mut String,
) -> Option<bool> {
    // Skip empty lines
    if line.trim().is_empty() {
        return None;
    }

    // Try to parse as JSON
    let msg: serde_json::Value = match serde_json::from_str(line) {
        Ok(m) => m,
        Err(_) => {
            // Not JSON, treat as plain text content
            full_content.push_str(line);
            full_content.push('\n');
            let _ = app.emit(
                "chat:chunk",
                ChunkEvent {
                    session_id: session_id.to_string(),
                    worktree_id: worktree_id.to_string(),
                    content: format!("{line}\n"),
                },
            );
            return None;
        }
    };

    let event_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match event_type {
        "item.completed" => {
            if let Some(item) = msg.get("item") {
                let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");

                match item_type {
                    "agent_message" => {
                        if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                            if !text.is_empty() {
                                full_content.push_str(text);
                                full_content.push('\n');
                                let _ = app.emit(
                                    "chat:chunk",
                                    ChunkEvent {
                                        session_id: session_id.to_string(),
                                        worktree_id: worktree_id.to_string(),
                                        content: format!("{text}\n"),
                                    },
                                );
                            }
                        }
                    }
                    "reasoning" => {
                        if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                            let _ = app.emit(
                                "chat:thinking",
                                ThinkingEvent {
                                    session_id: session_id.to_string(),
                                    worktree_id: worktree_id.to_string(),
                                    content: text.to_string(),
                                },
                            );
                        }
                    }
                    "command_execution" => {
                        let command = item.get("command").and_then(|v| v.as_str()).unwrap_or("");
                        let output = item.get("output").and_then(|v| v.as_str()).unwrap_or("");
                        let tool_id = item
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let _ = app.emit(
                            "chat:tool_use",
                            ToolUseEvent {
                                session_id: session_id.to_string(),
                                worktree_id: worktree_id.to_string(),
                                id: tool_id.clone(),
                                name: "Bash".to_string(),
                                input: serde_json::json!({ "command": command }),
                                parent_tool_use_id: None,
                            },
                        );

                        let _ = app.emit(
                            "chat:tool_result",
                            ToolResultEvent {
                                session_id: session_id.to_string(),
                                worktree_id: worktree_id.to_string(),
                                tool_use_id: tool_id,
                                output: output.to_string(),
                            },
                        );
                    }
                    "file_change" => {
                        let file_path = item.get("file_path").and_then(|v| v.as_str()).unwrap_or("");
                        let change_type = item
                            .get("change_type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("edit");
                        let tool_id = item
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let tool_name = match change_type {
                            "create" => "Write",
                            "delete" => "Bash",
                            _ => "Edit",
                        };

                        let _ = app.emit(
                            "chat:tool_use",
                            ToolUseEvent {
                                session_id: session_id.to_string(),
                                worktree_id: worktree_id.to_string(),
                                id: tool_id,
                                name: tool_name.to_string(),
                                input: serde_json::json!({ "file_path": file_path }),
                                parent_tool_use_id: None,
                            },
                        );
                    }
                    "mcp_tool_call" => {
                        let tool_name = item.get("tool_name").and_then(|v| v.as_str()).unwrap_or("");
                        let tool_id = item
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let arguments = item.get("arguments").cloned().unwrap_or(serde_json::Value::Null);

                        let _ = app.emit(
                            "chat:tool_use",
                            ToolUseEvent {
                                session_id: session_id.to_string(),
                                worktree_id: worktree_id.to_string(),
                                id: tool_id,
                                name: tool_name.to_string(),
                                input: arguments,
                                parent_tool_use_id: None,
                            },
                        );
                    }
                    _ => {
                        if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                            if !text.is_empty() {
                                full_content.push_str(text);
                                full_content.push('\n');
                                let _ = app.emit(
                                    "chat:chunk",
                                    ChunkEvent {
                                        session_id: session_id.to_string(),
                                        worktree_id: worktree_id.to_string(),
                                        content: format!("{text}\n"),
                                    },
                                );
                            }
                        }
                    }
                }
            }
        }
        "item.started" => {
            if let Some(item) = msg.get("item") {
                let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");

                if item_type == "command_execution" {
                    let command = item.get("command").and_then(|v| v.as_str()).unwrap_or("");
                    let tool_id = item
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    let _ = app.emit(
                        "chat:tool_use",
                        ToolUseEvent {
                            session_id: session_id.to_string(),
                            worktree_id: worktree_id.to_string(),
                            id: tool_id,
                            name: "Bash".to_string(),
                            input: serde_json::json!({ "command": command }),
                            parent_tool_use_id: None,
                        },
                    );
                }
            }
        }
        "turn.completed" => {
            if let Some(usage) = msg.get("usage") {
                let input_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let output_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                log::debug!("Codex turn completed: {input_tokens} in, {output_tokens} out");
            }
            return Some(true); // Signal completion
        }
        "turn.failed" | "error" => {
            let error_msg = msg
                .get("error")
                .and_then(|e| e.get("message").and_then(|m| m.as_str()))
                .or_else(|| msg.get("message").and_then(|m| m.as_str()))
                .unwrap_or("Unknown error");

            log::error!("Codex error: {error_msg}");
            let _ = app.emit(
                "chat:error",
                ErrorEvent {
                    session_id: session_id.to_string(),
                    worktree_id: worktree_id.to_string(),
                    error: error_msg.to_string(),
                },
            );
        }
        "thread.started" | "turn.started" => {
            log::trace!("Codex lifecycle event: {event_type}");
        }
        _ => {
            // Try common content fields
            if let Some(text) = msg
                .get("text")
                .and_then(|v| v.as_str())
                .or_else(|| msg.get("content").and_then(|v| v.as_str()))
                .or_else(|| msg.get("output").and_then(|v| v.as_str()))
            {
                full_content.push_str(text);
                full_content.push('\n');
                let _ = app.emit(
                    "chat:chunk",
                    ChunkEvent {
                        session_id: session_id.to_string(),
                        worktree_id: worktree_id.to_string(),
                        content: format!("{text}\n"),
                    },
                );
            }
        }
    }

    None
}

/// Execute Codex CLI as a detached process and tail output
pub fn execute_codex_detached(
    app: &tauri::AppHandle,
    session_id: &str,
    worktree_id: &str,
    _input_file: &Path,
    output_file: &Path,
    working_dir: &Path,
    model: Option<&str>,
    execution_mode: Option<&str>,
    thinking_level: Option<&str>,
    prompt: &str,
) -> Result<(u32, ClaudeResponse), String> {
    log::trace!("Executing Codex CLI (detached) for session: {session_id}");
    log::trace!("Output file: {output_file:?}");
    log::trace!("Working directory: {working_dir:?}");

    // Get CLI path
    let cli_path = get_codex_cli_path(app).map_err(|e| {
        let error_msg = format!("Failed to get Codex CLI path: {e}");
        log::error!("{error_msg}");
        let _ = app.emit(
            "chat:error",
            ErrorEvent {
                session_id: session_id.to_string(),
                worktree_id: worktree_id.to_string(),
                error: error_msg.clone(),
            },
        );
        error_msg
    })?;

    if !cli_path.exists() {
        let error_msg = "Codex CLI not installed. Please install it from Settings.".to_string();
        log::error!("{error_msg}");
        let _ = app.emit(
            "chat:error",
            ErrorEvent {
                session_id: session_id.to_string(),
                worktree_id: worktree_id.to_string(),
                error: error_msg.clone(),
            },
        );
        return Err(error_msg);
    }

    // Build args
    let mut args = vec!["exec".to_string()];

    // Model selection
    if let Some(m) = model {
        args.push("--model".to_string());
        args.push(m.to_string());
    }

    // Enable JSON streaming output
    args.push("--json".to_string());

    // Sandbox/approval mode
    for arg in get_codex_sandbox_args(execution_mode) {
        args.push(arg.to_string());
    }

    // Reasoning effort
    let reasoning_effort = get_codex_reasoning_effort(thinking_level);
    args.push("--config".to_string());
    args.push(format!("model_reasoning_effort=\"{reasoning_effort}\""));

    // Add the prompt as the last argument
    args.push(prompt.to_string());

    log::debug!(
        "Codex CLI command: {} {}",
        cli_path.display(),
        args.iter()
            .take(args.len().saturating_sub(1))
            .cloned()
            .collect::<Vec<_>>()
            .join(" ")
    );

    // Create stderr file path
    let stderr_file = output_file.with_extension("stderr.log");

    // Ensure output file exists (for tailing)
    std::fs::write(output_file, "").map_err(|e| format!("Failed to create output file: {e}"))?;

    // Spawn detached process
    let pid = spawn_detached_codex(
        &cli_path,
        &args,
        output_file,
        &stderr_file,
        working_dir,
        &[],
    )?;

    // Register process for cancellation
    super::registry::register_process(session_id.to_string(), pid);

    // Create tailer for output file
    let mut tailer =
        NdjsonTailer::new_from_start(output_file).map_err(|e| format!("Failed to create tailer: {e}"))?;

    // Tail loop
    let mut full_content = String::new();
    let start_time = Instant::now();
    let mut last_output_time = Instant::now();
    let mut got_first_output = false;
    let mut completed = false;

    loop {
        // Check for cancellation
        if !super::registry::is_process_running(session_id) {
            log::trace!("Process cancelled for session: {session_id}");
            break;
        }

        // Poll for new lines
        match tailer.poll() {
            Ok(lines) => {
                if !lines.is_empty() {
                    got_first_output = true;
                    last_output_time = Instant::now();

                    for line in lines {
                        if let Some(true) = process_codex_event(
                            app,
                            session_id,
                            worktree_id,
                            &line,
                            &mut full_content,
                        ) {
                            completed = true;
                            break;
                        }
                    }

                    if completed {
                        break;
                    }
                }
            }
            Err(e) => {
                log::warn!("Error polling tailer: {e}");
            }
        }

        // Check if process is still alive
        let process_alive = is_process_alive(pid);

        if !process_alive {
            // Process died - give it a grace period to flush output
            if last_output_time.elapsed() > DEAD_PROCESS_GRACE_PERIOD {
                log::trace!("Process {} died and no new output, ending tail", pid);
                break;
            }
        }

        // Check startup timeout
        if !got_first_output && start_time.elapsed() > STARTUP_TIMEOUT {
            let error_msg = "Codex CLI startup timeout - no output received";
            log::error!("{error_msg}");

            // Read stderr for more info
            if let Ok(stderr) = std::fs::read_to_string(&stderr_file) {
                if !stderr.is_empty() {
                    log::error!("Codex stderr: {stderr}");
                }
            }

            let _ = app.emit(
                "chat:error",
                ErrorEvent {
                    session_id: session_id.to_string(),
                    worktree_id: worktree_id.to_string(),
                    error: error_msg.to_string(),
                },
            );
            break;
        }

        thread::sleep(POLL_INTERVAL);
    }

    // Unregister process
    super::registry::unregister_process(session_id);

    log::info!(
        "Codex CLI completed, content length: {} chars",
        full_content.len()
    );

    let response_text = full_content.trim().to_string();

    // Emit done event
    let _ = app.emit(
        "chat:done",
        serde_json::json!({
            "session_id": session_id,
            "worktree_id": worktree_id,
            "success": completed || !response_text.is_empty(),
            "content": response_text,
        }),
    );

    Ok((
        pid,
        ClaudeResponse {
            content: response_text,
            session_id: session_id.to_string(),
            tool_calls: Vec::new(),
            content_blocks: Vec::new(),
            cancelled: false,
            usage: None,
        },
    ))
}
