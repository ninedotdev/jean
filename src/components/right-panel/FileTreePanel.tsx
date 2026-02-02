import { ScrollArea } from '@/components/ui/scroll-area'
import { useWorktreeFiles } from '@/services/files'
import type { WorktreeFile } from '@/types/chat'
import { FileIcon } from '@/components/ui/file-icon'
import { Spinner } from '@/components/ui/spinner'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface FileTreePanelProps {
  worktreePath: string
}

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: Record<string, FileNode>
}

function buildFileTree(files: WorktreeFile[]): FileNode[] {
  const root: Record<string, FileNode> = {}

  for (const file of files) {
    const parts = file.relative_path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue
      const isLast = i === parts.length - 1

      if (!current[part]) {
        current[part] = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          isDirectory: !isLast,
          children: isLast ? undefined : {},
        }
      }

      if (!isLast && current[part].children) {
        current = current[part].children
      }
    }
  }

  const convertToArray = (obj: Record<string, FileNode>): FileNode[] => {
    return Object.values(obj)
      .map(node => ({
        ...node,
        children: node.children ? node.children : undefined,
      }))
      .sort((a, b) => {
        // Directories first, then alphabetically
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
  }

  return convertToArray(root)
}

interface FileTreeNodeProps {
  node: FileNode
  level: number
  expandedPaths: Set<string>
  onToggle: (path: string) => void
}

function FileTreeNode({ node, level, expandedPaths, onToggle }: FileTreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path)
  const childrenArray = node.children ? Object.values(node.children) : []
  const hasChildren = childrenArray.length > 0

  return (
    <div>
      <button
        className={cn(
          'flex w-full items-center gap-1.5 py-0.5 text-xs hover:bg-accent/50',
          'text-left transition-colors'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (node.isDirectory) {
            onToggle(node.path)
          }
        }}
      >
        <FileIcon
          path={node.path}
          isDirectory={node.isDirectory}
          isExpanded={isExpanded}
          className="h-3.5 w-3.5"
        />
        <span className="truncate text-foreground">{node.name}</span>
      </button>

      {node.isDirectory && isExpanded && hasChildren && (
        <div>
          {childrenArray.map(child => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTreePanel({ worktreePath }: FileTreePanelProps) {
  const { data: files, isLoading, isError } = useWorktreeFiles(worktreePath)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const fileTree = useMemo(() => {
    if (!files) return []
    return buildFileTree(files)
  }, [files])

  const handleToggle = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={20} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        Failed to load files
      </div>
    )
  }

  if (!files || files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        No files found
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        {fileTree.map(node => (
          <FileTreeNode
            key={node.path}
            node={node}
            level={0}
            expandedPaths={expandedPaths}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
