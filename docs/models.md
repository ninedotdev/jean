# AI Models & Providers

Jean supports multiple AI providers, each with their own models, execution modes, and capabilities.

---

## Providers Overview

| Provider | CLI Tool | Models | Plan Mode | Thinking/Reasoning |
|----------|----------|--------|-----------|-------------------|
| **Claude** | `claude` | Opus, Sonnet, Haiku | ✅ Native | ✅ Extended Thinking |
| **Gemini** | `gemini` | Flash, Pro | ✅ Sandbox | ❌ |
| **Codex** | `codex` | GPT-5.2 | ❌ | ✅ Reasoning Effort |
| **Kimi** | `kimi` | Kimi Code | ❌ | ✅ Execution Modes |

---

## Claude (Anthropic)

### Models

| Model | Value | Best For |
|-------|-------|----------|
| **Claude Opus** | `opus` | Complex reasoning, architecture, code review |
| **Claude Sonnet** | `sonnet` | Balanced performance, general coding |
| **Claude Haiku** | `haiku` | Fast responses, simple tasks |

### Execution Modes

| Mode | CLI Flag | Description |
|------|----------|-------------|
| **Plan** | `--allowedTools` (readonly) | Read-only, requires approval for changes |
| **Build** | (default) | Auto-approves file edits |
| **Yolo** | `--dangerouslySkipPermissions` | Auto-approves everything |

### Extended Thinking

| Level | Label | Tokens | CLI Config |
|-------|-------|--------|------------|
| `off` | Off | 0 | `alwaysThinkingEnabled: false` |
| `think` | Think | 4K | `MAX_THINKING_TOKENS=4000` |
| `megathink` | Megathink | 10K | `MAX_THINKING_TOKENS=10000` |
| `ultrathink` | Ultrathink | 32K | `MAX_THINKING_TOKENS=31999` |

---

## Gemini (Google)

### Models

| Model | Value | Best For |
|-------|-------|----------|
| **Gemini 3 Flash** | `gemini-3-flash-preview` | Fast, cost-effective |
| **Gemini 3 Pro** | `gemini-3-pro-preview` | Higher quality, complex tasks |

### Execution Modes

| Mode | CLI Flags | Description |
|------|-----------|-------------|
| **Plan** | `--sandbox --yolo` | Read-only sandbox mode |
| **Build** | `--approval-mode auto_edit` | Auto-approves file edits |
| **Yolo** | `--yolo` | Auto-approves all actions |

### Notes

- Install: `npm install -g @google/gemini-cli`
- Auth: `gemini` (opens browser for OAuth)
- Output format: `--output-format stream-json`

---

## Codex (OpenAI)

### Models

| Model | Value | Best For |
|-------|-------|----------|
| **GPT-5.2 Codex** | `gpt-5.2-codex` | Code generation, refactoring |

### Reasoning Effort

Maps to ThinkingLevel for UI consistency:

| Level | Label | Effort | Description |
|-------|-------|--------|-------------|
| `off` | Low | Fast | Minimal reasoning |
| `think` | Medium | Balanced | Standard reasoning |
| `megathink` | High | Thorough | Deep analysis |
| `ultrathink` | Extra High | Max | Maximum reasoning |

### Notes

- No native plan mode (uses yolo only)
- Reasoning mapped via `--reasoning-effort` flag

---

## Kimi (Moonshot AI)

### Models

| Model | Value | Best For |
|-------|-------|----------|
| **Kimi Code** | `kimi-code/kimi-for-coding` | Coding, research, multi-step tasks |

### Execution Modes

| Level | Label | CLI Flags | Description |
|-------|-------|-----------|-------------|
| `off` | **Instant** | `--no-thinking` | Quick responses, no reasoning |
| `think` | **Thinking** | `--thinking` | Deep reasoning, single response |
| `megathink` | **Agent** | `--thinking --agent okabe` | Research & content creation |
| `ultrathink` | **Swarm** | `--thinking --agent okabe --max-ralph-iterations -1` | Continuous loop (Ralph Mode) |

### Agent Swarm (Ralph Loop)

The **Swarm** mode enables Kimi's Ralph Loop - a continuous iteration paradigm where the agent:

1. Executes the task
2. Verifies completion
3. Provides self-feedback
4. Runs another iteration with fresh context
5. Repeats until task is complete or limit reached

**Configuration:**
```toml
[loop_control]
max_steps_per_turn = 100
max_retries_per_step = 3
max_ralph_iterations = -1  # -1 = unlimited
```

**Key Features:**
- Up to 100 sub-agents in parallel
- Up to 1,500 coordinated tool calls
- 4.5x faster than single-agent for complex tasks
- Fresh context each iteration (avoids context bloat)

### Notes

- Install: `curl -LsSf https://code.kimi.com/install.sh | bash`
- Auth: `kimi` then `/login`
- Config: `~/.kimi/config.toml`
- Agent types: `default` (okabe), custom via `--agent-file`

---

## Configuration in Jean

### Preferences (`AppPreferences`)

```typescript
interface AppPreferences {
  ai_cli_provider: 'claude' | 'gemini' | 'codex' | 'kimi'
  ai_model: string
  thinking_level: 'off' | 'think' | 'megathink' | 'ultrathink'
  execution_mode: 'plan' | 'build' | 'yolo'
  disable_thinking_in_non_plan_modes: boolean
}
```

### Provider-Specific Behavior

The UI adapts based on selected provider:

| Provider | Thinking Dropdown | Mode Dropdown |
|----------|-------------------|---------------|
| Claude | Extended Thinking (4K/10K/32K) | Plan/Build/Yolo |
| Gemini | Hidden | Plan/Build/Yolo |
| Codex | Reasoning Effort | Auto (yolo only) |
| Kimi | Execution Mode (Instant/Thinking/Agent/Swarm) | Auto (yolo only) |

---

## CLI Installation

```bash
# Claude
npm install -g @anthropic-ai/claude-code

# Gemini
npm install -g @google/gemini-cli

# Codex
npm install -g @openai/codex

# Kimi
curl -LsSf https://code.kimi.com/install.sh | bash
```

---

## References

- [Claude Code CLI](https://docs.anthropic.com/claude-code)
- [Gemini CLI](https://github.com/google/gemini-cli)
- [OpenAI Codex](https://platform.openai.com/docs/codex)
- [Kimi Code CLI](https://moonshotai.github.io/kimi-cli/)
- [Kimi K2.5 Technical Report](https://www.kimi.com/blog/kimi-k2-5.html)
- [Ralph Loop Paradigm](https://www.alibabacloud.com/blog/from-react-to-ralph-loop-a-continuous-iteration-paradigm-for-ai-agents_602799)
