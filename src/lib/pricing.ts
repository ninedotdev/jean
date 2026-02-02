/**
 * AI Model Pricing Constants and Cost Calculation
 *
 * Pricing data for cost estimation (API equivalent costs)
 * Note: Max/Pro subscribers pay flat rate, this shows what API usage would cost
 */

export interface ModelPricing {
  /** Cost per million input tokens (USD) */
  input: number
  /** Cost per million output tokens (USD) */
  output: number
  /** Cost per million cache read tokens (USD) - optional */
  cacheHit?: number
}

/**
 * Pricing per million tokens by model ID
 * Sources:
 * - Claude: https://www.anthropic.com/pricing
 * - Gemini: https://ai.google.dev/gemini-api/docs/pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude models (per million tokens)
  opus: { input: 5, output: 25, cacheHit: 0.5 },
  sonnet: { input: 3, output: 15, cacheHit: 0.3 },
  haiku: { input: 1, output: 5, cacheHit: 0.1 },

  // Gemini models (per million tokens)
  'gemini-3-flash-preview': { input: 0.5, output: 3 },
  'gemini-3-pro-preview': { input: 2, output: 12 },

  // Codex - message-based billing, no token pricing
  // 'gpt-5.2-codex': not supported (message-based)
}

/**
 * Calculate cost for a specific model's usage
 * @returns Cost in USD, or null if model has no pricing (e.g., Codex)
 */
export function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens?: number
): number | null {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return null

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  const cacheCost =
    cacheReadTokens && pricing.cacheHit
      ? (cacheReadTokens / 1_000_000) * pricing.cacheHit
      : 0

  return inputCost + outputCost + cacheCost
}

/**
 * Calculate total cost from per-model usage breakdown
 * @returns Total cost in USD, or null if no pricing available for any model
 */
export function calculateTotalCost(
  byModel: Record<
    string,
    { input_tokens: number; output_tokens: number; cache_read_input_tokens: number }
  >
): number | null {
  let totalCost = 0
  let hasPricedModel = false

  for (const [model, usage] of Object.entries(byModel)) {
    const cost = calculateModelCost(
      model,
      usage.input_tokens,
      usage.output_tokens,
      usage.cache_read_input_tokens
    )
    if (cost !== null) {
      totalCost += cost
      hasPricedModel = true
    }
  }

  return hasPricedModel ? totalCost : null
}

/**
 * Format cost as a display string
 * @returns Formatted cost string like "~$4.50" or null if no cost
 */
export function formatCost(cost: number | null): string | null {
  if (cost === null) return null
  if (cost < 0.01) return '<$0.01'
  return `~$${cost.toFixed(2)}`
}

/**
 * Provider-specific tooltips with CLI usage tips
 */
export const PROVIDER_TOOLTIPS: Record<string, string> = {
  Claude: 'Use /cost or /stats in CLI for detailed usage',
  Gemini: 'Free tier: 1000 req/day. Use /stats in CLI',
  Codex: 'Message-based limits. Use /status in CLI',
}
