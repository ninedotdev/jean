import { useMutation } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/lib/logger'
import { extractErrorMessage } from '@/lib/errors'
import { isTauri } from '@/services/projects'

// Query keys for terminal operations
export const terminalQueryKeys = {
  all: ['terminal'] as const,
}

/**
 * Hook to stop a running terminal
 */
export function useStopTerminal() {
  return useMutation({
    mutationFn: async ({
      terminalId,
    }: {
      terminalId: string
    }): Promise<void> => {
      if (!isTauri()) {
        throw new Error('Not in Tauri context')
      }

      logger.debug('Stopping terminal', { terminalId })
      await invoke('stop_terminal', { terminalId })
      logger.info('Terminal stopped', { terminalId })
    },
    onError: error => {
      const message = extractErrorMessage(error)
      logger.error('Failed to stop terminal', { error: message })
    },
  })
}
