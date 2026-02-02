/**
 * Multi-provider usage service
 *
 * Provides hooks to fetch usage data from multiple AI providers:
 * - Claude (via Anthropic OAuth API)
 * - Codex (via OpenAI RPC)
 * - Gemini (via Google Cloud API)
 * - Kimi (via Kimi API)
 */

import { invoke } from '@tauri-apps/api/core'
import { useQuery } from '@tanstack/react-query'

// ============================================================================
// Types
// ============================================================================

export interface RateWindow {
  usedPercent: number
  windowMinutes: number | null
  resetsAt: string | null
  resetDescription: string | null
}

export interface ProviderUsageSnapshot {
  providerId: string
  primary: RateWindow | null
  secondary: RateWindow | null
  accountEmail: string | null
  planType: string | null
  updatedAt: string
  available: boolean
  error: string | null
}

export interface AllProvidersUsage {
  claude: ProviderUsageSnapshot | null
  codex: ProviderUsageSnapshot | null
  gemini: ProviderUsageSnapshot | null
  kimi: ProviderUsageSnapshot | null
}

export type ProviderId = 'claude' | 'codex' | 'gemini' | 'kimi'

// ============================================================================
// Query Keys
// ============================================================================

export const providerUsageQueryKeys = {
  all: ['provider-usage'] as const,
  provider: (providerId: string) =>
    [...providerUsageQueryKeys.all, 'provider', providerId] as const,
  allProviders: () => [...providerUsageQueryKeys.all, 'all-providers'] as const,
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch usage for a specific provider
 */
export async function getProviderUsage(
  provider: ProviderId
): Promise<ProviderUsageSnapshot> {
  return invoke<ProviderUsageSnapshot>('get_provider_usage', { provider })
}

/**
 * Fetch usage for all providers
 */
export async function getAllProvidersUsage(): Promise<AllProvidersUsage> {
  return invoke<AllProvidersUsage>('get_all_providers_usage')
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get usage for a specific provider
 *
 * Polls every 60 seconds.
 */
export function useProviderUsage(provider: ProviderId | null) {
  return useQuery({
    queryKey: provider
      ? providerUsageQueryKeys.provider(provider)
      : ['provider-usage', 'none'],
    queryFn: () => (provider ? getProviderUsage(provider) : null),
    enabled: !!provider,
    staleTime: 60_000, // 60 seconds
    refetchInterval: 60_000, // Poll every 60 seconds
    retry: false,
  })
}

/**
 * Hook to get usage for all providers
 *
 * Polls every 60 seconds.
 */
export function useAllProvidersUsage() {
  return useQuery({
    queryKey: providerUsageQueryKeys.allProviders(),
    queryFn: getAllProvidersUsage,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  })
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Get provider display name
 */
export function getProviderDisplayName(providerId: ProviderId): string {
  switch (providerId) {
    case 'claude':
      return 'Claude'
    case 'codex':
      return 'Codex'
    case 'gemini':
      return 'Gemini'
    case 'kimi':
      return 'Kimi'
  }
}

/**
 * Get provider color for usage indicator
 */
export function getProviderColor(providerId: ProviderId): string {
  switch (providerId) {
    case 'claude':
      return 'text-orange-500'
    case 'codex':
      return 'text-green-500'
    case 'gemini':
      return 'text-blue-500'
    case 'kimi':
      return 'text-purple-500'
  }
}

/**
 * Get utilization color based on percentage used
 */
export function getUtilizationColor(usedPercent: number): string {
  if (usedPercent >= 90) return 'text-red-500'
  if (usedPercent >= 70) return 'text-yellow-500'
  if (usedPercent >= 50) return 'text-orange-500'
  return 'text-muted-foreground'
}

/**
 * Format window label (e.g., "5h", "7d", "24h")
 */
export function formatWindowLabel(windowMinutes: number | null): string {
  if (!windowMinutes) return ''
  if (windowMinutes <= 60) return `${windowMinutes}m`
  if (windowMinutes < 1440) return `${Math.round(windowMinutes / 60)}h`
  return `${Math.round(windowMinutes / 1440)}d`
}
