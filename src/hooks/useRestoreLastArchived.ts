import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useArchivedWorktrees, useUnarchiveWorktree } from '@/services/projects'
import {
  useAllArchivedSessions,
  useUnarchiveSession,
  chatQueryKeys,
} from '@/services/chat'
import { useProjectsStore } from '@/store/projects-store'
import { useChatStore } from '@/store/chat-store'
import { logger } from '@/lib/logger'
import type { Worktree } from '@/types/projects'
import type { ArchivedSessionEntry } from '@/types/chat'

type ArchivedItem =
  | { type: 'worktree'; worktree: Worktree }
  | { type: 'session'; entry: ArchivedSessionEntry }

/**
 * Hook to handle CMD+SHIFT+T keybinding for restoring the most recently archived item.
 * Similar to browser tab restore functionality.
 *
 * Listens for 'restore-last-archived' custom event and restores the most recently
 * archived worktree or session, then focuses it in the sidebar.
 */
export function useRestoreLastArchived() {
  const queryClient = useQueryClient()

  // Fetch archived data
  const { data: archivedWorktrees } = useArchivedWorktrees()
  const { data: archivedSessions } = useAllArchivedSessions()

  // Mutations
  const unarchiveWorktree = useUnarchiveWorktree()
  const unarchiveSession = useUnarchiveSession()

  const restoreLastArchived = useCallback(() => {
    // Combine all archived items and sort by archived_at descending
    const items: ArchivedItem[] = []

    // Add archived worktrees
    if (archivedWorktrees) {
      for (const worktree of archivedWorktrees) {
        items.push({ type: 'worktree', worktree })
      }
    }

    // Add archived sessions
    if (archivedSessions) {
      for (const entry of archivedSessions) {
        items.push({ type: 'session', entry })
      }
    }

    if (items.length === 0) {
      toast.info('No archived items to restore')
      return
    }

    // Sort by archived_at descending (most recent first)
    items.sort((a, b) => {
      const aTime =
        a.type === 'worktree'
          ? a.worktree.archived_at
          : a.entry.session.archived_at
      const bTime =
        b.type === 'worktree'
          ? b.worktree.archived_at
          : b.entry.session.archived_at
      return (bTime ?? 0) - (aTime ?? 0)
    })

    // Get the most recent archived item
    const mostRecent = items[0]
    if (!mostRecent) {
      toast.info('No archived items to restore')
      return
    }

    if (mostRecent.type === 'worktree') {
      const { worktree } = mostRecent
      logger.info('Restoring last archived worktree', {
        worktreeId: worktree.id,
      })

      unarchiveWorktree.mutate(worktree.id, {
        onSuccess: () => {
          // Select the worktree in the sidebar
          const { selectWorktree } = useProjectsStore.getState()
          selectWorktree(worktree.id)

          // Set the restored worktree as active
          const { setActiveWorktree } = useChatStore.getState()
          setActiveWorktree(worktree.id, worktree.path)

          logger.info('Restored worktree via CMD+SHIFT+T', {
            worktree: worktree.name,
          })
        },
      })
    } else {
      const { entry } = mostRecent
      logger.info('Restoring last archived session', {
        sessionId: entry.session.id,
        worktreeId: entry.worktree_id,
      })

      // Check if the worktree is also archived - if so, restore it first
      const worktreeIsArchived = archivedWorktrees?.some(
        w => w.id === entry.worktree_id
      )

      const restoreSessionOnly = () => {
        unarchiveSession.mutate(
          {
            worktreeId: entry.worktree_id,
            worktreePath: entry.worktree_path,
            sessionId: entry.session.id,
          },
          {
            onSuccess: () => {
              // Invalidate the all-archived-sessions query
              queryClient.invalidateQueries({
                queryKey: ['all-archived-sessions'],
              })
              // Invalidate sessions for this worktree
              queryClient.invalidateQueries({
                queryKey: chatQueryKeys.sessions(entry.worktree_id),
              })

              // Select the worktree in the sidebar
              const { selectWorktree } = useProjectsStore.getState()
              selectWorktree(entry.worktree_id)

              // Set the worktree as active and the restored session as active
              const { setActiveWorktree, setActiveSession } =
                useChatStore.getState()
              setActiveWorktree(entry.worktree_id, entry.worktree_path)
              setActiveSession(entry.worktree_id, entry.session.id)

              logger.info('Restored session via CMD+SHIFT+T', {
                session: entry.session.name,
              })
            },
          }
        )
      }

      if (worktreeIsArchived) {
        // Restore the worktree first, then the session
        unarchiveWorktree.mutate(entry.worktree_id, {
          onSuccess: () => {
            restoreSessionOnly()
          },
        })
      } else {
        restoreSessionOnly()
      }
    }
  }, [
    archivedWorktrees,
    archivedSessions,
    unarchiveWorktree,
    unarchiveSession,
    queryClient,
  ])

  useEffect(() => {
    const handleRestoreLastArchived = () => {
      restoreLastArchived()
    }

    window.addEventListener('restore-last-archived', handleRestoreLastArchived)

    return () => {
      window.removeEventListener(
        'restore-last-archived',
        handleRestoreLastArchived
      )
    }
  }, [restoreLastArchived])
}
