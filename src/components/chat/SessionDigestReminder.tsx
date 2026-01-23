import { memo } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { useChatStore } from '@/store/chat-store'
import { usePreferences } from '@/services/preferences'

interface SessionDigestReminderProps {
  sessionId: string
}

/**
 * Floating card in top-right corner of chat window
 * Shows a brief digest of the session when user opens a session that had
 * activity while out of focus. The digest is pre-generated in the background
 * when the session completes, so it's ready immediately.
 */
export const SessionDigestReminder = memo(function SessionDigestReminder({
  sessionId,
}: SessionDigestReminderProps) {
  const { data: preferences } = usePreferences()

  // Subscribe to pending digest state and cached digest
  const hasPendingDigest = useChatStore(
    state => state.pendingDigestSessionIds[sessionId] ?? false
  )
  const digest = useChatStore(state => state.sessionDigests[sessionId])

  // Get actions via getState() to avoid render cascades
  const dismiss = () => {
    useChatStore.getState().clearPendingDigest(sessionId)
  }

  // Don't render if session recap is disabled in preferences
  if (preferences?.session_recap_enabled === false) {
    return null
  }

  // Don't render if no pending digest
  if (!hasPendingDigest) {
    return null
  }

  return (
    <div className="absolute right-4 top-4 z-50 w-80 max-w-[calc(100%-2rem)]">
      <div className="rounded-lg border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Session Recap</span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded p-1 hover:bg-muted"
            aria-label="Dismiss reminder"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2 px-3 py-2.5 text-sm">
          {!digest ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating summary...</span>
            </div>
          ) : (
            <>
              <p className="text-foreground">{digest.chat_summary}</p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Just now:</span>{' '}
                {digest.last_action}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
})
