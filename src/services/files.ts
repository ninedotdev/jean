import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { extractErrorMessage } from '@/lib/errors'
import type { WorktreeFile } from '@/types/chat'
import { isTauri } from '@/services/projects'

// Query keys for files
export const fileQueryKeys = {
  all: ['files'] as const,
  worktreeFiles: (worktreePath: string) =>
    [...fileQueryKeys.all, 'worktree', worktreePath] as const,
}

/**
 * Hook to get all files in a worktree (for @ mentions)
 * Results are cached and only refetched when worktree changes
 */
export function useWorktreeFiles(worktreePath: string | null) {
  return useQuery({
    queryKey: fileQueryKeys.worktreeFiles(worktreePath ?? ''),
    queryFn: async (): Promise<WorktreeFile[]> => {
      if (!isTauri() || !worktreePath) {
        return []
      }

      try {
        logger.debug('Loading worktree files', { worktreePath })
        const files = await invoke<WorktreeFile[]>('list_worktree_files', {
          worktreePath,
          maxFiles: 5000,
        })
        logger.info('Worktree files loaded', { count: files.length })
        return files
      } catch (error) {
        logger.error('Failed to load worktree files', { error, worktreePath })
        return []
      }
    },
    enabled: !!worktreePath,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in memory for 10 minutes
  })
}

// ============================================================================
// File Mutations
// ============================================================================

/**
 * Hook to write file content to disk
 */
export function useWriteFileContent() {
  return useMutation({
    mutationFn: async ({
      path,
      content,
    }: {
      path: string
      content: string
    }): Promise<void> => {
      if (!isTauri()) {
        throw new Error('Not in Tauri context')
      }

      logger.debug('Writing file content', { path })
      await invoke('write_file_content', { path, content })
      logger.info('File content written', { path })
    },
    onSuccess: () => {
      toast.success('File saved')
    },
    onError: error => {
      const message = extractErrorMessage(error)
      logger.error('Failed to write file', { error })
      toast.error(`Failed to save: ${message}`)
    },
  })
}

/**
 * Hook to open a file in the default application or specified editor
 */
export function useOpenFileInApp() {
  return useMutation({
    mutationFn: async ({
      path,
      editor,
    }: {
      path: string
      editor?: string
    }): Promise<void> => {
      if (!isTauri()) {
        throw new Error('Not in Tauri context')
      }

      logger.debug('Opening file in app', { path, editor })
      await invoke('open_file_in_default_app', { path, editor })
      logger.info('File opened', { path })
    },
    onError: error => {
      const message = extractErrorMessage(error)
      logger.error('Failed to open file', { error })
      toast.error(`Failed to open: ${message}`)
    },
  })
}

/**
 * Hook to delete a pasted image
 */
export function useDeletePastedImage() {
  return useMutation({
    mutationFn: async ({ path }: { path: string }): Promise<void> => {
      if (!isTauri()) {
        throw new Error('Not in Tauri context')
      }

      logger.debug('Deleting pasted image', { path })
      await invoke('delete_pasted_image', { path })
      logger.info('Pasted image deleted', { path })
    },
    onError: error => {
      // Silent failure - still remove from UI
      logger.error('Failed to delete pasted image', { error })
    },
  })
}

/**
 * Hook to delete a pasted text file
 */
export function useDeletePastedText() {
  return useMutation({
    mutationFn: async ({ path }: { path: string }): Promise<void> => {
      if (!isTauri()) {
        throw new Error('Not in Tauri context')
      }

      logger.debug('Deleting pasted text', { path })
      await invoke('delete_pasted_text', { path })
      logger.info('Pasted text deleted', { path })
    },
    onError: error => {
      // Silent failure - still remove from UI
      logger.error('Failed to delete pasted text', { error })
    },
  })
}

/**
 * Hook to delete a saved context file
 */
export function useDeleteContextFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ path }: { path: string }): Promise<void> => {
      if (!isTauri()) {
        throw new Error('Not in Tauri context')
      }

      logger.debug('Deleting context file', { path })
      await invoke('delete_context_file', { path })
      logger.info('Context file deleted', { path })
    },
    onSuccess: () => {
      // Invalidate saved contexts query
      queryClient.invalidateQueries({ queryKey: ['session-context'] })
    },
    onError: error => {
      logger.error('Failed to delete context file', { error })
    },
  })
}

/**
 * Hook to rename a saved context
 */
export function useRenameSavedContext() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      filename,
      newName,
    }: {
      filename: string
      newName: string
    }): Promise<void> => {
      if (!isTauri()) {
        throw new Error('Not in Tauri context')
      }

      logger.debug('Renaming saved context', { filename, newName })
      await invoke('rename_saved_context', { filename, newName })
      logger.info('Saved context renamed', { filename, newName })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-context'] })
    },
    onError: error => {
      const message = extractErrorMessage(error)
      logger.error('Failed to rename context', { error })
      toast.error(`Failed to rename context: ${message}`)
    },
  })
}
