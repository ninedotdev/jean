import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/lib/logger'
import type { UsageOverview } from '@/types/usage'

const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const usageQueryKeys = {
  all: ['usage'] as const,
  overview: (worktreeId: string | null, sessionId: string | null) =>
    [...usageQueryKeys.all, 'overview', worktreeId ?? 'none', sessionId ?? 'none'] as const,
}

interface UsageOverviewParams {
  worktreeId: string | null
  worktreePath: string | null
  sessionId: string | null
}

export function useUsageOverview({
  worktreeId,
  worktreePath,
  sessionId,
}: UsageOverviewParams) {
  return useQuery({
    queryKey: usageQueryKeys.overview(worktreeId, sessionId),
    queryFn: async (): Promise<UsageOverview> => {
      if (!isTauri()) {
        logger.debug('Not in Tauri context, returning mock usage overview')
        return {
          providers: [
            { provider: 'claude', displayName: 'Claude', status: 'ok' },
            {
              provider: 'codex',
              displayName: 'Codex',
              status: 'unavailable',
              message: 'Usage API not configured for Codex yet',
            },
            {
              provider: 'gemini',
              displayName: 'Gemini',
              status: 'unavailable',
              message: 'Usage API not configured for Gemini yet',
            },
          ],
        }
      }

      try {
        logger.debug('Loading usage overview', { worktreeId, sessionId })
        return await invoke<UsageOverview>('get_usage_overview', {
          worktreeId: worktreeId ?? undefined,
          worktreePath: worktreePath ?? undefined,
          sessionId: sessionId ?? undefined,
        })
      } catch (error) {
        logger.error('Failed to load usage overview', { error })
        return {
          providers: [
            {
              provider: 'claude',
              displayName: 'Claude',
              status: 'error',
              message: 'Failed to load usage',
            },
            {
              provider: 'codex',
              displayName: 'Codex',
              status: 'error',
              message: 'Failed to load usage',
            },
            {
              provider: 'gemini',
              displayName: 'Gemini',
              status: 'error',
              message: 'Failed to load usage',
            },
          ],
        }
      }
    },
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60,
  })
}
