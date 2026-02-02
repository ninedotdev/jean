import { useQuery } from '@tanstack/react-query'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGitStatus, getGitDiff } from '@/services/git-status'
import { FileText, FilePlus, FileMinus, FileEdit } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { DiffFile } from '@/types/git-diff'
import { cn } from '@/lib/utils'

interface GitChangesPanelProps {
  worktreeId: string
  worktreePath: string
  onFileClick?: (filePath: string) => void
}

/** Get status icon for file */
function FileStatusIcon({ status }: { status: DiffFile['status'] }) {
  switch (status) {
    case 'added':
      return <FilePlus className="h-3.5 w-3.5 text-green-500" />
    case 'deleted':
      return <FileMinus className="h-3.5 w-3.5 text-red-500" />
    case 'renamed':
      return <FileEdit className="h-3.5 w-3.5 text-yellow-500" />
    default:
      return <FileText className="h-3.5 w-3.5 text-blue-500" />
  }
}

/** Get filename from path */
function getFilename(path: string): string {
  return path.split('/').pop() ?? path
}

/** Get directory from path */
function getDirectory(path: string): string {
  const parts = path.split('/')
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

export function GitChangesPanel({
  worktreeId,
  worktreePath,
  onFileClick,
}: GitChangesPanelProps) {
  const { data: gitStatus, isLoading: isStatusLoading } =
    useGitStatus(worktreeId)

  const hasChanges = Boolean(
    gitStatus &&
      (gitStatus.uncommitted_added > 0 || gitStatus.uncommitted_removed > 0)
  )

  // Fetch detailed diff when there are changes
  const {
    data: diff,
    isLoading: isDiffLoading,
    isError: isDiffError,
  } = useQuery({
    queryKey: ['git-diff', 'uncommitted', worktreePath] as const,
    queryFn: () => getGitDiff(worktreePath, 'uncommitted'),
    enabled: hasChanges && !!worktreePath,
    staleTime: 30_000, // Refresh every 30s
  })

  const isLoading = isStatusLoading || (hasChanges && isDiffLoading)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={20} />
      </div>
    )
  }

  if (!gitStatus) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        Failed to load git status
      </div>
    )
  }

  if (!hasChanges) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        No changes
      </div>
    )
  }

  if (isDiffError || !diff) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        Failed to load changes
      </div>
    )
  }

  // Group files by directory for better organization
  const filesByDirectory = diff.files.reduce<Record<string, DiffFile[]>>(
    (acc, file) => {
      const dir = getDirectory(file.path) || '.'
      if (!acc[dir]) acc[dir] = []
      acc[dir].push(file)
      return acc
    },
    {}
  )

  // Sort directories (root first, then alphabetically)
  const sortedDirs = Object.keys(filesByDirectory).sort((a, b) => {
    if (a === '.') return -1
    if (b === '.') return 1
    return a.localeCompare(b)
  })

  return (
    <ScrollArea className="h-full">
      <div className="py-1">
        {/* Summary header */}
        <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border/50 mb-1">
          <span className="font-medium">{diff.files.length}</span> file
          {diff.files.length !== 1 ? 's' : ''} changed
          {diff.total_additions > 0 && (
            <span className="text-green-500 ml-2">
              +{diff.total_additions}
            </span>
          )}
          {diff.total_deletions > 0 && (
            <span className="text-red-500 ml-1">-{diff.total_deletions}</span>
          )}
        </div>

        {/* File list grouped by directory */}
        {sortedDirs.map(dir => (
          <div key={dir}>
            {/* Directory header (skip for root) */}
            {dir !== '.' && (
              <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                {dir}
              </div>
            )}

            {/* Files in directory */}
            {filesByDirectory[dir]?.map(file => (
              <button
                key={file.path}
                type="button"
                onClick={() => onFileClick?.(file.path)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-left',
                  'hover:bg-muted/50 transition-colors',
                  'group'
                )}
                title={file.path}
              >
                <FileStatusIcon status={file.status} />
                <span className="flex-1 truncate text-xs">
                  {getFilename(file.path)}
                </span>
                <div className="flex items-center gap-1 text-[10px] opacity-70 group-hover:opacity-100">
                  {file.additions > 0 && (
                    <span className="text-green-500">+{file.additions}</span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-red-500">-{file.deletions}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
