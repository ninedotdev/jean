import { memo, useMemo } from 'react'
import { Activity, ChevronDown, AlertCircle } from 'lucide-react'
import { SiClaude } from 'react-icons/si'
import { SiOpenai } from 'react-icons/si'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  useAllProvidersUsage,
  type ProviderUsageSnapshot,
  type ProviderId,
  type RateWindow,
  getProviderDisplayName,
  getUtilizationColor,
} from '@/services/provider-usage'

// Providers to display (only Claude and Codex for now)
const ALL_PROVIDERS: ProviderId[] = ['claude', 'codex']

/**
 * Multi-provider usage dropdown for the sidebar
 * Shows a compact trigger with usage summary, expands to show all providers
 */
export const ProviderUsageSidebar = memo(function ProviderUsageSidebar() {
  const { data: usage, isLoading } = useAllProvidersUsage()

  // Build provider status list
  const providerStatuses = useMemo(() => {
    return ALL_PROVIDERS.map(id => {
      const data = usage?.[id]
      return {
        id,
        data,
        available: data?.available ?? false,
        error: data?.error ?? null,
      }
    })
  }, [usage])

  // Find the highest utilization among available providers for trigger display
  const highestUtilization = useMemo(() => {
    let highest: { id: ProviderId; percent: number } | null = null

    for (const { id, data, available } of providerStatuses) {
      if (available && data?.primary) {
        const percent = data.primary.usedPercent
        if (!highest || percent > highest.percent) {
          highest = { id, percent }
        }
      }
    }

    return highest
  }, [providerStatuses])

  // Count available providers
  const availableCount = providerStatuses.filter(p => p.available).length

  return (
    <div className="flex justify-center px-2 py-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
              'text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              isLoading && 'opacity-50'
            )}
          >
            <Activity className="size-3" />
            {availableCount > 0 && highestUtilization ? (
              <>
                <ProviderIcon
                  providerId={highestUtilization.id}
                  className="size-3"
                />
                <span className={getUtilizationColor(highestUtilization.percent)}>
                  {Math.round(highestUtilization.percent)}%
                </span>
                {availableCount > 1 && (
                  <span className="text-muted-foreground/50">
                    +{availableCount - 1}
                  </span>
                )}
              </>
            ) : (
              <span>Usage</span>
            )}
            <ChevronDown className="size-3 opacity-50" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="center" side="bottom" className="w-72 p-2">
          <TooltipProvider delayDuration={200}>
            <div className="space-y-1">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Provider Usage
              </div>

              {providerStatuses.map(({ id, data, available, error }) => (
                <ProviderRow
                  key={id}
                  providerId={id}
                  data={data}
                  available={available}
                  error={error}
                />
              ))}
            </div>
          </TooltipProvider>
        </PopoverContent>
      </Popover>
    </div>
  )
})

interface ProviderRowProps {
  providerId: ProviderId
  data: ProviderUsageSnapshot | null | undefined
  available: boolean
  error: string | null
}

function ProviderRow({ providerId, data, available, error }: ProviderRowProps) {
  const primary = data?.primary
  const secondary = data?.secondary

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5',
        'text-sm transition-colors',
        available ? 'text-foreground' : 'text-muted-foreground/50'
      )}
    >
      {/* Provider icon */}
      <ProviderIcon
        providerId={providerId}
        className={cn('size-4 shrink-0', available ? '' : 'opacity-50')}
      />

      {/* Provider name */}
      <span className="w-14 shrink-0 font-medium">
        {getProviderDisplayName(providerId)}
      </span>

      {/* Status/Usage */}
      {available && primary ? (
        <div className="flex flex-1 items-center justify-end gap-2 text-xs">
          {/* Session/Primary window */}
          <WindowBadge window={primary} label="session" />

          {/* Weekly/Secondary window */}
          {secondary && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <WindowBadge window={secondary} label="weekly" />
            </>
          )}
        </div>
      ) : error ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-1 items-center justify-end gap-1 text-xs text-yellow-500">
              <AlertCircle className="size-3" />
              <span>Error</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs text-xs">
            {error}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className="flex-1 text-right text-xs text-muted-foreground/50">
          Not logged in
        </span>
      )}
    </div>
  )
}

interface WindowBadgeProps {
  window: RateWindow
  label: string
}

function WindowBadge({ window: w, label }: WindowBadgeProps) {
  const utilizationColor = getUtilizationColor(w.usedPercent)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-0.5 cursor-default">
          <span className={utilizationColor}>
            {Math.round(w.usedPercent)}%
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="space-y-0.5">
          <div className="font-medium capitalize">{label}</div>
          <div>Used: {w.usedPercent.toFixed(1)}%</div>
          {w.resetDescription && <div>Resets: {w.resetDescription}</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

interface ProviderIconProps {
  providerId: ProviderId
  className?: string
}

function ProviderIcon({ providerId, className }: ProviderIconProps) {
  switch (providerId) {
    case 'claude':
      return <SiClaude className={className} />
    case 'codex':
      return <SiOpenai className={className} />
    default:
      return <Activity className={className} />
  }
}
