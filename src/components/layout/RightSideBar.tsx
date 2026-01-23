import { cn } from '@/lib/utils'
import { ActionsSidebar } from '@/components/actions'

interface RightSideBarProps {
  children?: React.ReactNode
  className?: string
}

export function RightSideBar({ children, className }: RightSideBarProps) {
  return (
    <div
      className={cn('flex h-full flex-col border-l bg-background', className)}
    >
      {children || <ActionsSidebar />}
    </div>
  )
}

export default RightSideBar
