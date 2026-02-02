import { ScrollArea } from '@/components/ui/scroll-area'
import { usePrStatus } from '@/services/pr-status'
import { CheckCircle2, XCircle, Circle, Clock } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface CIChecksPanelProps {
  worktreeId: string
}

interface CheckItemProps {
  name: string
  status: 'success' | 'failure' | 'pending' | 'neutral'
}

function CheckItem({ name, status }: CheckItemProps) {
  const icon = {
    success: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    failure: <XCircle className="h-3.5 w-3.5 text-red-500" />,
    pending: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
    neutral: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  }[status]

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/50',
        'cursor-pointer transition-colors'
      )}
    >
      {icon}
      <span className="truncate text-foreground">{name}</span>
    </div>
  )
}

export function CIChecksPanel({ worktreeId }: CIChecksPanelProps) {
  const { data: prStatus, isLoading, isError } = usePrStatus(worktreeId)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={20} />
      </div>
    )
  }

  if (isError || !prStatus) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        No PR found for this worktree
      </div>
    )
  }

  if (!prStatus.check_status) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        No checks configured
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="py-2">
        <div className="mb-2 px-3 py-1 text-xs font-semibold text-muted-foreground">
          Check Status: {prStatus.check_status}
        </div>

        <div className="space-y-0.5">
          {/* Placeholder - real check list would come from backend */}
          {prStatus.check_status === 'success' && (
            <CheckItem name="All checks passed" status="success" />
          )}
          {prStatus.check_status === 'failure' && (
            <CheckItem name="Some checks failed" status="failure" />
          )}
          {prStatus.check_status === 'pending' && (
            <CheckItem name="Checks in progress" status="pending" />
          )}
        </div>

        <div className="mt-4 px-3 text-xs text-muted-foreground/70">
          Detailed checks coming soon
        </div>
      </div>
    </ScrollArea>
  )
}
