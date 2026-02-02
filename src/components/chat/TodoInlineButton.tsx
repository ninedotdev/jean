import { useState } from 'react'
import {
  CheckCircle2,
  Circle,
  ListTodo,
  XCircle,
  X,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { Todo } from '@/types/chat'
import { cn } from '@/lib/utils'

interface TodoInlineButtonProps {
  todos: Todo[]
  /** Whether the prompt execution is still in progress */
  isStreaming?: boolean
  /** Callback to dismiss the widget */
  onClose?: () => void
}

/**
 * Inline button for toolbar showing task progress
 * Opens a popover with the full task list on click
 */
export function TodoInlineButton({
  todos,
  isStreaming = false,
  onClose,
}: TodoInlineButtonProps) {
  const [open, setOpen] = useState(false)

  const completedCount = todos.filter(t => t.status === 'completed').length
  const totalCount = todos.length
  const hasInProgress = todos.some(t => t.status === 'in_progress')
  const allCompleted = completedCount === totalCount && totalCount > 0 && !isStreaming

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          title={`Tasks: ${completedCount}/${totalCount}`}
        >
          {(isStreaming || hasInProgress) && !allCompleted ? (
            <Spinner size={14} />
          ) : (
            <ListTodo className="h-4 w-4" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              allCompleted && 'text-green-600 dark:text-green-400'
            )}
          >
            {completedCount}/{totalCount}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <span className="text-sm font-medium">Tasks</span>
          {onClose && (
            <button
              type="button"
              onClick={() => {
                onClose()
                setOpen(false)
              }}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Dismiss tasks"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto p-2">
          <ul className="space-y-1">
            {todos.map((todo, index) => (
              <TodoItem key={index} todo={todo} />
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface TodoItemProps {
  todo: Todo
}

function TodoItem({ todo }: TodoItemProps) {
  return (
    <li className="flex items-start gap-2 py-0.5 text-sm">
      <span className="mt-0.5 shrink-0">
        {todo.status === 'completed' ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : todo.status === 'cancelled' ? (
          <XCircle className="h-4 w-4 text-amber-500" />
        ) : todo.status === 'in_progress' ? (
          <Spinner size={16} />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/50" />
        )}
      </span>
      <span
        className={cn(
          'text-muted-foreground',
          todo.status === 'completed' &&
            'line-through text-muted-foreground/60',
          todo.status === 'cancelled' && 'text-muted-foreground/60'
        )}
      >
        {todo.status === 'in_progress' ? todo.activeForm : todo.content}
      </span>
    </li>
  )
}
