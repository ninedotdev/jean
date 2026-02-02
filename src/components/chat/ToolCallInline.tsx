import {
  FileText,
  Edit,
  PenLine,
  Terminal,
  Search,
  Folder,
  Globe,
  Bot,
  Brain,
} from 'lucide-react'
import type { ToolCall } from '@/types/chat'
import type { StackableItem } from './tool-call-utils'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { getFilename } from '@/lib/path-utils'

interface ToolCallInlineProps {
  toolCall: ToolCall
  className?: string
  /** Callback when a file path is clicked (for Read/Edit/Write tools) */
  onFileClick?: (filePath: string) => void
  /** Whether the message is currently streaming */
  isStreaming?: boolean
  /** Whether this is the last incomplete item (shows spinner only on last) */
  isLastIncomplete?: boolean
}

/**
 * Terminal-like inline display for a single tool call
 * Renders as: > ToolName detail
 */
export function ToolCallInline({
  toolCall,
  className,
  onFileClick,
  isStreaming,
  isLastIncomplete,
}: ToolCallInlineProps) {
  const { label, detail, filePath } = getToolDisplay(toolCall)

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs text-muted-foreground/70 py-0.5',
        className
      )}
    >
      <span className="text-muted-foreground/50 select-none">{'>'}</span>
      <span className="font-medium">{label}</span>
      {detail &&
        (filePath && onFileClick ? (
          <button
            type="button"
            onClick={() => onFileClick(filePath)}
            className="truncate hover:text-primary transition-colors font-mono text-muted-foreground/60 hover:underline"
          >
            {detail}
          </button>
        ) : (
          <span className="truncate font-mono text-muted-foreground/60">
            {detail}
          </span>
        ))}
      {isStreaming && isLastIncomplete && (
        <Spinner size={10} className="ml-auto" />
      )}
    </div>
  )
}

interface TaskCallInlineProps {
  taskToolCall: ToolCall
  subToolCalls: ToolCall[]
  className?: string
  /** Callback when a file path is clicked (for Read/Edit/Write tools) */
  onFileClick?: (filePath: string) => void
  /** Whether the message is currently streaming */
  isStreaming?: boolean
  /** Whether this is the last incomplete item (shows spinner only on last) */
  isLastIncomplete?: boolean
}

/**
 * Terminal-like inline display for Task tool calls with nested sub-tools
 * Shows the Task header and indented sub-tool calls
 */
export function TaskCallInline({
  taskToolCall,
  subToolCalls,
  className,
  onFileClick,
  isStreaming,
  isLastIncomplete,
}: TaskCallInlineProps) {
  const input = taskToolCall.input as Record<string, unknown>
  const subagentType = input.subagent_type as string | undefined
  const description = input.description as string | undefined

  return (
    <div className={cn('space-y-0.5', className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 py-0.5">
        <span className="text-muted-foreground/50 select-none">{'>'}</span>
        <Bot className="h-3 w-3 shrink-0" />
        <span className="font-medium">
          {subagentType ? `Task (${subagentType})` : 'Task'}
        </span>
        {description && (
          <span className="truncate text-muted-foreground/60">
            {description}
          </span>
        )}
        {isStreaming && isLastIncomplete && subToolCalls.length === 0 && (
          <Spinner size={10} className="ml-auto" />
        )}
      </div>
      {/* Sub-tools indented */}
      {subToolCalls.length > 0 && (
        <div className="pl-4 space-y-0.5">
          {subToolCalls.map((subTool, index) => (
            <SubToolInline
              key={subTool.id}
              toolCall={subTool}
              onFileClick={onFileClick}
              isStreaming={isStreaming}
              isLastIncomplete={
                isLastIncomplete && index === subToolCalls.length - 1
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface StackedGroupProps {
  items: StackableItem[]
  className?: string
  onFileClick?: (filePath: string) => void
  /** Whether the message is currently streaming */
  isStreaming?: boolean
  /** Whether this is the last incomplete item (shows spinner only on last) */
  isLastIncomplete?: boolean
}

/**
 * Simple container for multiple stacked items (thinking + tools)
 * Renders each item inline with no card wrapper
 */
export function StackedGroup({
  items,
  className,
  onFileClick,
  isStreaming,
  isLastIncomplete,
}: StackedGroupProps) {
  return (
    <div className={cn('space-y-0.5', className)}>
      {items.map((item, index) =>
        item.type === 'thinking' ? (
          <ThinkingInline
            key={`thinking-${index}`}
            thinking={item.thinking}
            isStreaming={isStreaming && isLastIncomplete && index === items.length - 1}
          />
        ) : (
          <SubToolInline
            key={item.tool.id}
            toolCall={item.tool}
            onFileClick={onFileClick}
            isStreaming={isStreaming}
            isLastIncomplete={isLastIncomplete && index === items.length - 1}
          />
        )
      )}
    </div>
  )
}

interface ThinkingInlineProps {
  thinking: string
  isStreaming?: boolean
}

/**
 * Inline thinking display used within StackedGroup
 * Renders as: > Thinking "truncated..."
 */
function ThinkingInline({ thinking, isStreaming }: ThinkingInlineProps) {
  // Truncate thinking for inline display
  const truncated =
    thinking.length > 60 ? thinking.slice(0, 60).trim() + '...' : thinking.trim()

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 py-0.5">
      <span className="text-purple-400/60 select-none">{'>'}</span>
      <Brain className="h-3 w-3 text-purple-400/50 shrink-0" />
      <span className="italic truncate text-muted-foreground/50">
        &ldquo;{truncated}&rdquo;
      </span>
      {isStreaming && (
        <span className="h-1 w-1 rounded-full bg-purple-400/50 animate-pulse ml-auto" />
      )}
    </div>
  )
}

interface SubToolInlineProps {
  toolCall: ToolCall
  onFileClick?: (filePath: string) => void
  isStreaming?: boolean
  isLastIncomplete?: boolean
}

/**
 * Compact sub-tool item displayed within a Task or StackedGroup
 * Terminal-like inline format: > ToolName detail
 */
function SubToolInline({
  toolCall,
  onFileClick,
  isStreaming,
  isLastIncomplete,
}: SubToolInlineProps) {
  const { label, detail, filePath } = getToolDisplay(toolCall)

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 py-0.5">
      <span className="text-muted-foreground/40 select-none">{'>'}</span>
      <span className="font-medium">{label}</span>
      {detail &&
        (filePath && onFileClick ? (
          <button
            type="button"
            onClick={() => onFileClick(filePath)}
            className="truncate hover:text-primary transition-colors font-mono text-muted-foreground/50 hover:underline"
          >
            {detail}
          </button>
        ) : (
          <span className="truncate font-mono text-muted-foreground/50">
            {detail}
          </span>
        ))}
      {isStreaming && isLastIncomplete && (
        <Spinner size={10} className="ml-auto" />
      )}
    </div>
  )
}

interface ToolDisplay {
  icon: React.ReactNode
  label: string
  detail?: string
  /** Full file path for file-related tools (Read, Edit, Write) */
  filePath?: string
}

function getToolDisplay(toolCall: ToolCall): ToolDisplay {
  const input = toolCall.input as Record<string, unknown>

  switch (toolCall.name) {
    case 'Read': {
      const filePath = input.file_path as string | undefined
      const filename = filePath ? getFilename(filePath) : filePath
      return {
        icon: <FileText className="h-3 w-3 shrink-0" />,
        label: 'Read',
        detail: filename,
        filePath,
      }
    }

    case 'Edit': {
      const filePath = input.file_path as string | undefined
      const filename = filePath ? getFilename(filePath) : filePath
      return {
        icon: <Edit className="h-3 w-3 shrink-0" />,
        label: 'Edit',
        detail: filename,
        filePath,
      }
    }

    case 'Write': {
      const filePath = input.file_path as string | undefined
      const filename = filePath ? getFilename(filePath) : filePath
      return {
        icon: <PenLine className="h-3 w-3 shrink-0" />,
        label: 'Write',
        detail: filename,
        filePath,
      }
    }

    case 'Bash': {
      const command = input.command as string | undefined
      // Truncate long commands for display
      const truncatedCommand =
        command && command.length > 50
          ? command.substring(0, 50) + '...'
          : command
      return {
        icon: <Terminal className="h-3 w-3 shrink-0" />,
        label: 'Bash',
        detail: truncatedCommand,
      }
    }

    case 'Grep': {
      const pattern = input.pattern as string | undefined
      const path = input.path as string | undefined
      return {
        icon: <Search className="h-3 w-3 shrink-0" />,
        label: 'Grep',
        detail: pattern
          ? `"${pattern}"${path ? ` in ${path}` : ''}`
          : undefined,
      }
    }

    case 'Glob': {
      const pattern = input.pattern as string | undefined
      return {
        icon: <Folder className="h-3 w-3 shrink-0" />,
        label: 'Glob',
        detail: pattern,
      }
    }

    case 'Task': {
      const subagentType = input.subagent_type as string | undefined
      const description = input.description as string | undefined
      return {
        icon: <Bot className="h-3 w-3 shrink-0" />,
        label: subagentType ? `Task (${subagentType})` : 'Task',
        detail: description,
      }
    }

    case 'WebFetch':
    case 'WebSearch': {
      const url = input.url as string | undefined
      const query = input.query as string | undefined
      return {
        icon: <Globe className="h-3 w-3 shrink-0" />,
        label: toolCall.name,
        detail: url ?? query,
      }
    }

    default:
      return {
        icon: <Terminal className="h-3 w-3 shrink-0" />,
        label: toolCall.name,
        detail: undefined,
      }
  }
}
