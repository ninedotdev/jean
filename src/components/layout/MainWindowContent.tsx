import { cn } from '@/lib/utils'
import { ChatWindow } from '@/components/chat'
import { WorktreeDashboard } from '@/components/dashboard'
import { useChatStore } from '@/store/chat-store'
import { useProjectsStore } from '@/store/projects-store'

interface MainWindowContentProps {
  children?: React.ReactNode
  className?: string
}

export function MainWindowContent({
  children,
  className,
}: MainWindowContentProps) {
  const activeWorktreePath = useChatStore(state => state.activeWorktreePath)
  const selectedProjectId = useProjectsStore(state => state.selectedProjectId)

  return (
    <div
      className={cn(
        'flex h-full w-full min-w-0 flex-col overflow-hidden bg-background',
        className
      )}
    >
      {activeWorktreePath ? (
        <ChatWindow />
      ) : selectedProjectId ? (
        <WorktreeDashboard projectId={selectedProjectId} />
      ) : (
        children || (
          <div className="flex flex-1 items-center justify-center font-sans">
            <h1 className="text-4xl font-bold text-foreground">
              Welcome to Jean!
            </h1>
          </div>
        )
      )}
    </div>
  )
}

export default MainWindowContent
