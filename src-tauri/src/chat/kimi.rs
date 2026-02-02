//! Kimi CLI execution module
//!
//! Handles executing Kimi CLI for chat messages with streaming support.
//! Uses detached process execution + NDJSON tailing for robustness.

use crate::ai_cli::kimi::config::get_kimi_cli_path;
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};
use tauri::Emitter;

use super::claude::{ChunkEvent, ClaudeResponse, ErrorEvent, ThinkingEvent, ToolResultEvent, ToolUseEvent};
use super::detached::{is_process_alive, spawn_detached_kimi};
use super::tail::{NdjsonTailer, POLL_INTERVAL};

/// Timeout for waiting for first output from Kimi
const STARTUP_TIMEOUT: Duration = Duration::from_secs(120);

/// Timeout after process dies to wait for final output
const DEAD_PROCESS_GRACE_PERIOD: Duration = Duration::from_secs(2);

/// Process a single Kimi NDJSON event and emit appropriate frontend events
fn process_kimi_event(
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

    let role = msg.get("role").and_then(|v| v.as_str()).unwrap_or("");

    match role {
        "assistant" => {
            // Content can be either an array (with thinking) or a string (without thinking)
            if let Some(content_str) = msg.get("content").and_then(|v| v.as_str()) {
                // Simple string content (--no-thinking mode)
                if !content_str.is_empty() {
                    full_content.push_str(content_str);
                    full_content.push('\n');
                    let _ = app.emit(
                        "chat:chunk",
                        ChunkEvent {
                            session_id: session_id.to_string(),
                            worktree_id: worktree_id.to_string(),
                            content: format!("{content_str}\n"),
                        },
                    );
                }
            } else if let Some(content_arr) = msg.get("content").and_then(|v| v.as_array()) {
                // Array content (with thinking enabled)
                for item in content_arr {
                    let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");

                    match item_type {
                        "think" => {
                            if let Some(think_text) = item.get("think").and_then(|v| v.as_str()) {
                                if !think_text.is_empty() {
                                    let _ = app.emit(
                                        "chat:thinking",
                                        ThinkingEvent {
                                            session_id: session_id.to_string(),
                                            worktree_id: worktree_id.to_string(),
                                            content: think_text.to_string(),
                                        },
                                    );
                                }
                            }
                        }
                        "text" => {
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
                        _ => {}
                    }
                }
            }

            // Process tool_calls if present
            if let Some(tool_calls) = msg.get("tool_calls").and_then(|v| v.as_array()) {
                for tool_call in tool_calls {
                    let tool_id = tool_call
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    if let Some(function) = tool_call.get("function") {
                        let tool_name = function
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let arguments = function
                            .get("arguments")
                            .and_then(|v| v.as_str())
                            .unwrap_or("{}");

                        // Parse arguments as JSON
                        let input: serde_json::Value =
                            serde_json::from_str(arguments).unwrap_or(serde_json::json!({}));

                        // Map Kimi tool names to our standard names
                        let mapped_name = match tool_name.as_str() {
                            "WriteFile" | "CreateFile" => "Write",
                            "ReadFile" => "Read",
                            "EditFile" | "PatchFile" => "Edit",
                            "RunCommand" | "Bash" | "Shell" => "Bash",
                            "ListDirectory" | "ListDir" => "Bash",
                            "DeleteFile" => "Bash",
                            "SearchFiles" | "GlobTool" => "Glob",
                            "GrepTool" | "SearchContent" => "Grep",
                            _ => &tool_name,
                        };

                        let _ = app.emit(
                            "chat:tool_use",
                            ToolUseEvent {
                                session_id: session_id.to_string(),
                                worktree_id: worktree_id.to_string(),
                                id: tool_id,
                                name: mapped_name.to_string(),
                                input,
                                parent_tool_use_id: None,
                            },
                        );
                    }
                }
            }

            // Don't try to detect completion from content - just let the process finish
            // The tail loop will exit when the process dies
        }
        "tool" => {
            // Tool result
            let tool_call_id = msg
                .get("tool_call_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let output = msg
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let _ = app.emit(
                "chat:tool_result",
                ToolResultEvent {
                    session_id: session_id.to_string(),
                    worktree_id: worktree_id.to_string(),
                    tool_use_id: tool_call_id,
                    output,
                },
            );
        }
        "error" => {
            let error_msg = msg
                .get("content")
                .and_then(|v| v.as_str())
                .or_else(|| msg.get("message").and_then(|v| v.as_str()))
                .unwrap_or("Unknown error");

            log::error!("Kimi error: {error_msg}");
            let _ = app.emit(
                "chat:error",
                ErrorEvent {
                    session_id: session_id.to_string(),
                    worktree_id: worktree_id.to_string(),
                    error: error_msg.to_string(),
                },
            );
        }
        _ => {
            log::trace!("Kimi unknown role: {role}");
        }
    }

    None
}

/// Execute Kimi CLI as a detached process and tail output
pub fn execute_kimi_detached(
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
    log::trace!("Executing Kimi CLI (detached) for session: {session_id}");
    log::trace!("Output file: {output_file:?}");
    log::trace!("Working directory: {working_dir:?}");

    // Get CLI path
    let cli_path = get_kimi_cli_path().map_err(|e| {
        let error_msg = format!("Failed to get Kimi CLI path: {e}");
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
        let error_msg = "Kimi CLI not installed. Please install it from Settings.".to_string();
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
    // kimi --print --output-format stream-json --yolo -p "prompt"
    let mut args = vec![
        "--print".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
    ];

    // Working directory
    args.push("-w".to_string());
    args.push(working_dir.to_string_lossy().to_string());

    // Model selection
    if let Some(m) = model {
        args.push("-m".to_string());
        args.push(m.to_string());
    }

    // Kimi execution mode based on thinking_level:
    // - off: Instant mode (--no-thinking) - quick responses
    // - think: Thinking mode (--thinking) - deep reasoning
    // - megathink: Agent mode (--thinking --agent okabe) - single task execution
    // - ultrathink: Swarm mode (--thinking --agent okabe --max-ralph-iterations -1) - continuous loop
    match thinking_level {
        Some("off") => {
            // Instant mode - no thinking
            args.push("--no-thinking".to_string());
        }
        Some("think") => {
            // Thinking mode - enable thinking
            args.push("--thinking".to_string());
        }
        Some("megathink") => {
            // Agent mode - thinking + explicit agent, single task
            args.push("--thinking".to_string());
            args.push("--agent".to_string());
            args.push("okabe".to_string());
        }
        Some("ultrathink") => {
            // Swarm mode - agent with Ralph loop enabled (continuous iterations)
            args.push("--thinking".to_string());
            args.push("--agent".to_string());
            args.push("okabe".to_string());
            args.push("--max-ralph-iterations".to_string());
            args.push("-1".to_string()); // -1 = unlimited iterations until task complete
        }
        _ => {
            // Use default (config file setting)
        }
    }

    // Approval mode: --print implies --yolo but we can be explicit
    // For plan mode, we might want different behavior, but Kimi doesn't have read-only sandbox
    match execution_mode {
        Some("plan") => {
            // Plan mode - still auto-approve since Kimi doesn't have sandboxing
            // The prompt should instruct it to only read/analyze
        }
        _ => {
            // build/yolo mode - auto-approve
        }
    }

    // Add the prompt
    args.push("-p".to_string());
    args.push(prompt.to_string());

    log::debug!(
        "Kimi CLI command: {} {}",
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

    // Spawn process (Kimi doesn't work with nohup, so we use a simpler approach)
    let pid = spawn_detached_kimi(
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
                        if let Some(true) = process_kimi_event(
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
            let error_msg = "Kimi CLI startup timeout - no output received";
            log::error!("{error_msg}");

            // Read stderr for more info
            if let Ok(stderr) = std::fs::read_to_string(&stderr_file) {
                if !stderr.is_empty() {
                    log::error!("Kimi stderr: {stderr}");
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
        "Kimi CLI completed, content length: {} chars",
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
