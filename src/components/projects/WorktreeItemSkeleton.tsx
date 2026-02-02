import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import type { Worktree } from '@/types/projects'
import { useProjectsStore } from '@/store/projects-store'

interface WorktreeItemSkeletonProps {
  worktree: Worktree
}

/**
 * Skeleton placeholder for a worktree that is being created or deleted in the background.
 * Shows a pulsing animation and the worktree name while the operation is in progress.
 */
export function WorktreeItemSkeleton({ worktree }: WorktreeItemSkeletonProps) {
  const { selectedWorktreeId } = useProjectsStore()
  const isSelected = selectedWorktreeId === worktree.id
  const isDeleting = worktree.status === 'deleting'

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 py-1.5 pl-10 pr-2',
        isSelected && 'bg-accent/50',
        // Pulsing animation for the entire row
        'animate-pulse'
      )}
    >
      {/* Spinner icon */}
      <Spinner size={14} className="shrink-0" />

      {/* Worktree name with reduced opacity */}
      <span className="flex-1 truncate text-sm text-muted-foreground">
        {worktree.name}
      </span>

      {/* Status indicator */}
      <span className="shrink-0 text-xs text-muted-foreground">
        {isDeleting ? 'Deleting...' : 'Creating...'}
      </span>
    </div>
  )
}
