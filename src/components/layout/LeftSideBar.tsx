import { cn } from '@/lib/utils'
import { ProjectsSidebar } from '@/components/projects'

interface LeftSideBarProps {
  children?: React.ReactNode
  className?: string
}

export function LeftSideBar({ children, className }: LeftSideBarProps) {
  return (
    <div
      className={cn('flex h-full flex-col bg-sidebar', className)}
    >
      <div className="flex-1 min-h-0">
        <ProjectsSidebar />
      </div>
      {children}
    </div>
  )
}

export default LeftSideBar
