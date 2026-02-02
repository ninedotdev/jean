import { memo, useState } from 'react'
import { Brain, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ThinkingLevel } from '@/types/chat'

interface ThinkingBlockProps {
  /** The thinking content to display */
  thinking: string
  /** Whether this is during streaming (affects animation) */
  isStreaming?: boolean
  /** The current thinking level (ultrathink doesn't animate) */
  thinkingLevel?: ThinkingLevel
}

/**
 * Collapsible thinking block display
 * Shows a summary with expand/collapse functionality
 * Memoized to prevent re-renders when parent state changes
 */
export const ThinkingBlock = memo(function ThinkingBlock({
  thinking,
  isStreaming = false,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Get first line for summary, clean up whitespace
  const lines = thinking.trim().split('\n').filter(l => l.trim())
  const firstLine = lines[0]?.trim() || ''
  const hasMoreContent = thinking.length > 100 || lines.length > 1

  // Truncate first line if too long
  const summary =
    firstLine.length > 60 ? firstLine.slice(0, 60).trim() + '...' : firstLine

  return (
    <div className="text-xs text-muted-foreground/70 py-0.5">
      <button
        type="button"
        onClick={() => hasMoreContent && setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-1.5 w-full text-left',
          hasMoreContent && 'cursor-pointer hover:text-muted-foreground'
        )}
        disabled={!hasMoreContent}
      >
        {hasMoreContent && (
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 transition-transform text-muted-foreground/50',
              isExpanded && 'rotate-90'
            )}
          />
        )}
        <Brain
          className={cn(
            'h-3 w-3 shrink-0',
            isStreaming
              ? 'text-purple-400 animate-pulse'
              : 'text-muted-foreground/50'
          )}
        />
        <span className="italic truncate">
          {isStreaming && !summary ? 'Thinking...' : summary}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-1 ml-5 pl-2 border-l border-muted-foreground/20">
          <pre className="whitespace-pre-wrap text-muted-foreground/60 font-mono text-[11px] leading-relaxed max-h-[200px] overflow-y-auto">
            {thinking.trim()}
          </pre>
        </div>
      )}
    </div>
  )
})
