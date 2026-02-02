import type { ToolCall } from '@/types/chat'
import { isAskUserQuestion, isExitPlanMode } from '@/types/chat'
import { Kbd } from '@/components/ui/kbd'

interface ExitPlanModeButtonProps {
  toolCalls: ToolCall[] | undefined
  /** Whether the plan has been approved (from message.plan_approved) */
  isApproved: boolean
  /** Whether this is the latest message with ExitPlanMode (only latest shows Approve button) */
  isLatestPlanRequest?: boolean
  /** Whether a user message follows this plan (means user sent a new message instead of approving) */
  hasFollowUpMessage?: boolean
  onPlanApproval?: () => void
  /** Callback for approving with yolo mode (auto-approve all future tools) */
  onPlanApprovalYolo?: () => void
  /** Ref to attach to the approve button for visibility tracking */
  buttonRef?: React.RefObject<HTMLButtonElement | null>
  /** Keyboard shortcut to display on the button */
  shortcut?: string
}

/**
 * Minimal inline plan approval component
 * Rendered separately from ToolCallsDisplay so it appears after content
 * Also displays the plan file content if a Write to ~/.claude/plans/*.md was found
 *
 * Note: Not memoized - the component is lightweight and memoization was causing
 * callback prop issues where stale undefined callbacks would be captured
 */
export function ExitPlanModeButton({
  toolCalls,
  isApproved,
  isLatestPlanRequest = true,
  hasFollowUpMessage = false,
  onPlanApproval,
  onPlanApprovalYolo,
  buttonRef,
  shortcut,
}: ExitPlanModeButtonProps) {
  if (!toolCalls) return null

  const exitPlanTools = toolCalls.filter(isExitPlanMode)

  // Use last tool (Claude may call ExitPlanMode multiple times)
  const tool = exitPlanTools[exitPlanTools.length - 1]
  if (!tool) return null

  // Don't show approve button if there are questions to answer first
  const hasQuestions = toolCalls.some(isAskUserQuestion)
  if (hasQuestions && !isApproved) return null

  // Don't show button if already approved, not latest, or has follow-up
  if (isApproved || !isLatestPlanRequest || hasFollowUpMessage) return null

  // Minimal inline approval
  return (
    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/30">
      <span className="flex items-center gap-1.5 text-xs text-yellow-500/80">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500/80" />
        <span className="font-medium">Plan ready</span>
      </span>
      <div className="flex-1" />
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onPlanApproval?.()}
        className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
      >
        Approve
        {shortcut && (
          <Kbd className="ml-1.5 h-4 text-[10px] bg-primary-foreground/20 text-primary-foreground">
            {shortcut}
          </Kbd>
        )}
      </button>
      <button
        type="button"
        onClick={() => onPlanApprovalYolo?.()}
        className="px-2 py-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
      >
        Yolo
      </button>
    </div>
  )
}
