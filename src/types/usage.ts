import type { UsageData } from './chat'

export interface RateLimitWindow {
  usedPercent: number
  resetAt?: string
  windowHours?: number
  deltaPercent?: number
}

export interface ProviderUsageSummary {
  provider: 'claude' | 'gemini' | 'codex' | string
  displayName: string
  status: 'ok' | 'unavailable' | 'error' | string
  message?: string
  sessionModel?: string
  sessionUsage?: UsageData
  rateLimit5h?: RateLimitWindow
  rateLimit7d?: RateLimitWindow
}

export interface UsageOverview {
  providers: ProviderUsageSummary[]
}
