import { useMemo, useCallback, useRef } from 'react'
import { TitleBar } from '@/components/titlebar/TitleBar'
import { DevModeBanner } from './DevModeBanner'
import { LeftSideBar } from './LeftSideBar'
import { RightSideBar } from './RightSideBar'
import { SidebarWidthProvider } from './SidebarWidthContext'
import { MainWindowContent } from './MainWindowContent'
import { CommandPalette } from '@/components/command-palette/CommandPalette'
import { PreferencesDialog } from '@/components/preferences/PreferencesDialog'
import { CommitModal } from '@/components/commit/CommitModal'
import { OnboardingDialog } from '@/components/onboarding/OnboardingDialog'
import { CliUpdateModal } from '@/components/layout/CliUpdateModal'
import { CliLoginModal } from '@/components/preferences/CliLoginModal'
import { OpenInModal } from '@/components/open-in/OpenInModal'
import { MagicModal } from '@/components/magic/MagicModal'
import { CheckoutPRModal } from '@/components/magic/CheckoutPRModal'
import { NewWorktreeModal } from '@/components/worktree/NewWorktreeModal'
import { PathConflictModal } from '@/components/worktree/PathConflictModal'
import { BranchConflictModal } from '@/components/worktree/BranchConflictModal'
import { SessionBoardModal } from '@/components/session-board'
import { GitInitModal } from '@/components/projects/GitInitModal'
import { CloneRepoModal } from '@/components/projects/CloneRepoModal'
import { QuitConfirmationDialog } from './QuitConfirmationDialog'
import { Toaster } from '@/components/ui/sonner'
import { useUIStore } from '@/store/ui-store'
import { useProjectsStore } from '@/store/projects-store'
import { useMainWindowEventListeners } from '@/hooks/useMainWindowEventListeners'
import { useCloseSessionOrWorktreeKeybinding } from '@/services/chat'
import { useUIStatePersistence } from '@/hooks/useUIStatePersistence'
import { useSessionStatePersistence } from '@/hooks/useSessionStatePersistence'
import { useRestoreLastArchived } from '@/hooks/useRestoreLastArchived'
import { useArchiveCleanup } from '@/hooks/useArchiveCleanup'
import {
  useAppFocusTracking,
  useGitStatusEvents,
  useWorktreePolling,
  type WorktreePollingInfo,
} from '@/services/git-status'
import { useWorktree, useProjects, useCreateWorktreeKeybinding, useWorktreeEvents } from '@/services/projects'
import { usePreferences } from '@/services/preferences'
import { useSessions } from '@/services/chat'
import { useChatStore } from '@/store/chat-store'

// Left sidebar resize constraints (pixels)
const MIN_SIDEBAR_WIDTH = 150
const MAX_SIDEBAR_WIDTH = 500

// Right sidebar resize constraints (pixels)
const MIN_RIGHT_SIDEBAR_WIDTH = 200
const MAX_RIGHT_SIDEBAR_WIDTH = 600

export function MainWindow() {
  const leftSidebarVisible = useUIStore(state => state.leftSidebarVisible)
  const leftSidebarSize = useUIStore(state => state.leftSidebarSize)
  const setLeftSidebarSize = useUIStore(state => state.setLeftSidebarSize)
  const rightSidebarVisible = useUIStore(state => state.rightSidebarVisible)
  const rightSidebarSize = useUIStore(state => state.rightSidebarSize)
  const setRightSidebarSize = useUIStore(state => state.setRightSidebarSize)
  const selectedWorktreeId = useProjectsStore(state => state.selectedWorktreeId)

  // Fetch worktree data for polling initialization
  const { data: worktree } = useWorktree(selectedWorktreeId ?? null)
  const { data: projects } = useProjects()
  const project = worktree
    ? projects?.find(p => p.id === worktree.project_id)
    : null

  // Fetch preferences and session data for title
  const { data: preferences } = usePreferences()
  const { data: sessionsData } = useSessions(selectedWorktreeId ?? null, worktree?.path ?? null)
  const activeSessionId = useChatStore(state =>
    selectedWorktreeId ? state.activeSessionIds[selectedWorktreeId] : undefined
  )

  // Find active session name
  const activeSessionName = useMemo(() => {
    if (!sessionsData?.sessions || !activeSessionId) return undefined
    return sessionsData.sessions.find(s => s.id === activeSessionId)?.name
  }, [sessionsData?.sessions, activeSessionId])

  // Compute window title based on selected project/worktree
  const windowTitle = useMemo(() => {
    if (!project || !worktree) return 'Jean'
    const branchSuffix = worktree.branch !== worktree.name ? ` (${worktree.branch})` : ''

    // Add session name when grouping enabled
    if (preferences?.session_grouping_enabled && activeSessionName) {
      return `${project.name} › ${worktree.name} › ${activeSessionName}`
    }

    return `${project.name} › ${worktree.name}${branchSuffix}`
  }, [project, worktree, preferences?.session_grouping_enabled, activeSessionName])

  // Compute polling info - null if no worktree or data not loaded
  const pollingInfo: WorktreePollingInfo | null = useMemo(() => {
    if (!worktree || !project) return null
    return {
      worktreeId: worktree.id,
      worktreePath: worktree.path,
      baseBranch: project.default_branch ?? 'main',
      prNumber: worktree.pr_number,
      prUrl: worktree.pr_url,
    }
  }, [worktree, project])

  // Initialize polling for active worktree (handles startup & worktree changes)
  useWorktreePolling(pollingInfo)

  // Persist UI state (last opened worktree, expanded projects)
  const { isInitialized } = useUIStatePersistence()

  // Persist session-specific state (answered questions, fixed findings, etc.)
  useSessionStatePersistence()

  // Refs for the sidebar elements to update width directly during drag
  const sidebarRef = useRef<HTMLDivElement>(null)
  const rightSidebarRef = useRef<HTMLDivElement>(null)

  // Debug: log sidebar state on each render
  console.log('[MainWindow] render', {
    isInitialized,
    leftSidebarSize,
    leftSidebarVisible,
  })

  // Set up global event listeners (keyboard shortcuts, etc.)
  useMainWindowEventListeners()

  // Handle CMD+W keybinding to close session or worktree
  useCloseSessionOrWorktreeKeybinding()

  // Handle CMD+SHIFT+T to restore last archived item
  useRestoreLastArchived()

  // Auto-cleanup old archived items on startup
  useArchiveCleanup()

  // Track app focus state for background task manager
  useAppFocusTracking()

  // Listen for git status updates from the background task
  useGitStatusEvents()

  // Listen for background worktree events (creation/deletion) - must be here
  // (not in sidebar) so events are received even when sidebar is closed
  useWorktreeEvents()

  // Handle CMD+N keybinding to create new worktree
  useCreateWorktreeKeybinding()

  // Handle custom resize for left sidebar (pixel-based)
  // Uses direct DOM manipulation during drag for smooth performance,
  // commits to Zustand only on mouseup
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = leftSidebarSize
      let currentWidth = startWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Dragging right increases width (sidebar is on left)
        const delta = moveEvent.clientX - startX
        currentWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, startWidth + delta)
        )
        // Update DOM directly for smooth resize (no React re-render)
        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${currentWidth}px`
        }
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        // Commit final width to Zustand state
        setLeftSidebarSize(currentWidth)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [leftSidebarSize, setLeftSidebarSize]
  )

  // Handle custom resize for right sidebar (pixel-based)
  // Similar to left sidebar but drag direction is inverted
  const handleRightResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = rightSidebarSize
      let currentWidth = startWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Dragging left increases width (sidebar is on right)
        const delta = startX - moveEvent.clientX
        currentWidth = Math.min(
          MAX_RIGHT_SIDEBAR_WIDTH,
          Math.max(MIN_RIGHT_SIDEBAR_WIDTH, startWidth + delta)
        )
        // Update DOM directly for smooth resize (no React re-render)
        if (rightSidebarRef.current) {
          rightSidebarRef.current.style.width = `${currentWidth}px`
        }
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        // Commit final width to Zustand state
        setRightSidebarSize(currentWidth)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [rightSidebarSize, setRightSidebarSize]
  )

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-sidebar">
      {/* Dev Mode Banner */}
      <DevModeBanner />

      {/* Title Bar */}
      <TitleBar title={windowTitle} />

      {/* Main Content Area - padding and gap for floating/inset effect */}
      <div className="flex flex-1 gap-2 overflow-hidden p-2">
        {/* Left Sidebar with floating style */}
        {leftSidebarVisible && isInitialized && (
          <SidebarWidthProvider value={leftSidebarSize}>
            <div
              ref={sidebarRef}
              className="h-full overflow-hidden rounded-lg border border-sidebar-border shadow-sm"
              style={{ width: leftSidebarSize }}
            >
              <LeftSideBar />
            </div>
          </SidebarWidthProvider>
        )}

        {/* Custom resize handle for left sidebar */}
        {leftSidebarVisible && isInitialized && (
          <div
            className="relative h-full w-px hover:bg-border"
            onMouseDown={handleResizeStart}
          >
            {/* Invisible wider hit area for easier clicking */}
            <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
          </div>
        )}

        {/* Main Content - inset style with rounded corners and shadow */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl bg-background shadow-sm">
          <MainWindowContent />
        </div>

        {/* Custom resize handle for right sidebar */}
        {rightSidebarVisible && isInitialized && selectedWorktreeId && worktree && (
          <div
            className="relative h-full w-px hover:bg-border"
            onMouseDown={handleRightResizeStart}
          >
            {/* Invisible wider hit area for easier clicking */}
            <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
          </div>
        )}

        {/* Right Sidebar with floating style */}
        {rightSidebarVisible && isInitialized && selectedWorktreeId && worktree && (
          <div
            ref={rightSidebarRef}
            className="h-full overflow-hidden rounded-lg border border-sidebar-border shadow-sm"
            style={{ width: rightSidebarSize }}
          >
            <RightSideBar
              worktreeId={selectedWorktreeId}
              worktreePath={worktree.path}
            />
          </div>
        )}
      </div>

      {/* Global UI Components (hidden until triggered) */}
      <CommandPalette />
      <PreferencesDialog />
      <CommitModal />
      <OnboardingDialog />
      <CliUpdateModal />
      <CliLoginModal />
      <OpenInModal />
      <MagicModal />
      <CheckoutPRModal />
      <NewWorktreeModal />
      <PathConflictModal />
      <BranchConflictModal />
      <SessionBoardModal />
      <GitInitModal />
      <CloneRepoModal />
      <QuitConfirmationDialog />
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              'group toast group-[.toaster]:bg-sidebar group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton:
              'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton:
              'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
      />
    </div>
  )
}

export default MainWindow
