import { useState } from 'react'
import { RiGeminiFill } from 'react-icons/ri'
import { SiOpenai, SiClaude } from 'react-icons/si'
import { CheckCircle2, Circle, XCircle, X, Cpu, Terminal } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useChatStore, type DelegationProgress } from '@/store/chat-store'
import type { DelegatedTask } from '@/types/chat'
import type { AiCliProvider } from '@/types/preferences'
import { getModelLabel } from '@/types/preferences'
import { cn } from '@/lib/utils'

// PERFORMANCE: Stable empty array reference to prevent infinite render loops
const EMPTY_DELEGATED_TASKS: DelegatedTask[] = []

interface DelegationInlineButtonProps {
  sessionId: string
  /** Callback to dismiss/clear the delegation tasks */
  onClose?: () => void
}

/**
 * Inline button for toolbar showing delegation progress
 * Opens a popover with the full task list on click
 * Follows the same pattern as TodoInlineButton
 */
export function DelegationInlineButton({
  sessionId,
  onClose,
}: DelegationInlineButtonProps) {
  const [open, setOpen] = useState(false)

  const delegatedTasks = useChatStore(
    state => state.delegatedTasks[sessionId] ?? EMPTY_DELEGATED_TASKS
  )
  const progress = useChatStore(
    state => state.delegationProgress[sessionId]
  ) as DelegationProgress | undefined

  // Don't render if no tasks
  if (delegatedTasks.length === 0) {
    return null
  }

  const completedCount = delegatedTasks.filter(
    t => t.status === 'completed'
  ).length
  const failedCount = delegatedTasks.filter(t => t.status === 'failed').length
  const totalCount = delegatedTasks.length
  const isRunning = progress !== undefined
  const allDone = completedCount + failedCount === totalCount && totalCount > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          title={`Delegation: ${completedCount}/${totalCount}${failedCount > 0 ? ` (${failedCount} failed)` : ''}`}
        >
          {isRunning ? <Spinner size={14} /> : <Cpu className="h-4 w-4" />}
          <span
            className={cn(
              'text-xs font-medium',
              allDone &&
                failedCount === 0 &&
                'text-green-600 dark:text-green-400',
              failedCount > 0 && 'text-red-500'
            )}
          >
            {completedCount}/{totalCount}
          </span>
          {failedCount > 0 && (
            <span className="text-xs text-red-500">({failedCount})</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-0 max-h-[500px] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Delegation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalCount}
              {failedCount > 0 && (
                <span className="text-red-500 ml-1">
                  ({failedCount} failed)
                </span>
              )}
            </span>
            {onClose && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  setOpen(false)
                }}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Dismiss delegation"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Current task info */}
        {isRunning && progress.currentProvider && (
          <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2 text-xs">
              <Spinner size={12} />
              <span>
                Task {progress.currentTaskIndex + 1}/{progress.totalTasks}
              </span>
              <ProviderBadge
                provider={progress.currentProvider as AiCliProvider}
              />
              {progress.currentModel && (
                <span className="text-muted-foreground truncate">
                  {getModelLabel(progress.currentModel)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Streaming output */}
        {isRunning && progress.output && (
          <div className="px-3 py-2 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Terminal className="h-3 w-3" />
              <span>Output</span>
            </div>
            <ScrollArea className="h-20">
              <pre className="whitespace-pre-wrap font-mono text-xs text-foreground/70">
                {progress.output}
              </pre>
            </ScrollArea>
          </div>
        )}

        {/* Task list */}
        <ScrollArea className="flex-1 max-h-64">
          <div className="p-2">
            <ul className="space-y-1">
              {delegatedTasks.map((task, index) => (
                <DelegationTaskItem
                  key={task.id}
                  task={task}
                  index={index}
                  isActive={progress?.currentTaskId === task.id}
                />
              ))}
            </ul>
          </div>
        </ScrollArea>

        {/* Task count indicator for many tasks */}
        {delegatedTasks.length > 10 && (
          <div className="text-xs text-muted-foreground px-3 py-1.5 border-t border-border/50 text-center">
            {delegatedTasks.length} total tasks
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

interface DelegationTaskItemProps {
  task: DelegatedTask
  index: number
  isActive: boolean
}

function DelegationTaskItem({
  task,
  index,
  isActive,
}: DelegationTaskItemProps) {
  return (
    <li
      className={cn(
        'flex items-start gap-2 py-1.5 px-2 rounded text-sm',
        isActive && 'bg-blue-500/10'
      )}
    >
      {/* Status icon */}
      <span className="mt-0.5 shrink-0">
        {task.status === 'completed' ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : task.status === 'failed' ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : task.status === 'in_progress' ? (
          <Spinner size={16} />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/50" />
        )}
      </span>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-mono">
            {index + 1}.
          </span>
          <ProviderBadge
            provider={task.assignedProvider as AiCliProvider}
            size="sm"
          />
        </div>
        <p
          className={cn(
            'text-xs text-muted-foreground mt-0.5 line-clamp-2',
            task.status === 'completed' &&
              'line-through text-muted-foreground/60',
            task.status === 'failed' && 'text-red-500/80'
          )}
        >
          {task.description}
        </p>
        {task.error && (
          <p className="text-xs text-red-500 mt-0.5 line-clamp-1">
            {task.error}
          </p>
        )}
      </div>
    </li>
  )
}

function ProviderBadge({
  provider,
  size = 'default',
}: {
  provider: AiCliProvider
  size?: 'sm' | 'default'
}) {
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'

  const config = {
    claude: {
      icon: SiClaude,
      label: 'Claude',
      className: 'bg-orange-500/20 text-orange-600',
    },
    gemini: {
      icon: RiGeminiFill,
      label: 'Gemini',
      className: 'bg-blue-500/20 text-blue-600',
    },
    codex: {
      icon: SiOpenai,
      label: 'Codex',
      className: 'bg-green-500/20 text-green-600',
    },
    kimi: {
      icon: Cpu,
      label: 'Kimi',
      className: 'bg-purple-500/20 text-purple-600',
    },
  }[provider] ?? {
    icon: Cpu,
    label: provider,
    className: 'bg-gray-500/20 text-gray-600',
  }

  const Icon = config.icon

  return (
    <Badge
      variant="secondary"
      className={cn('text-xs py-0 px-1', config.className)}
    >
      <Icon className={cn(iconSize, 'mr-0.5')} />
      {size === 'default' && config.label}
    </Badge>
  )
}
