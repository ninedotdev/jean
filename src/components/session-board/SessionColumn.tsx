import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface SessionColumnProps {
  id: 'idle' | 'active' | 'waiting' | 'reviewing'
  title: string
  count: number
  droppable?: boolean
  itemIds: string[]
  children: React.ReactNode
}

export function SessionColumn({
  id,
  title,
  count,
  droppable = true,
  itemIds,
  children,
}: SessionColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: !droppable,
  })

  return (
    <div className="flex h-full min-w-[250px] flex-1 flex-col rounded-lg border bg-muted/30">
      {/* Column Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
        {!droppable && (
          <span className="ml-auto text-xs text-muted-foreground">
            (read-only)
          </span>
        )}
      </div>

      {/* Column Content - drop zone wraps entire content area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-0 flex-1 flex-col transition-colors',
          isOver && droppable && 'bg-accent/30'
        )}
      >
        <ScrollArea className="flex-1">
          <div className="flex min-h-[200px] flex-col gap-2 p-2">
            <SortableContext
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              {children}
            </SortableContext>
            {count === 0 && (
              <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
                No sessions
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
