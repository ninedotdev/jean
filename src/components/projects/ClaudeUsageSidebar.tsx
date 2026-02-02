import { memo } from 'react'
import { Activity } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  useClaudeUsageLimits,
  formatResetTime,
  formatPacingDelta,
  getPacingDeltaColor,
} from '@/services/claude-usage'

/**
 * Compact Claude usage display for the sidebar
 * Shows rate limits (5-hour and 7-day) when credentials are available
 */
export const ClaudeUsageSidebar = memo(function ClaudeUsageSidebar() {
  const { data: limits, isLoading, error } = useClaudeUsageLimits()

  // Don't render if loading, error, or no limits data
  if (isLoading || error || !limits) {
    return null
  }

  const fiveHour = limits.fiveHour
  const sevenDay = limits.sevenDay

  // Don't show if no limits available (not authenticated)
  if (!fiveHour && !sevenDay) {
    return null
  }

  // Show weekly only if 5-hour limit is >= 90%
  const showWeekly = fiveHour && fiveHour.utilization >= 90

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground">
        <Activity className="size-3 shrink-0" />

        {/* 5-hour limit */}
        {fiveHour && (
          <LimitBadge
            label="5h"
            limit={fiveHour}
            showPacingDelta={false}
            totalHours={5}
          />
        )}

        {/* 7-day limit - only when L >= 90% */}
        {showWeekly && sevenDay && (
          <>
            <span className="text-muted-foreground/30">/</span>
            <LimitBadge
              label="7d"
              limit={sevenDay}
              showPacingDelta
              totalHours={168}
            />
          </>
        )}
      </div>
    </TooltipProvider>
  )
})

interface LimitBadgeProps {
  label: string
  limit: {
    utilization: number
    resetsAt: string | null
  }
  showPacingDelta: boolean
  totalHours: number
}

/** Compact limit badge with tooltip */
function LimitBadge({ label, limit, showPacingDelta, totalHours }: LimitBadgeProps) {
  const utilizationColor = getUtilizationColor(limit.utilization)
  const pacingDelta = showPacingDelta && limit.resetsAt
    ? formatPacingDelta(limit.utilization, limit.resetsAt)
    : null
  const pacingDeltaNum = showPacingDelta && limit.resetsAt
    ? limit.utilization - getTimeElapsedPercent(limit.resetsAt, totalHours)
    : 0

  const labelFull = label === '5h' ? '5-hour limit' : '7-day limit'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-0.5 cursor-default">
          <span className="text-muted-foreground/60">{label}:</span>
          <span className={utilizationColor}>
            {Math.round(limit.utilization)}%
          </span>
          {pacingDelta && (
            <span className={cn('text-[9px]', getPacingDeltaColor(pacingDeltaNum))}>
              ({pacingDelta})
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        <div className="space-y-1">
          <div className="font-medium">{labelFull}</div>
          <div>
            Utilization: {limit.utilization.toFixed(1)}%
          </div>
          {limit.resetsAt && (
            <div>
              Resets in: {formatResetTime(limit.resetsAt)}
            </div>
          )}
          {showPacingDelta && pacingDelta && (
            <div className={getPacingDeltaColor(pacingDeltaNum)}>
              Pacing: {pacingDelta} {pacingDeltaNum >= 0 ? '(ahead)' : '(behind)'}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/** Get color class based on utilization */
function getUtilizationColor(utilization: number): string {
  if (utilization >= 90) return 'text-red-500'
  if (utilization >= 70) return 'text-yellow-500'
  if (utilization >= 50) return 'text-orange-500'
  return 'text-muted-foreground'
}

/** Calculate time elapsed percent for pacing delta */
function getTimeElapsedPercent(resetsAt: string, totalHours: number): number {
  const resetDate = new Date(resetsAt)
  const now = new Date()
  const diffMs = resetDate.getTime() - now.getTime()
  const hoursRemaining = Math.max(0, diffMs / 3600000)
  return ((totalHours - hoursRemaining) / totalHours) * 100
}
