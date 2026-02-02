import { cn } from '@/lib/utils'
import { MacOSWindowControls } from './MacOSWindowControls'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUIStore } from '@/store/ui-store'
import { executeCommand, useCommandContext } from '@/lib/commands'
import {
  PanelLeft,
  PanelLeftClose,
  Settings,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { usePreferences } from '@/services/preferences'
import { formatShortcutDisplay, DEFAULT_KEYBINDINGS } from '@/types/keybindings'

interface TitleBarProps {
  className?: string
  title?: string
  context?: string
}

export function TitleBar({
  className,
  title = 'Jean',
  context,
}: TitleBarProps) {
  const { leftSidebarVisible, toggleLeftSidebar } = useUIStore()
  const commandContext = useCommandContext()
  const { data: preferences } = usePreferences()

  const sidebarShortcut = formatShortcutDisplay(
    (preferences?.keybindings?.toggle_left_sidebar ||
      DEFAULT_KEYBINDINGS.toggle_left_sidebar) as string
  )

  return (
    <div
      data-tauri-drag-region
      className={cn(
        'relative flex h-8 w-full shrink-0 items-center justify-between bg-sidebar',
        className
      )}
    >
      {/* Left side - Window Controls + Left Actions */}
      <div className="flex items-center">
        <MacOSWindowControls />

        {/* Left Action Buttons */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleLeftSidebar}
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-foreground/70 hover:text-foreground"
              >
                {leftSidebarVisible ? (
                  <PanelLeftClose className="h-3 w-3" />
                ) : (
                  <PanelLeft className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {leftSidebarVisible ? 'Hide' : 'Show'} Left Sidebar{' '}
              <kbd className="ml-1 text-[0.625rem] opacity-60">
                {sidebarShortcut}
              </kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => executeCommand('open-preferences', commandContext)}
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-foreground/70 hover:text-foreground"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Settings <kbd className="ml-1 text-[0.625rem] opacity-60">⌘,</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Center - Title + Context */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
        {/* Title */}
        <span className="max-w-[300px] truncate text-sm font-medium text-foreground/80">
          {title}
        </span>

        {/* Context Indicator */}
        {context && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner size={12} />
            <span className="max-w-[200px] truncate">{context}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default TitleBar
