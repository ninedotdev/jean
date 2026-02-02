import { cn } from '@/lib/utils'
import {
  Circle,
  MessageCircleQuestion,
  FileQuestion,
  Eye,
  Sparkles,
  Zap,
} from 'lucide-react'

export type StatusBarStatus =
  | 'idle'
  | 'waiting'
  | 'planning'
  | 'vibing'
  | 'yoloing'
  | 'review'

interface StatusConfig {
  icon: React.ReactNode
  label: string
  color: string
  bgColor: string
}

const STATUS_CONFIG: Record<StatusBarStatus, StatusConfig> = {
  idle: {
    icon: <Circle className="h-3 w-3" />,
    label: 'Idle',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
  },
  waiting: {
    icon: <MessageCircleQuestion className="h-3 w-3" />,
    label: 'Waiting',
    color: 'text-yellow-500 animate-pulse',
    bgColor: 'bg-yellow-500/10',
  },
  planning: {
    icon: <FileQuestion className="h-3 w-3" />,
    label: 'Planning',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  vibing: {
    icon: <Sparkles className="h-3 w-3" />,
    label: 'Vibing',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  yoloing: {
    icon: <Zap className="h-3 w-3" />,
    label: 'Yoloing',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  review: {
    icon: <Eye className="h-3 w-3" />,
    label: 'Review',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
}

interface StatusSelectProps {
  status: StatusBarStatus
}

function StatusSelect({ status }: StatusSelectProps) {
  const config = STATUS_CONFIG[status]
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        config.bgColor,
        config.color
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  )
}

interface StatusBarProps {
  className?: string
  status?: StatusBarStatus
}

export function StatusBar({
  className,
  status = 'idle',
}: StatusBarProps) {
  return (
    <div
      className={cn(
        'flex h-7 w-full shrink-0 items-center justify-center border-b border-border/30 bg-sidebar/50',
        className
      )}
    >
      <StatusSelect status={status} />
    </div>
  )
}

export default StatusBar
