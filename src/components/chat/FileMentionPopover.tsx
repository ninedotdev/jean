import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileIcon } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { useWorktreeFiles } from '@/services/files'
import type { WorktreeFile, PendingFile } from '@/types/chat'
import { cn } from '@/lib/utils'
import { getExtensionColor } from '@/lib/file-colors'

interface FileMentionPopoverProps {
  /** Worktree path for file listing */
  worktreePath: string | null
  /** Whether the popover is open */
  open: boolean
  /** Callback when popover should close */
  onOpenChange: (open: boolean) => void
  /** Callback when a file is selected */
  onSelectFile: (file: PendingFile) => void
  /** Current search query (text after @) */
  searchQuery: string
  /** Position for the anchor (relative to textarea container) */
  anchorPosition: { top: number; left: number } | null
  /** Reference to the container for positioning (reserved for future use) */
  containerRef?: React.RefObject<HTMLElement | null>
}

export function FileMentionPopover({
  worktreePath,
  open,
  onOpenChange,
  onSelectFile,
  searchQuery,
  anchorPosition,
}: FileMentionPopoverProps) {
  const { data: files = [] } = useWorktreeFiles(worktreePath)
  const listRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter files based on search query (case-insensitive substring match)
  const filteredFiles = useMemo(() => {
    if (!searchQuery) {
      return files.slice(0, 15) // Show first 15 when no search
    }

    const query = searchQuery.toLowerCase()
    return files
      .filter(f => f.relative_path.toLowerCase().includes(query))
      .slice(0, 15) // Limit to 15 results
  }, [files, searchQuery])

  // Clamp selectedIndex to valid range (handles case when filter reduces results)
  const clampedSelectedIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredFiles.length - 1)
  )

  const handleSelect = useCallback(
    (file: WorktreeFile) => {
      const pendingFile: PendingFile = {
        id: crypto.randomUUID(),
        relativePath: file.relative_path,
        extension: file.extension,
      }
      onSelectFile(pendingFile)
      onOpenChange(false)
    },
    [onSelectFile, onOpenChange]
  )

  // Handle keyboard navigation - exposed via ref
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return false

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          setSelectedIndex(i => Math.min(i + 1, filteredFiles.length - 1))
          return true
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          setSelectedIndex(i => Math.max(i - 1, 0))
          return true
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          if (filteredFiles[clampedSelectedIndex]) {
            handleSelect(filteredFiles[clampedSelectedIndex])
          }
          return true
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          onOpenChange(false)
          return true
      }
      return false
    },
    [open, filteredFiles, clampedSelectedIndex, handleSelect, onOpenChange]
  )

  // Attach keyboard handler to document when open
  useEffect(() => {
    if (!open) return

    const handler = (e: KeyboardEvent) => {
      handleKeyDown(e)
    }

    document.addEventListener('keydown', handler, { capture: true })
    return () =>
      document.removeEventListener('keydown', handler, { capture: true })
  }, [open, handleKeyDown])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const selectedItem = list.querySelector(
      `[data-index="${clampedSelectedIndex}"]`
    )
    selectedItem?.scrollIntoView({ block: 'nearest' })
  }, [clampedSelectedIndex])

  if (!open || !anchorPosition) return null

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor
        style={{
          position: 'absolute',
          top: anchorPosition.top,
          left: anchorPosition.left,
          pointerEvents: 'none',
        }}
      />
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="top"
        sideOffset={4}
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList ref={listRef} className="max-h-[200px]">
            {filteredFiles.length === 0 ? (
              <CommandEmpty>No files found</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredFiles.map((file, index) => (
                  <CommandItem
                    key={file.relative_path}
                    data-index={index}
                    data-selected={index === clampedSelectedIndex}
                    value={file.relative_path}
                    onSelect={() => handleSelect(file)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FileIcon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        getExtensionColor(file.extension)
                      )}
                    />
                    <span className="truncate text-sm">
                      {file.relative_path}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
