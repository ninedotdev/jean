# Task: Fix Codex Context Loss

## Status
- [x] Identify the cause of context loss (Codex CLI is stateless but only receiving current message)
- [x] Locate relevant code in `src-tauri/src/chat/commands.rs` and `src-tauri/src/chat/codex.rs`
- [x] Modify `send_chat_message` in `src-tauri/src/chat/commands.rs` to:
    - [x] Load full session history for Codex provider
    - [x] Format history as a text transcript (User: ... Assistant: ...)
    - [x] Overwrite the input file with the full history
- [x] Verify compilation with `cargo check`

## Context
The user reported that the Codex CLI tool was "forgetting" previous messages. This was because the `codex exec` command was being invoked with only the current user message as the prompt. Since `codex exec` is stateless (unlike a persistent REPL), it needs the full conversation history to be passed in every request.

## Changes
- Modified `src-tauri/src/chat/commands.rs`:
    - Added logic inside the `codex` match arm in `send_chat_message`.
    - Used `run_log::load_session_messages` to fetch history.
    - Formatted the history into a string `User: <content>\n\nAssistant: <content>\n\n`.
    - Overwrote the `input_file` with this full context string.

## Verification
- Ran `cargo check` in `src-tauri/` to ensure no syntax errors or type mismatches.

