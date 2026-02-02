import type { AiCliProvider } from '@/types/ai-cli'

/**
 * Infers the AI provider from a model string.
 *
 * This is used as a fallback when session.selected_provider is null but
 * session.selected_model has a value (e.g., legacy sessions or incomplete data).
 *
 * @param model - The model string (e.g., "gemini-2.0-flash", "gpt-4o", "claude-opus-4")
 * @returns The inferred provider, defaulting to 'claude' if uncertain
 *
 * @example
 * getProviderFromModel("gemini-2.0-flash") // returns "gemini"
 * getProviderFromModel("gpt-4o") // returns "codex"
 * getProviderFromModel("claude-sonnet-4") // returns "claude"
 */
export function getProviderFromModel(model: string): AiCliProvider {
  const modelLower = model.toLowerCase()

  // Gemini models
  if (modelLower.includes('gemini')) {
    return 'gemini'
  }

  // OpenAI/GPT models (via Codex CLI)
  if (
    modelLower.includes('gpt') ||
    modelLower.includes('o1') ||
    modelLower.includes('o3')
  ) {
    return 'codex'
  }

  // Claude models
  if (
    modelLower.includes('claude') ||
    modelLower.includes('opus') ||
    modelLower.includes('sonnet') ||
    modelLower.includes('haiku')
  ) {
    return 'claude'
  }

  // Codex
  if (modelLower.includes('codex')) {
    return 'codex'
  }

  // Kimi models (Moonshot AI)
  if (modelLower.includes('kimi') || modelLower.includes('moonshot') || modelLower.includes('kimi-code')) {
    return 'kimi'
  }

  // Default fallback to Claude if we can't determine
  return 'claude'
}
