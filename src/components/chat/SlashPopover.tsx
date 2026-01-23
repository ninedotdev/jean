import { useCallback, useEffect, useMemo } from 'react'
import { Terminal, Wand2 } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { useClaudeSkills, useClaudeCommands } from '@/services/skills'
import type { ClaudeSkill, ClaudeCommand, PendingSkill } from '@/types/chat'

interface SlashPopoverProps {
  /** Whether the popover is open */
  open: boolean
  /** Callback when popover should close */
  onOpenChange: (open: boolean) => void
  /** Callback when a skill is selected (adds to pending, continues editing) */
  onSelectSkill: (skill: PendingSkill) => void
  /** Callback when a command is selected (executes immediately) */
  onSelectCommand: (command: ClaudeCommand) => void
  /** Current search query (text after /) */
  searchQuery: string
  /** Position for the anchor (relative to textarea container) */
  anchorPosition: { top: number; left: number } | null
  /** Whether slash is at prompt start (enables commands) */
  isAtPromptStart: boolean
  /** Callback to register select-first function with parent */
  onRegisterSelectFirst?: (selectFirst: () => void) => void
}

type ListItem =
  | { type: 'command'; data: ClaudeCommand }
  | { type: 'skill'; data: ClaudeSkill }

export function SlashPopover({
  open,
  onOpenChange,
  onSelectSkill,
  onSelectCommand,
  searchQuery,
  anchorPosition,
  isAtPromptStart,
  onRegisterSelectFirst,
}: SlashPopoverProps) {
  const { data: skills = [] } = useClaudeSkills()
  const { data: commands = [] } = useClaudeCommands()

  // Filter and combine items based on search query and context
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase()
    const items: ListItem[] = []

    // Add commands first (only if at prompt start)
    if (isAtPromptStart) {
      const filteredCommands = query
        ? commands.filter(
            c =>
              c.name.toLowerCase().includes(query) ||
              c.description?.toLowerCase().includes(query)
          )
        : commands

      filteredCommands.slice(0, 10).forEach(cmd => {
        items.push({ type: 'command', data: cmd })
      })
    }

    // Add skills
    const filteredSkills = query
      ? skills.filter(
          s =>
            s.name.toLowerCase().includes(query) ||
            s.description?.toLowerCase().includes(query)
        )
      : skills

    filteredSkills.slice(0, 10).forEach(skill => {
      items.push({ type: 'skill', data: skill })
    })

    return items.slice(0, 15) // Limit total to 15
  }, [skills, commands, searchQuery, isAtPromptStart])

  const handleSelectSkill = useCallback(
    (skill: ClaudeSkill) => {
      const pendingSkill: PendingSkill = {
        id: crypto.randomUUID(),
        name: skill.name,
        path: skill.path,
      }
      onSelectSkill(pendingSkill)
      onOpenChange(false)
    },
    [onSelectSkill, onOpenChange]
  )

  const handleSelectCommand = useCallback(
    (command: ClaudeCommand) => {
      onSelectCommand(command)
      onOpenChange(false)
    },
    [onSelectCommand, onOpenChange]
  )

  // Create stable selectFirst function and register it with parent
  // This allows parent to trigger selection without prop drilling or counter patterns
  const selectFirst = useCallback(() => {
    const firstItem = filteredItems[0]
    if (!firstItem) return

    if (firstItem.type === 'command') {
      handleSelectCommand(firstItem.data)
    } else {
      handleSelectSkill(firstItem.data)
    }
  }, [filteredItems, handleSelectCommand, handleSelectSkill])

  // Register selectFirst with parent when it changes
  useEffect(() => {
    onRegisterSelectFirst?.(selectFirst)
  }, [onRegisterSelectFirst, selectFirst])

  if (!open || !anchorPosition) return null

  // Split items by type for grouped rendering
  const commandItems = filteredItems.filter(item => item.type === 'command')
  const skillItems = filteredItems.filter(item => item.type === 'skill')

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor
        style={{
          position: 'absolute',
          top: anchorPosition.top,
          left: anchorPosition.left,
          pointerEvents: 'none',
        }}
      />
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="top"
        sideOffset={4}
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList className="max-h-[250px]">
            {filteredItems.length === 0 ? (
              <CommandEmpty>No commands or skills found</CommandEmpty>
            ) : (
              <>
                {commandItems.length > 0 && (
                  <CommandGroup heading="Commands">
                    {commandItems.map(item => (
                      <CommandItem
                        key={`cmd-${item.data.name}`}
                        value={`cmd-${item.data.name}`}
                        onSelect={() => handleSelectCommand(item.data)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Terminal className="h-4 w-4 shrink-0 text-blue-500" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-sm font-medium">
                            /{item.data.name}
                          </span>
                          {item.data.description && (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.data.description}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {skillItems.length > 0 && (
                  <CommandGroup heading="Skills">
                    {skillItems.map(item => (
                      <CommandItem
                        key={`skill-${item.data.name}`}
                        value={`skill-${item.data.name}`}
                        onSelect={() => handleSelectSkill(item.data)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Wand2 className="h-4 w-4 shrink-0 text-purple-500" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-sm font-medium">
                            /{item.data.name}
                          </span>
                          {item.data.description && (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.data.description}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
