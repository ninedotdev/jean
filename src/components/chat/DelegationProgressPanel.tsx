import { memo, useState } from 'react'
import { useChatStore, type DelegationProgress } from '@/store/chat-store'
import type { DelegatedTask } from '@/types/chat'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Cpu,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// PERFORMANCE: Stable empty array reference to prevent infinite render loops
const EMPTY_DELEGATED_TASKS: DelegatedTask[] = []

/** Simple progress bar component */
function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

interface DelegationProgressPanelProps {
  sessionId: string
}

/** Get status icon and color for a task */
function getTaskStatusConfig(status: DelegatedTask['status']) {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle2,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
      }
    case 'failed':
      return {
        icon: XCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
      }
    case 'in_progress':
      return {
        icon: Loader2,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        animate: true,
      }
    default:
      return {
        icon: Clock,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/10',
      }
  }
}

/** Get provider display name and color */
function getProviderConfig(provider: string) {
  switch (provider.toLowerCase()) {
    case 'claude':
      return { name: 'Claude', color: 'bg-orange-500/20 text-orange-600' }
    case 'gemini':
      return { name: 'Gemini', color: 'bg-blue-500/20 text-blue-600' }
    case 'codex':
    case 'openai':
      return { name: 'Codex', color: 'bg-green-500/20 text-green-600' }
    default:
      return { name: provider, color: 'bg-gray-500/20 text-gray-600' }
  }
}

/** Individual task item in the progress list */
const TaskItem = memo(function TaskItem({
  task,
  index,
  isActive,
}: {
  task: DelegatedTask
  index: number
  isActive: boolean
}) {
  const statusConfig = getTaskStatusConfig(task.status)
  const providerConfig = getProviderConfig(task.assignedProvider)
  const StatusIcon = statusConfig.icon

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        isActive && 'border-blue-500/50 bg-blue-500/5',
        !isActive && 'border-border/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
            statusConfig.bgColor
          )}
        >
          <StatusIcon
            className={cn(
              'h-4 w-4',
              statusConfig.color,
              statusConfig.animate && 'animate-spin'
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Task {index + 1}
            </span>
            <Badge variant="outline" className={cn('text-xs', providerConfig.color)}>
              {providerConfig.name}
            </Badge>
            {task.assignedModel && (
              <span className="text-xs text-muted-foreground">
                {task.assignedModel}
              </span>
            )}
          </div>

          <p className="mt-1 text-sm">{task.description}</p>

          {task.error && (
            <p className="mt-2 text-xs text-red-500">{task.error}</p>
          )}
        </div>
      </div>
    </div>
  )
})

/** Streaming output display */
const OutputDisplay = memo(function OutputDisplay({
  output,
}: {
  output: string
}) {
  if (!output.trim()) return null

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Terminal className="h-3 w-3" />
        <span>Output</span>
      </div>
      <ScrollArea className="h-32">
        <pre className="whitespace-pre-wrap font-mono text-xs text-foreground/80">
          {output}
        </pre>
      </ScrollArea>
    </div>
  )
})

export const DelegationProgressPanel = memo(function DelegationProgressPanel({
  sessionId,
}: DelegationProgressPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Subscribe to delegation tasks and progress for this session
  // PERFORMANCE: Use stable empty array constant to prevent infinite render loops
  const delegatedTasks = useChatStore(
    state => state.delegatedTasks[sessionId] ?? EMPTY_DELEGATED_TASKS
  )
  const progress = useChatStore(
    state => state.delegationProgress[sessionId]
  ) as DelegationProgress | undefined

  if (delegatedTasks.length === 0) {
    return null
  }

  const completedCount = delegatedTasks.filter(
    t => t.status === 'completed'
  ).length
  const failedCount = delegatedTasks.filter(t => t.status === 'failed').length
  const totalCount = delegatedTasks.length
  const progressPercent =
    totalCount > 0 ? ((completedCount + failedCount) / totalCount) * 100 : 0

  const isRunning = progress !== undefined
  const ChevronIcon = isExpanded ? ChevronDown : ChevronUp

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-sm shadow-sm">
        {/* Collapsed header - always visible, clickable to expand */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors rounded-lg"
          >
            {/* Status indicator */}
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
            ) : (
              <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
            )}

            {/* Progress bar - inline */}
            <div className="flex-1 min-w-0">
              <ProgressBar value={progressPercent} className="h-1.5" />
            </div>

            {/* Status text */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              {isRunning && progress.currentProvider && (
                <span className="hidden sm:inline">
                  Task {progress.currentTaskIndex + 1}/{progress.totalTasks}
                </span>
              )}
              <span>
                {completedCount}/{totalCount}
              </span>
              {failedCount > 0 && (
                <span className="text-red-500">{failedCount} failed</span>
              )}
              <ChevronIcon className="h-4 w-4" />
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="border-t border-border/50">
            <ScrollArea className="max-h-80">
              <div className="px-3 py-3 space-y-3">
                {/* Current task info */}
                {isRunning && progress.currentProvider && (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span>
                      Running task {progress.currentTaskIndex + 1}/{progress.totalTasks}{' '}
                      with {progress.currentProvider}
                      {progress.currentModel && ` (${progress.currentModel})`}
                    </span>
                  </div>
                )}

                {/* Streaming output */}
                {isRunning && progress.output && <OutputDisplay output={progress.output} />}

                {/* Task list */}
                <div className="flex flex-col gap-2">
                  {delegatedTasks.map((task, index) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      index={index}
                      isActive={progress?.currentTaskId === task.id}
                    />
                  ))}
                </div>
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
})
