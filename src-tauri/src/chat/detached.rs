//! Detached Claude CLI execution
//!
//! This module handles spawning Claude CLI as a fully detached process that
//! survives Jean quitting. The process writes directly to a JSONL file,
//! which Jean tails for real-time updates.

use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};

// Re-export is_process_alive from platform module
pub use crate::platform::is_process_alive;

/// Escape a string for safe use in a shell command.
fn shell_escape(s: &str) -> String {
    // Use single quotes and escape any single quotes within
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Spawn Claude CLI as a detached process that survives Jean quitting (Unix).
///
/// Uses `nohup` and shell backgrounding to fully detach the process.
/// The process reads input from a file and writes output to the NDJSON file.
///
/// Returns the PID of the detached Claude CLI process.
#[cfg(unix)]
#[allow(clippy::too_many_arguments)]
pub fn spawn_detached_claude(
    cli_path: &Path,
    args: &[String],
    input_file: &Path,
    output_file: &Path,
    working_dir: &Path,
    env_vars: &[(&str, &str)],
) -> Result<u32, String> {
    // Build the shell command:
    // cat input.jsonl | nohup /path/to/claude [args] >> output.jsonl 2>&1 & echo $!
    //
    // NOTE: We use `cat file | nohup claude` instead of `nohup claude < file` because
    // Claude CLI with --print doesn't accept stdin from file redirection, only from pipes.
    //
    // - cat: Reads input file and pipes to stdin
    // - nohup: Makes the process immune to SIGHUP (sent when terminal closes)
    // - >> output.jsonl: Appends output to file (Claude writes here)
    // - 2>&1: Redirect stderr to stdout (both go to output file)
    // - &: Run in background
    // - echo $!: Print the PID of the background process

    // Escape ALL paths for safe shell usage (paths may contain spaces like "Application Support")
    let cli_path_escaped =
        shell_escape(cli_path.to_str().ok_or("CLI path contains invalid UTF-8")?);
    let input_path_escaped = shell_escape(
        input_file
            .to_str()
            .ok_or("Input file path contains invalid UTF-8")?,
    );
    let output_path_escaped = shell_escape(
        output_file
            .to_str()
            .ok_or("Output file path contains invalid UTF-8")?,
    );

    // Build args string with proper escaping
    let args_str = args
        .iter()
        .map(|arg| shell_escape(arg))
        .collect::<Vec<_>>()
        .join(" ");

    // Build environment variable exports
    let env_exports = env_vars
        .iter()
        .map(|(k, v)| format!("{}={}", k, shell_escape(v)))
        .collect::<Vec<_>>()
        .join(" ");

    // The full shell command - use cat pipe instead of file redirection
    // Claude CLI with --print requires piped stdin, not file redirection
    // NOTE: env vars must be placed AFTER the pipe so they apply to Claude, not cat
    let shell_cmd = if env_exports.is_empty() {
        format!(
            "cat {input_path_escaped} | nohup {cli_path_escaped} {args_str} >> {output_path_escaped} 2>&1 & echo $!"
        )
    } else {
        format!(
            "cat {input_path_escaped} | {env_exports} nohup {cli_path_escaped} {args_str} >> {output_path_escaped} 2>&1 & echo $!"
        )
    };

    log::trace!("Spawning detached Claude CLI");
    log::trace!("Shell command: {shell_cmd}");
    log::trace!("Working directory: {working_dir:?}");

    // Spawn the shell command
    let mut child = Command::new("sh")
        .arg("-c")
        .arg(&shell_cmd)
        .current_dir(working_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    // Read the PID from stdout (the `echo $!` part)
    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture shell stdout")?;
    let reader = BufReader::new(stdout);

    let mut pid_str = String::new();
    for line in reader.lines() {
        match line {
            Ok(l) => {
                pid_str = l.trim().to_string();
                break;
            }
            Err(e) => {
                log::warn!("Error reading PID from shell: {e}");
            }
        }
    }

    // Capture stderr for error reporting
    let stderr_handle = child.stderr.take();

    // Wait for shell to finish (it returns immediately after backgrounding)
    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for shell: {e}"))?;

    if !status.success() {
        // Read stderr to provide better error messages
        let stderr_output = stderr_handle
            .map(|stderr| {
                BufReader::new(stderr)
                    .lines()
                    .map_while(Result::ok)
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();

        return Err(format!(
            "Shell command failed with status: {status}\nStderr: {stderr_output}"
        ));
    }

    // Parse the PID
    let pid: u32 = pid_str
        .parse()
        .map_err(|e| format!("Failed to parse PID '{pid_str}': {e}"))?;

    log::trace!("Detached Claude CLI spawned with PID: {pid}");

    Ok(pid)
}

/// Spawn Claude CLI as a detached process via WSL (Windows).
///
/// On Windows, Claude CLI requires WSL. We invoke `wsl` to run the command
/// inside the Linux environment, with paths translated to WSL format.
///
/// Returns the PID of the wsl.exe process (killing it terminates WSL children).
#[cfg(windows)]
#[allow(clippy::too_many_arguments)]
pub fn spawn_detached_claude(
    cli_path: &Path,
    args: &[String],
    input_file: &Path,
    output_file: &Path,
    working_dir: &Path,
    env_vars: &[(&str, &str)],
) -> Result<u32, String> {
    use crate::platform::shell::{is_wsl_available, windows_to_wsl_path};
    use std::os::windows::process::CommandExt;

    // Windows process creation flags
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Check WSL availability
    if !is_wsl_available() {
        return Err(
            "WSL is required on Windows to run Claude CLI. Install with: wsl --install".to_string(),
        );
    }

    // Convert Windows paths to WSL paths
    let wsl_cli_path =
        windows_to_wsl_path(cli_path.to_str().ok_or("CLI path contains invalid UTF-8")?);
    let wsl_input_path = windows_to_wsl_path(
        input_file
            .to_str()
            .ok_or("Input file path contains invalid UTF-8")?,
    );
    let wsl_output_path = windows_to_wsl_path(
        output_file
            .to_str()
            .ok_or("Output file path contains invalid UTF-8")?,
    );
    let wsl_working_dir = windows_to_wsl_path(
        working_dir
            .to_str()
            .ok_or("Working directory path contains invalid UTF-8")?,
    );

    // Build args string with proper escaping
    let args_str = args
        .iter()
        .map(|arg| shell_escape(arg))
        .collect::<Vec<_>>()
        .join(" ");

    // Build environment variable exports
    let env_exports = env_vars
        .iter()
        .map(|(k, v)| format!("{}={}", k, shell_escape(v)))
        .collect::<Vec<_>>()
        .join(" ");

    // Build the shell command to run inside WSL
    // Same structure as Unix, but with WSL paths
    let shell_cmd = if env_exports.is_empty() {
        format!(
            "cd '{}' && cat '{}' | nohup '{}' {} >> '{}' 2>&1 & echo $!",
            wsl_working_dir, wsl_input_path, wsl_cli_path, args_str, wsl_output_path
        )
    } else {
        format!(
            "cd '{}' && cat '{}' | {} nohup '{}' {} >> '{}' 2>&1 & echo $!",
            wsl_working_dir, wsl_input_path, env_exports, wsl_cli_path, args_str, wsl_output_path
        )
    };

    log::trace!("Spawning detached Claude CLI via WSL");
    log::trace!("WSL shell command: {shell_cmd}");

    // Spawn wsl.exe with the shell command
    let mut child = Command::new("wsl")
        .args(["-e", "bash", "-c", &shell_cmd])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to spawn WSL: {e}"))?;

    // Read the PID from stdout (the `echo $!` part from inside WSL)
    let stdout = child.stdout.take().ok_or("Failed to capture WSL stdout")?;
    let reader = BufReader::new(stdout);

    let mut wsl_pid_str = String::new();
    for line in reader.lines() {
        match line {
            Ok(l) => {
                wsl_pid_str = l.trim().to_string();
                break;
            }
            Err(e) => {
                log::warn!("Error reading PID from WSL: {e}");
            }
        }
    }

    // Capture stderr for error reporting
    let stderr_handle = child.stderr.take();

    // Wait for the wsl command to finish setting up (returns after backgrounding)
    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for WSL: {e}"))?;

    if !status.success() {
        let stderr_output = stderr_handle
            .map(|stderr| {
                BufReader::new(stderr)
                    .lines()
                    .map_while(Result::ok)
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();

        return Err(format!(
            "WSL command failed with status: {status}\nStderr: {stderr_output}"
        ));
    }

    // The PID we get is from inside WSL (bash's $!)
    // For process management, we track the Windows wsl.exe PID instead
    // because killing wsl.exe will terminate its children
    //
    // Note: We could potentially use the WSL PID for finer-grained control,
    // but for simplicity we use a marker approach - we just check if output
    // file is still being written to
    let pid: u32 = wsl_pid_str
        .parse()
        .map_err(|e| format!("Failed to parse WSL PID '{wsl_pid_str}': {e}"))?;

    log::trace!("Detached Claude CLI spawned via WSL with PID: {pid}");

    Ok(pid)
}

/// Spawn Codex CLI as a detached process that survives Jean quitting (Unix).
///
/// Unlike Claude, Codex takes the prompt as an argument rather than stdin.
/// Uses `nohup` and shell backgrounding to fully detach the process.
///
/// Returns the PID of the detached Codex CLI process.
#[cfg(unix)]
#[allow(clippy::too_many_arguments)]
pub fn spawn_detached_codex(
    cli_path: &Path,
    args: &[String],
    output_file: &Path,
    stderr_file: &Path,
    working_dir: &Path,
    env_vars: &[(&str, &str)],
) -> Result<u32, String> {
    // Build the shell command:
    // nohup /path/to/codex [args] >> output.jsonl 2>> stderr.log & echo $!
    //
    // - nohup: Makes the process immune to SIGHUP
    // - >> output.jsonl: Appends stdout to file (Codex writes JSONL here)
    // - 2>> stderr.log: Appends stderr to separate file
    // - &: Run in background
    // - echo $!: Print the PID of the background process

    let cli_path_escaped =
        shell_escape(cli_path.to_str().ok_or("CLI path contains invalid UTF-8")?);
    let output_path_escaped = shell_escape(
        output_file
            .to_str()
            .ok_or("Output file path contains invalid UTF-8")?,
    );
    let stderr_path_escaped = shell_escape(
        stderr_file
            .to_str()
            .ok_or("Stderr file path contains invalid UTF-8")?,
    );

    // Build args string with proper escaping
    let args_str = args
        .iter()
        .map(|arg| shell_escape(arg))
        .collect::<Vec<_>>()
        .join(" ");

    // Build environment variable exports
    let env_exports = env_vars
        .iter()
        .map(|(k, v)| format!("{}={}", k, shell_escape(v)))
        .collect::<Vec<_>>()
        .join(" ");

    // The full shell command - Codex doesn't need stdin piping
    let shell_cmd = if env_exports.is_empty() {
        format!(
            "nohup {cli_path_escaped} {args_str} >> {output_path_escaped} 2>> {stderr_path_escaped} & echo $!"
        )
    } else {
        format!(
            "{env_exports} nohup {cli_path_escaped} {args_str} >> {output_path_escaped} 2>> {stderr_path_escaped} & echo $!"
        )
    };

    log::trace!("Spawning detached Codex CLI");
    log::trace!("Shell command: {shell_cmd}");
    log::trace!("Working directory: {working_dir:?}");

    // Spawn the shell command
    let mut child = Command::new("sh")
        .arg("-c")
        .arg(&shell_cmd)
        .current_dir(working_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    // Read the PID from stdout
    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture shell stdout")?;
    let reader = BufReader::new(stdout);

    let mut pid_str = String::new();
    for line in reader.lines() {
        match line {
            Ok(l) => {
                pid_str = l.trim().to_string();
                break;
            }
            Err(e) => {
                log::warn!("Error reading PID from shell: {e}");
            }
        }
    }

    let stderr_handle = child.stderr.take();

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for shell: {e}"))?;

    if !status.success() {
        let stderr_output = stderr_handle
            .map(|stderr| {
                BufReader::new(stderr)
                    .lines()
                    .map_while(Result::ok)
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();

        return Err(format!(
            "Shell command failed with status: {status}\nStderr: {stderr_output}"
        ));
    }

    let pid: u32 = pid_str
        .parse()
        .map_err(|e| format!("Failed to parse PID '{pid_str}': {e}"))?;

    log::trace!("Detached Codex CLI spawned with PID: {pid}");

    Ok(pid)
}

/// Spawn Kimi CLI as a detached process (Unix).
///
/// Unlike Codex, Kimi doesn't work well with nohup, so we use a simpler
/// backgrounding approach without nohup.
#[cfg(unix)]
#[allow(clippy::too_many_arguments)]
pub fn spawn_detached_kimi(
    cli_path: &Path,
    args: &[String],
    output_file: &Path,
    stderr_file: &Path,
    working_dir: &Path,
    _env_vars: &[(&str, &str)],
) -> Result<u32, String> {
    // Build the shell command without nohup:
    // /path/to/kimi [args] >> output.jsonl 2>> stderr.log & echo $!
    //
    // Kimi doesn't work properly with nohup, but since Jean stays running
    // during the request, we don't need nohup for crash survival.

    let cli_path_escaped =
        shell_escape(cli_path.to_str().ok_or("CLI path contains invalid UTF-8")?);
    let output_path_escaped = shell_escape(
        output_file
            .to_str()
            .ok_or("Output file path contains invalid UTF-8")?,
    );
    let stderr_path_escaped = shell_escape(
        stderr_file
            .to_str()
            .ok_or("Stderr file path contains invalid UTF-8")?,
    );

    // Build args string with proper escaping
    let args_str = args
        .iter()
        .map(|arg| shell_escape(arg))
        .collect::<Vec<_>>()
        .join(" ");

    // Simple background execution without nohup
    let shell_cmd = format!(
        "{cli_path_escaped} {args_str} >> {output_path_escaped} 2>> {stderr_path_escaped} & echo $!"
    );

    log::trace!("Spawning Kimi CLI (without nohup)");
    log::trace!("Shell command: {shell_cmd}");
    log::trace!("Working directory: {working_dir:?}");

    // Spawn the shell command
    let mut child = Command::new("sh")
        .arg("-c")
        .arg(&shell_cmd)
        .current_dir(working_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    // Capture stderr handle for error reporting
    let stderr_handle = child.stderr.take();

    // Read the PID from stdout
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = BufReader::new(stdout);
    let pid_str = reader
        .lines()
        .next()
        .ok_or("No output from shell")?
        .map_err(|e| format!("Failed to read PID: {e}"))?;

    // Wait for shell to complete
    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for shell: {e}"))?;

    if !status.success() {
        let stderr_output = stderr_handle
            .map(|stderr| {
                BufReader::new(stderr)
                    .lines()
                    .map_while(Result::ok)
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();

        return Err(format!(
            "Shell command failed with status: {status}\nStderr: {stderr_output}"
        ));
    }

    let pid: u32 = pid_str
        .parse()
        .map_err(|e| format!("Failed to parse PID '{pid_str}': {e}"))?;

    log::trace!("Kimi CLI spawned with PID: {pid}");

    Ok(pid)
}

/// Spawn Kimi CLI as a detached process (Windows).
#[cfg(windows)]
#[allow(clippy::too_many_arguments)]
pub fn spawn_detached_kimi(
    cli_path: &Path,
    args: &[String],
    output_file: &Path,
    stderr_file: &Path,
    working_dir: &Path,
    env_vars: &[(&str, &str)],
) -> Result<u32, String> {
    // Windows version can reuse the Codex approach
    spawn_detached_codex(cli_path, args, output_file, stderr_file, working_dir, env_vars)
}

/// Spawn Codex CLI as a detached process (Windows).
#[cfg(windows)]
#[allow(clippy::too_many_arguments)]
pub fn spawn_detached_codex(
    cli_path: &Path,
    args: &[String],
    output_file: &Path,
    stderr_file: &Path,
    working_dir: &Path,
    env_vars: &[(&str, &str)],
) -> Result<u32, String> {
    use std::fs::OpenOptions;
    use std::os::windows::process::CommandExt;

    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Open output files
    let stdout_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(output_file)
        .map_err(|e| format!("Failed to open output file: {e}"))?;

    let stderr_file_handle = OpenOptions::new()
        .create(true)
        .append(true)
        .open(stderr_file)
        .map_err(|e| format!("Failed to open stderr file: {e}"))?;

    log::trace!("Spawning detached Codex CLI on Windows");
    log::trace!("CLI path: {:?}", cli_path);
    log::trace!("Working directory: {:?}", working_dir);

    let mut cmd = Command::new(cli_path);
    cmd.args(args)
        .current_dir(working_dir)
        .stdin(Stdio::null())
        .stdout(stdout_file)
        .stderr(stderr_file_handle)
        .creation_flags(CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW);

    // Set environment variables
    for (key, value) in env_vars {
        cmd.env(key, value);
    }

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn Codex CLI: {e}"))?;

    let pid = child.id();
    log::trace!("Detached Codex CLI spawned with PID: {pid}");

    Ok(pid)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shell_escape() {
        assert_eq!(shell_escape("hello"), "'hello'");
        assert_eq!(shell_escape("hello world"), "'hello world'");
        assert_eq!(shell_escape("it's"), "'it'\\''s'");
        assert_eq!(shell_escape(""), "''");
    }

    #[test]
    fn test_is_process_alive() {
        // Current process should be alive
        let pid = std::process::id();
        assert!(is_process_alive(pid));

        // Non-existent PID should not be alive
        assert!(!is_process_alive(999999));
    }
}
