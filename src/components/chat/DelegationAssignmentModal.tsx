import { useState, useMemo, useEffect } from 'react'
import { RiGeminiFill } from 'react-icons/ri'
import { SiOpenai, SiClaude } from 'react-icons/si'
import { Kimi } from '@/components/icons/Kimi'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  FileText,
  Info,
  BrainIcon,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import type {
  DelegatedTask,
  DelegationManifest,
  TaskAssignment,
} from '@/types/chat'
import type { AiCliProvider } from '@/types/preferences'
import {
  claudeModelOptions,
  geminiModelOptions,
  codexModelOptions,
  kimiModelOptions,
  getModelOptionsForProvider,
} from '@/types/preferences'
import { parsePlanTasks } from './plan-parser'
import { cn } from '@/lib/utils'

interface DelegationAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planContent: string
  defaultProvider: AiCliProvider
  defaultModel: string
  /** Optional manifest with orchestration data (when Claude prepares intelligent delegation) */
  manifest?: DelegationManifest | null
  /** Whether manifest is being generated */
  isGeneratingManifest?: boolean
  onApprove: (tasks: DelegatedTask[]) => void
  onApproveYolo: (tasks: DelegatedTask[]) => void
  /** For orchestration mode: approve with manifest and assignments */
  onApproveOrchestrated?: (
    manifest: DelegationManifest,
    assignments: TaskAssignment[]
  ) => void
  onApproveOrchestratedYolo?: (
    manifest: DelegationManifest,
    assignments: TaskAssignment[]
  ) => void
}

/**
 * Modal for assigning AI providers/models to individual plan tasks
 * Shown when user approves a plan with delegation enabled
 *
 * Two modes:
 * 1. Simple mode: Uses parsePlanTasks to extract tasks from plan content
 * 2. Orchestration mode: Uses DelegationManifest with rich context from Claude
 */
export function DelegationAssignmentModal({
  open,
  onOpenChange,
  planContent,
  defaultProvider,
  defaultModel,
  manifest,
  isGeneratingManifest,
  onApprove,
  onApproveYolo,
  onApproveOrchestrated,
  onApproveOrchestratedYolo,
}: DelegationAssignmentModalProps) {
  // Use manifest tasks if available, otherwise parse from plan content
  const useOrchestration = manifest && manifest.tasks.length > 0

  const parsedTasks = useMemo(() => parsePlanTasks(planContent), [planContent])

  // For simple mode: derive assignments from parsed tasks
  const initialSimpleAssignments = useMemo(
    () =>
      parsedTasks.map(task => ({
        id: task.id,
        description: task.description,
        assignedProvider: defaultProvider,
        assignedModel: defaultModel,
        status: 'pending' as const,
      })),
    [parsedTasks, defaultProvider, defaultModel]
  )

  // For orchestration mode: derive assignments from manifest with recommendations
  const initialOrchestratedAssignments = useMemo(
    () =>
      manifest?.tasks.map(task => ({
        taskId: task.id,
        provider: (task.recommendedProvider ||
          defaultProvider) as AiCliProvider,
        model: task.recommendedModel || defaultModel,
      })) ?? [],
    [manifest, defaultProvider, defaultModel]
  )

  const [simpleAssignments, setSimpleAssignments] = useState<DelegatedTask[]>(
    initialSimpleAssignments
  )
  const [orchestratedAssignments, setOrchestratedAssignments] = useState<
    TaskAssignment[]
  >(initialOrchestratedAssignments)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  // Reset assignments when initial values change
  useEffect(() => {
    setSimpleAssignments(initialSimpleAssignments)
  }, [initialSimpleAssignments])

  useEffect(() => {
    setOrchestratedAssignments(initialOrchestratedAssignments)
  }, [initialOrchestratedAssignments])

  const handleSimpleProviderModelChange = (
    taskId: string,
    provider: AiCliProvider,
    model: string
  ) => {
    setSimpleAssignments(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, assignedProvider: provider, assignedModel: model }
          : t
      )
    )
  }

  const handleOrchestratedProviderModelChange = (
    taskId: string,
    provider: AiCliProvider,
    model: string
  ) => {
    setOrchestratedAssignments(prev =>
      prev.map(a => (a.taskId === taskId ? { ...a, provider, model } : a))
    )
  }

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const handleApprove = () => {
    if (useOrchestration && onApproveOrchestrated && manifest) {
      onApproveOrchestrated(manifest, orchestratedAssignments)
    } else {
      onApprove(simpleAssignments)
    }
    onOpenChange(false)
  }

  const handleApproveYolo = () => {
    if (useOrchestration && onApproveOrchestratedYolo && manifest) {
      onApproveOrchestratedYolo(manifest, orchestratedAssignments)
    } else {
      onApproveYolo(simpleAssignments)
    }
    onOpenChange(false)
  }

  // Loading state while generating manifest
  if (isGeneratingManifest) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainIcon className="h-5 w-5 text-primary" />
              Preparing Orchestration
            </DialogTitle>
            <DialogDescription>
              Claude is analyzing the plan and preparing detailed instructions
              for each task...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // No tasks found
  if (!useOrchestration && parsedTasks.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No Tasks Found</DialogTitle>
            <DialogDescription>
              Could not extract individual tasks from the plan. The plan will be
              executed as a whole.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove}>Approve Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Orchestration mode with manifest
  if (useOrchestration && manifest) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Orchestrated Delegation
            </DialogTitle>
            <DialogDescription>
              Claude has prepared detailed instructions for each task. Review
              and adjust model assignments.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[500px] pr-4">
            <div className="space-y-3">
              {manifest.tasks.map((task, index) => {
                const assignment = orchestratedAssignments.find(
                  a => a.taskId === task.id
                )
                const isExpanded = expandedTasks.has(task.id)

                return (
                  <Collapsible
                    key={task.id}
                    open={isExpanded}
                    onOpenChange={() => toggleTaskExpanded(task.id)}
                  >
                    <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
                      {/* Task header */}
                      <div className="flex items-start gap-3 p-3">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="mt-0.5 p-0.5 hover:bg-muted rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                        <span className="text-sm text-muted-foreground font-mono w-6 pt-0.5">
                          {index + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed">
                            {task.originalDescription}
                          </p>
                          {/* Recommendation badge */}
                          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-xs">
                              <Info className="h-3 w-3 mr-1" />
                              {task.recommendationReason}
                            </Badge>
                          </div>
                        </div>
                        <ProviderModelSelector
                          provider={assignment?.provider ?? defaultProvider}
                          model={assignment?.model ?? defaultModel}
                          onChange={(provider, model) =>
                            handleOrchestratedProviderModelChange(
                              task.id,
                              provider,
                              model
                            )
                          }
                        />
                      </div>

                      {/* Expanded details */}
                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/30 mt-2">
                          {/* Instructions */}
                          <div className="mt-3">
                            <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Instructions
                            </h4>
                            <p className="text-xs text-foreground/80 whitespace-pre-wrap bg-muted/30 rounded p-2">
                              {task.instructions}
                            </p>
                          </div>

                          {/* Relevant files */}
                          {task.relevantFiles.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                                Relevant Files
                              </h4>
                              <div className="flex flex-wrap gap-1">
                                {task.relevantFiles.map(file => (
                                  <Badge
                                    key={file}
                                    variant="outline"
                                    className="text-xs font-mono"
                                  >
                                    {file}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Context notes */}
                          {task.contextNotes.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                                Context Notes
                              </h4>
                              <ul className="text-xs text-foreground/80 space-y-0.5">
                                {task.contextNotes.map((note, i) => (
                                  <li key={i} className="flex gap-1.5">
                                    <span className="text-muted-foreground">
                                      -
                                    </span>
                                    {note}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Dependencies */}
                          {task.dependsOn.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                                Depends On
                              </h4>
                              <div className="flex flex-wrap gap-1">
                                {task.dependsOn.map(dep => (
                                  <Badge
                                    key={dep}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {dep}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleApproveYolo}
              className="text-destructive-foreground"
            >
              Yolo
            </Button>
            <Button onClick={handleApprove}>Approve & Execute</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Simple mode (fallback)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Tasks to Models</DialogTitle>
          <DialogDescription>
            Choose which AI model should handle each task in the plan.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {simpleAssignments.map((task, index) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20"
              >
                <span className="text-sm text-muted-foreground font-mono w-6 pt-0.5">
                  {index + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{task.description}</p>
                </div>
                <ProviderModelSelector
                  provider={task.assignedProvider}
                  model={task.assignedModel}
                  onChange={(provider, model) =>
                    handleSimpleProviderModelChange(task.id, provider, model)
                  }
                />
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleApproveYolo}
            className="text-destructive-foreground"
          >
            Yolo
          </Button>
          <Button onClick={handleApprove}>Approve & Execute</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ProviderModelSelectorProps {
  provider: AiCliProvider
  model: string
  onChange: (provider: AiCliProvider, model: string) => void
}

function ProviderModelSelector({
  provider,
  model,
  onChange,
}: ProviderModelSelectorProps) {
  const modelOptions = getModelOptionsForProvider(provider)
  const modelLabel = modelOptions.find(o => o.value === model)?.label ?? model

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors border border-border/50 shrink-0"
        >
          <ProviderIcon provider={provider} className="h-3.5 w-3.5" />
          <span className="max-w-[100px] truncate">{modelLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Claude models */}
        <DropdownMenuRadioGroup
          value={provider === 'claude' ? model : ''}
          onValueChange={value => onChange('claude', value)}
        >
          {claudeModelOptions.map(option => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <SiClaude className="mr-2 h-3.5 w-3.5" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Gemini models */}
        <DropdownMenuRadioGroup
          value={provider === 'gemini' ? model : ''}
          onValueChange={value => onChange('gemini', value)}
        >
          {geminiModelOptions.map(option => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <RiGeminiFill className="mr-2 h-3.5 w-3.5" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Codex models */}
        <DropdownMenuRadioGroup
          value={provider === 'codex' ? model : ''}
          onValueChange={value => onChange('codex', value)}
        >
          {codexModelOptions.map(option => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <SiOpenai className="mr-2 h-3.5 w-3.5" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Kimi models */}
        <DropdownMenuRadioGroup
          value={provider === 'kimi' ? model : ''}
          onValueChange={value => onChange('kimi', value)}
        >
          {kimiModelOptions.map(option => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <Kimi className="mr-2 h-3.5 w-3.5" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProviderIcon({
  provider,
  className,
}: {
  provider: AiCliProvider
  className?: string
}) {
  switch (provider) {
    case 'claude':
      return <SiClaude className={cn(className)} />
    case 'gemini':
      return <RiGeminiFill className={cn(className)} />
    case 'codex':
      return <SiOpenai className={cn(className)} />
    case 'kimi':
      return <Kimi className={cn(className)} />
    default:
      return <SiClaude className={cn(className)} />
  }
}
