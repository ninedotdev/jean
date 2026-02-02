import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore, type RightPanelTab } from '@/store/ui-store'
import { FileTreePanel } from '@/components/right-panel/FileTreePanel'
import { GitChangesPanel } from '@/components/right-panel/GitChangesPanel'
import { CIChecksPanel } from '@/components/right-panel/CIChecksPanel'
import { Files, GitCompare, CheckCircle } from 'lucide-react'

interface RightSideBarProps {
  worktreeId: string
  worktreePath: string
}

// Custom event for opening file diff modal
declare global {
  interface WindowEventMap {
    'open-file-diff': CustomEvent<{ filePath: string }>
  }
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}

function TabButton({ active, onClick, icon, children }: TabButtonProps) {
  return (
    <button
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

export function RightSideBar({ worktreeId, worktreePath }: RightSideBarProps) {
  const activeTab = useUIStore(state => state.activeRightPanelTab)
  const setActiveTab = useUIStore(state => state.setActiveRightPanelTab)

  const handleTabChange = (tab: RightPanelTab) => {
    setActiveTab(tab)
  }

  // Handle file click in Changes panel - dispatch event to open FileDiffModal
  const handleFileClick = useCallback((filePath: string) => {
    window.dispatchEvent(
      new CustomEvent('open-file-diff', { detail: { filePath } })
    )
  }, [])

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Tab header */}
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <TabButton
          active={activeTab === 'files'}
          onClick={() => handleTabChange('files')}
          icon={<Files className="h-3.5 w-3.5" />}
        >
          All Files
        </TabButton>
        <TabButton
          active={activeTab === 'changes'}
          onClick={() => handleTabChange('changes')}
          icon={<GitCompare className="h-3.5 w-3.5" />}
        >
          Changes
        </TabButton>
        <TabButton
          active={activeTab === 'checks'}
          onClick={() => handleTabChange('checks')}
          icon={<CheckCircle className="h-3.5 w-3.5" />}
        >
          Checks
        </TabButton>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && <FileTreePanel worktreePath={worktreePath} />}
        {activeTab === 'changes' && (
          <GitChangesPanel
            worktreeId={worktreeId}
            worktreePath={worktreePath}
            onFileClick={handleFileClick}
          />
        )}
        {activeTab === 'checks' && <CIChecksPanel worktreeId={worktreeId} />}
      </div>
    </div>
  )
}

export default RightSideBar
