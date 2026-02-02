import { memo, useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  gitPull,
  gitPush,
  triggerImmediateGitPoll,
} from '@/services/git-status'
import { useChatStore } from '@/store/chat-store'
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Brain,
  ChevronDown,
  CircleDot,
  Clock,
  ClipboardList,
  Cpu,
  Eye,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Hammer,
  MoreHorizontal,
  Pencil,
  Send,
  Wand2,
  Zap,
} from 'lucide-react'
import { RiGeminiFill } from 'react-icons/ri'
import { SiOpenai, SiClaude } from 'react-icons/si'
import { Kimi } from '@/components/icons/Kimi'
import { Kbd } from '@/components/ui/kbd'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'
import type { ThinkingLevel, ExecutionMode, Todo } from '@/types/chat'
import type { AiCliProvider } from '@/types/preferences'
import {
  claudeModelOptions,
  geminiModelOptions,
  codexModelOptions,
  kimiModelOptions,
  getModelOptionsForProvider,
} from '@/types/preferences'
import type {
  PrDisplayStatus,
  CheckStatus,
  MergeableStatus,
} from '@/types/pr-status'
import type { DiffRequest } from '@/types/git-diff'
import type {
  LoadedIssueContext,
  LoadedPullRequestContext,
  AttachedSavedContext,
} from '@/types/github'
import {
  getIssueContextContent,
  getPRContextContent,
  getSavedContextContent,
} from '@/services/github'
import { TodoInlineButton } from './TodoInlineButton'
import { DelegationInlineButton } from './DelegationInlineButton'

/** Get provider icon component */
function ProviderIcon({
  provider,
  className,
}: {
  provider: AiCliProvider
  className?: string
}) {
  switch (provider) {
    case 'claude':
      return <SiClaude className={className} />
    case 'gemini':
      return <RiGeminiFill className={className} />
    case 'codex':
      return <SiOpenai className={className} />
    case 'kimi':
      return <Kimi className={className} />
    default:
      return <SiClaude className={className} />
  }
}

/** Get display label for a model */
function getModelLabel(model: string, provider: AiCliProvider): string {
  const options = getModelOptionsForProvider(provider)
  return options.find(o => o.value === model)?.label || model
}

/** Check if provider supports extended thinking */
function providerSupportsThinking(provider: AiCliProvider): boolean {
  // Claude: extended thinking with token budgets
  // Codex: reasoning effort (low/medium/high/xhigh)
  // Kimi: instant/thinking/agent modes
  return provider === 'claude' || provider === 'codex' || provider === 'kimi'
}

/** Check if provider supports plan mode (approval before execution) */
function providerSupportsPlanMode(provider: AiCliProvider): boolean {
  // Claude: native plan mode with proper approval flow
  // Gemini: supports sandbox mode (--sandbox) for read-only operations
  // Codex: doesn't handle plan approval well - keeps asking questions instead of implementing
  // Kimi: no native plan mode support
  return provider === 'claude' || provider === 'gemini'
}

/** Thinking level options with display labels and token counts (Claude) */
const THINKING_LEVEL_OPTIONS: {
  value: ThinkingLevel
  label: string
  tokens: string
}[] = [
  { value: 'off', label: 'Off', tokens: 'Disabled' },
  { value: 'think', label: 'Think', tokens: '4K' },
  { value: 'megathink', label: 'Megathink', tokens: '10K' },
  { value: 'ultrathink', label: 'Ultrathink', tokens: '32K' },
]

/** Codex reasoning effort options (maps to thinking levels) */
const CODEX_REASONING_OPTIONS: {
  value: ThinkingLevel
  label: string
  effort: string
}[] = [
  { value: 'off', label: 'Low', effort: 'Fast' },
  { value: 'think', label: 'Medium', effort: 'Balanced' },
  { value: 'megathink', label: 'High', effort: 'Thorough' },
  { value: 'ultrathink', label: 'Extra High', effort: 'Max' },
]

/** Kimi execution mode options */
const KIMI_MODE_OPTIONS: {
  value: ThinkingLevel
  label: string
  description: string
}[] = [
  { value: 'off', label: 'Instant', description: 'Quick responses' },
  { value: 'think', label: 'Thinking', description: 'Deep reasoning' },
  { value: 'megathink', label: 'Agent', description: 'Single task' },
  { value: 'ultrathink', label: 'Swarm', description: 'Multi-step loop' },
]

/** Get thinking options for a provider */
function getThinkingOptionsForProvider(provider: AiCliProvider) {
  if (provider === 'codex') return CODEX_REASONING_OPTIONS
  if (provider === 'kimi') return KIMI_MODE_OPTIONS
  return THINKING_LEVEL_OPTIONS
}

/** Get thinking label for display */
function getThinkingLabel(
  level: ThinkingLevel,
  provider: AiCliProvider
): string {
  const options = getThinkingOptionsForProvider(provider)
  return options.find(o => o.value === level)?.label ?? level
}

/** Get display label and color for PR status */
function getPrStatusDisplay(status: PrDisplayStatus): {
  label: string
  className: string
} {
  switch (status) {
    case 'draft':
      return { label: 'Draft', className: 'text-muted-foreground' }
    case 'open':
      return { label: 'Open', className: 'text-green-600 dark:text-green-500' }
    case 'merged':
      return {
        label: 'Merged',
        className: 'text-purple-600 dark:text-purple-400',
      }
    case 'closed':
      return { label: 'Closed', className: 'text-red-600 dark:text-red-400' }
    default:
      return { label: 'Unknown', className: 'text-muted-foreground' }
  }
}

/** Check status icon component */
function CheckStatusIcon({ status }: { status: CheckStatus | null }) {
  if (!status) return null

  switch (status) {
    case 'success':
      return null
    case 'failure':
    case 'error':
      return (
        <span
          className="ml-1 h-2 w-2 rounded-full bg-red-500"
          title="Checks failing"
        />
      )
    case 'pending':
      return (
        <span
          className="ml-1 h-2 w-2 rounded-full bg-yellow-500 animate-pulse"
          title="Checks pending"
        />
      )
    default:
      return null
  }
}

interface ChatToolbarProps {
  // State
  isSending: boolean
  hasPendingQuestions: boolean
  hasPendingAttachments: boolean
  hasInputValue: boolean
  executionMode: ExecutionMode
  selectedProvider: AiCliProvider
  selectedModel: string
  selectedThinkingLevel: ThinkingLevel
  thinkingOverrideActive: boolean // True when thinking is disabled in build/yolo due to preference
  queuedMessageCount: number

  // Git state
  hasBranchUpdates: boolean
  behindCount: number
  aheadCount: number
  baseBranch: string
  uncommittedAdded: number
  uncommittedRemoved: number
  branchDiffAdded: number
  branchDiffRemoved: number

  // PR state
  prUrl: string | undefined
  prNumber: number | undefined
  displayStatus: PrDisplayStatus | undefined
  checkStatus: CheckStatus | undefined
  mergeableStatus: MergeableStatus | undefined

  // Shortcuts
  magicModalShortcut: string

  // Worktree info
  activeWorktreePath: string | undefined
  worktreeId: string | null

  // Issue/PR/Saved context
  loadedIssueContexts: LoadedIssueContext[]
  loadedPRContexts: LoadedPullRequestContext[]
  attachedSavedContexts: AttachedSavedContext[]

  // Callbacks
  onOpenMagicModal: () => void
  onSaveContext: () => void
  onLoadContext: () => void
  onCommit: () => void
  onOpenPr: () => void
  onReview: () => void
  onMerge: () => void
  onResolvePrConflicts: () => void
  onResolveConflicts: () => void
  isBaseSession: boolean
  hasOpenPr: boolean
  onSetDiffRequest: (request: DiffRequest) => void
  onProviderChange: (provider: AiCliProvider) => void
  onModelChange: (model: string) => void
  onThinkingLevelChange: (level: ThinkingLevel) => void
  onSetExecutionMode: (mode: ExecutionMode) => void
  onCancel: () => void

  // Multi-model delegation
  delegationEnabled: boolean
  onToggleDelegation: () => void

  // Tasks (todos)
  activeTodos?: Todo[]
  onDismissTodos?: () => void

  // Session ID for delegation progress
  activeSessionId?: string | null
}

/**
 * Memoized toolbar component to prevent re-renders when parent state changes.
 * This component only re-renders when its props change.
 */
export const ChatToolbar = memo(function ChatToolbar({
  isSending,
  hasPendingQuestions,
  hasPendingAttachments,
  hasInputValue,
  executionMode,
  selectedProvider,
  selectedModel,
  selectedThinkingLevel,
  thinkingOverrideActive,
  queuedMessageCount,
  hasBranchUpdates,
  behindCount,
  aheadCount,
  baseBranch,
  uncommittedAdded,
  uncommittedRemoved,
  branchDiffAdded,
  branchDiffRemoved,
  prUrl,
  prNumber,
  displayStatus,
  checkStatus,
  mergeableStatus,
  magicModalShortcut,
  activeWorktreePath,
  worktreeId,
  loadedIssueContexts,
  loadedPRContexts,
  attachedSavedContexts,
  onOpenMagicModal,
  onSaveContext,
  onLoadContext,
  onCommit,
  onOpenPr,
  onReview,
  onMerge,
  onResolvePrConflicts,
  onResolveConflicts,
  isBaseSession,
  hasOpenPr,
  onSetDiffRequest,
  onProviderChange,
  onModelChange,
  onThinkingLevelChange,
  onSetExecutionMode,
  onCancel,
  delegationEnabled,
  onToggleDelegation,
  activeTodos,
  onDismissTodos,
  activeSessionId,
}: ChatToolbarProps) {
  // Check if thinking is supported by current provider
  const thinkingSupported = providerSupportsThinking(selectedProvider)

  // Memoize callbacks to prevent re-renders
  const handleModelChange = useCallback(
    (value: string) => {
      onModelChange(value)
    },
    [onModelChange]
  )

  const handleProviderChange = useCallback(
    (provider: AiCliProvider) => {
      onProviderChange(provider)
    },
    [onProviderChange]
  )

  const handleThinkingLevelChange = useCallback(
    (value: string) => {
      onThinkingLevelChange(value as ThinkingLevel)
    },
    [onThinkingLevelChange]
  )

  const [isPulling, setIsPulling] = useState(false)
  const handlePullClick = useCallback(async () => {
    if (!activeWorktreePath || !worktreeId) return
    setIsPulling(true)
    const { setWorktreeLoading, clearWorktreeLoading } = useChatStore.getState()
    setWorktreeLoading(worktreeId, 'pull')
    const toastId = toast.loading('Pulling changes...')
    try {
      await gitPull(activeWorktreePath, baseBranch)
      triggerImmediateGitPoll()
      toast.success('Changes pulled', { id: toastId })
    } catch (error) {
      // Tauri errors may be strings or Error objects with the message
      // Use String() to coerce any error type to a string for matching
      const errorStr = String(error)
      console.log('[ChatToolbar] Pull error:', {
        error,
        errorStr,
        type: typeof error,
      })
      if (errorStr.includes('Merge conflicts in:')) {
        toast.warning('Pull resulted in conflicts', {
          id: toastId,
          description: 'Opening conflict resolution...',
        })
        onResolveConflicts()
      } else {
        toast.error(`Pull failed: ${errorStr}`, { id: toastId })
      }
    } finally {
      setIsPulling(false)
      clearWorktreeLoading(worktreeId)
    }
  }, [activeWorktreePath, baseBranch, worktreeId, onResolveConflicts])

  const [isPushing, setIsPushing] = useState(false)
  const handlePushClick = useCallback(async () => {
    if (!activeWorktreePath) return
    setIsPushing(true)
    const toastId = toast.loading('Pushing changes...')
    try {
      await gitPush(activeWorktreePath)
      triggerImmediateGitPoll()
      toast.success('Changes pushed', { id: toastId })
    } catch (error) {
      toast.error(`Push failed: ${error}`, { id: toastId })
    } finally {
      setIsPushing(false)
    }
  }, [activeWorktreePath])

  const handleUncommittedDiffClick = useCallback(() => {
    onSetDiffRequest({
      type: 'uncommitted',
      worktreePath: activeWorktreePath ?? '',
      baseBranch,
    })
  }, [activeWorktreePath, baseBranch, onSetDiffRequest])

  const handleBranchDiffClick = useCallback(() => {
    onSetDiffRequest({
      type: 'branch',
      worktreePath: activeWorktreePath ?? '',
      baseBranch,
    })
  }, [activeWorktreePath, baseBranch, onSetDiffRequest])

  // Context viewer state
  const [viewingContext, setViewingContext] = useState<{
    type: 'issue' | 'pr' | 'saved'
    number?: number
    slug?: string
    title: string
    content: string
  } | null>(null)

  const handleViewIssue = useCallback(
    async (ctx: LoadedIssueContext) => {
      if (!worktreeId || !activeWorktreePath) return
      try {
        const content = await getIssueContextContent(
          worktreeId,
          ctx.number,
          activeWorktreePath
        )
        setViewingContext({
          type: 'issue',
          number: ctx.number,
          title: ctx.title,
          content,
        })
      } catch (error) {
        toast.error(`Failed to load context: ${error}`)
      }
    },
    [worktreeId, activeWorktreePath]
  )

  const handleViewPR = useCallback(
    async (ctx: LoadedPullRequestContext) => {
      if (!worktreeId || !activeWorktreePath) return
      try {
        const content = await getPRContextContent(
          worktreeId,
          ctx.number,
          activeWorktreePath
        )
        setViewingContext({
          type: 'pr',
          number: ctx.number,
          title: ctx.title,
          content,
        })
      } catch (error) {
        toast.error(`Failed to load context: ${error}`)
      }
    },
    [worktreeId, activeWorktreePath]
  )

  const handleViewSavedContext = useCallback(
    async (ctx: AttachedSavedContext) => {
      if (!worktreeId) return
      try {
        const content = await getSavedContextContent(worktreeId, ctx.slug)
        setViewingContext({
          type: 'saved',
          slug: ctx.slug,
          title: ctx.name || ctx.slug,
          content,
        })
      } catch (error) {
        toast.error(`Failed to load context: ${error}`)
      }
    },
    [worktreeId]
  )

  // Compute counts from arrays
  const loadedIssueCount = loadedIssueContexts.length
  const loadedPRCount = loadedPRContexts.length
  const loadedContextCount = attachedSavedContexts.length

  const isDisabled = isSending || hasPendingQuestions
  const canSend = hasInputValue || hasPendingAttachments

  return (
    <div className="@container px-3 py-2">
      {/* Controls - flat toolbar */}
      <div className="flex items-center gap-0.5">
        {/* Provider/Model selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={hasPendingQuestions}
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              title={`${selectedProvider}: ${getModelLabel(selectedModel, selectedProvider)}`}
            >
              <ProviderIcon provider={selectedProvider} className="h-4 w-4" />
              <span className="hidden @xs:inline">
                {getModelLabel(selectedModel, selectedProvider)}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {/* Claude models */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <SiClaude className="mr-2 h-4 w-4" />
                <span>Anthropic</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={selectedProvider === 'claude' ? selectedModel : ''}
                  onValueChange={value => {
                    handleProviderChange('claude')
                    handleModelChange(value)
                  }}
                >
                  {claudeModelOptions.map(option => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Gemini models */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <RiGeminiFill className="mr-2 h-4 w-4" />
                <span>Google</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={selectedProvider === 'gemini' ? selectedModel : ''}
                  onValueChange={value => {
                    handleProviderChange('gemini')
                    handleModelChange(value)
                  }}
                >
                  {geminiModelOptions.map(option => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Codex models */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <SiOpenai className="mr-2 h-4 w-4" />
                <span>OpenAI</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={selectedProvider === 'codex' ? selectedModel : ''}
                  onValueChange={value => {
                    handleProviderChange('codex')
                    handleModelChange(value)
                  }}
                >
                  {codexModelOptions.map(option => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Kimi models */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Kimi className="mr-2 h-4 w-4" />
                <span>Kimi</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={selectedProvider === 'kimi' ? selectedModel : ''}
                  onValueChange={value => {
                    handleProviderChange('kimi')
                    handleModelChange(value)
                  }}
                >
                  {kimiModelOptions.map(option => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Thinking level dropdown (Claude and Codex) */}
        {thinkingSupported && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={hasPendingQuestions}
                className={cn(
                  'flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
                  selectedThinkingLevel !== 'off' &&
                    !thinkingOverrideActive &&
                    (selectedProvider === 'kimi'
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-purple-600 dark:text-purple-400')
                )}
                title={
                  thinkingOverrideActive
                    ? `${selectedProvider === 'kimi' ? 'Mode' : selectedProvider === 'codex' ? 'Reasoning' : 'Thinking'} disabled in ${executionMode} mode (change in Settings)`
                    : `${selectedProvider === 'kimi' ? 'Mode' : selectedProvider === 'codex' ? 'Reasoning' : 'Thinking'}: ${getThinkingLabel(selectedThinkingLevel, selectedProvider)}`
                }
              >
                <Brain className="h-4 w-4" />
                <span className="hidden @xs:inline">
                  {thinkingOverrideActive
                    ? 'Off'
                    : getThinkingLabel(selectedThinkingLevel, selectedProvider)}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {selectedProvider === 'kimi'
                  ? 'Execution Mode'
                  : selectedProvider === 'codex'
                    ? 'Reasoning Effort'
                    : 'Extended Thinking'}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={thinkingOverrideActive ? 'off' : selectedThinkingLevel}
                onValueChange={handleThinkingLevelChange}
              >
                {getThinkingOptionsForProvider(selectedProvider).map(option => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    <Brain className="mr-2 h-4 w-4" />
                    {option.label}
                    <span className="ml-auto pl-4 text-xs text-muted-foreground">
                      {'tokens' in option
                        ? option.tokens
                        : 'effort' in option
                          ? option.effort
                          : 'description' in option
                            ? option.description
                            : ''}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Execution mode dropdown */}
        {providerSupportsPlanMode(selectedProvider) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={hasPendingQuestions}
                className={cn(
                  'flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
                  executionMode === 'plan' &&
                    'text-teal-600 dark:text-teal-400',
                  executionMode === 'yolo' && 'text-red-600 dark:text-red-400'
                )}
                title={`${executionMode.charAt(0).toUpperCase() + executionMode.slice(1)} mode`}
              >
                {executionMode === 'plan' && (
                  <ClipboardList className="h-4 w-4" />
                )}
                {executionMode === 'build' && <Hammer className="h-4 w-4" />}
                {executionMode === 'yolo' && <Zap className="h-4 w-4" />}
                <span className="hidden @xs:inline capitalize">
                  {executionMode}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={executionMode}
                onValueChange={v => onSetExecutionMode(v as ExecutionMode)}
              >
                <DropdownMenuRadioItem value="plan">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Plan
                  <span className="ml-auto pl-4 text-xs text-muted-foreground">
                    Read-only
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="build">
                  <Hammer className="mr-2 h-4 w-4" />
                  Build
                  <span className="ml-auto pl-4 text-xs text-muted-foreground">
                    Auto-edits
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                <DropdownMenuRadioItem
                  value="yolo"
                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Yolo
                  <span className="ml-auto pl-4 text-xs">No limits!</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          /* Gemini/Codex - show auto mode indicator */
          <div className="flex h-8 items-center gap-1 rounded-md px-2 text-sm text-teal-600 dark:text-teal-400">
            <Zap className="h-4 w-4" />
            <span className="hidden @xs:inline">Auto</span>
          </div>
        )}

        {/* Tasks inline button - shown when todos exist */}
        {activeTodos && activeTodos.length > 0 && (
          <TodoInlineButton
            todos={activeTodos}
            isStreaming={isSending}
            onClose={onDismissTodos}
          />
        )}

        {/* Delegation progress button - shown when delegated tasks exist */}
        {activeSessionId && (
          <DelegationInlineButton sessionId={activeSessionId} />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Queue indicator */}
        {queuedMessageCount > 0 && (
          <div className="flex h-8 items-center gap-1 px-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="hidden @sm:inline">{queuedMessageCount}</span>
          </div>
        )}

        {/* Overflow menu with actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center justify-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={isDisabled}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Magic & Context section */}
            <DropdownMenuItem onClick={onOpenMagicModal}>
              <Wand2 className="h-4 w-4" />
              Magic Prompts
              <Kbd className="ml-auto h-4 text-[10px] opacity-50">
                {magicModalShortcut}
              </Kbd>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSaveContext}>
              <BookmarkPlus className="h-4 w-4" />
              Save Context
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLoadContext}>
              <FolderOpen className="h-4 w-4" />
              Load Context
              {(loadedIssueCount > 0 ||
                loadedPRCount > 0 ||
                loadedContextCount > 0) && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {loadedIssueCount + loadedPRCount + loadedContextCount}
                </span>
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Multi-model delegation settings */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Cpu className="h-4 w-4" />
                Multi-Model Delegation
                {delegationEnabled && (
                  <span className="ml-auto text-xs text-green-500">On</span>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <div className="px-2 py-1.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">
                      Enable Delegation
                    </span>
                    <button
                      type="button"
                      onClick={onToggleDelegation}
                      className={cn(
                        'w-8 h-4 rounded-full transition-colors',
                        delegationEnabled ? 'bg-green-500' : 'bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'block w-3 h-3 rounded-full bg-white transition-transform',
                          delegationEnabled
                            ? 'translate-x-4'
                            : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                  {delegationEnabled && (
                    <p className="text-[10px] text-muted-foreground">
                      Assign tasks to different AI models when approving plans
                    </p>
                  )}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Show loaded contexts if any */}
            {loadedIssueContexts.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Issues
                </DropdownMenuLabel>
                {loadedIssueContexts.map(ctx => (
                  <DropdownMenuItem
                    key={ctx.number}
                    onClick={() => handleViewIssue(ctx)}
                  >
                    <CircleDot className="h-4 w-4 text-green-500" />
                    <span className="truncate">
                      #{ctx.number} {ctx.title}
                    </span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {loadedPRContexts.length > 0 && (
              <>
                {loadedIssueContexts.length === 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Pull Requests
                </DropdownMenuLabel>
                {loadedPRContexts.map(ctx => (
                  <DropdownMenuItem
                    key={ctx.number}
                    onClick={() => handleViewPR(ctx)}
                  >
                    <GitPullRequest className="h-4 w-4 text-green-500" />
                    <span className="truncate">
                      #{ctx.number} {ctx.title}
                    </span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {attachedSavedContexts.length > 0 && (
              <>
                {loadedIssueContexts.length === 0 &&
                  loadedPRContexts.length === 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Saved Contexts
                </DropdownMenuLabel>
                {attachedSavedContexts.map(ctx => (
                  <DropdownMenuItem
                    key={ctx.slug}
                    onClick={() => handleViewSavedContext(ctx)}
                  >
                    <FolderOpen className="h-4 w-4 text-blue-500" />
                    <span className="truncate">{ctx.name || ctx.slug}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />

            {/* Git actions */}
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Git
            </div>
            <DropdownMenuItem onClick={onCommit}>
              <GitCommitHorizontal className="h-4 w-4" />
              Commit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenPr}>
              <GitPullRequest className="h-4 w-4" />
              Open PR
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onReview}>
              <Eye className="h-4 w-4" />
              Review
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onMerge}
              disabled={isBaseSession || hasOpenPr}
            >
              <GitMerge className="h-4 w-4" />
              Merge to Base
            </DropdownMenuItem>

            {/* Git stats section - conditional */}
            {(hasBranchUpdates ||
              aheadCount > 0 ||
              uncommittedAdded > 0 ||
              uncommittedRemoved > 0 ||
              branchDiffAdded > 0 ||
              branchDiffRemoved > 0 ||
              prUrl) && <DropdownMenuSeparator />}

            {/* Pull */}
            {hasBranchUpdates && (
              <DropdownMenuItem onClick={handlePullClick} disabled={isPulling}>
                <ArrowDown className="h-4 w-4" />
                Pull {behindCount} commit{behindCount === 1 ? '' : 's'}
              </DropdownMenuItem>
            )}

            {/* Push */}
            {aheadCount > 0 && (
              <DropdownMenuItem onClick={handlePushClick} disabled={isPushing}>
                <ArrowUp className="h-4 w-4 text-orange-500" />
                Push {aheadCount} commit{aheadCount === 1 ? '' : 's'}
              </DropdownMenuItem>
            )}

            {/* Uncommitted diff */}
            {(uncommittedAdded > 0 || uncommittedRemoved > 0) && (
              <DropdownMenuItem onClick={handleUncommittedDiffClick}>
                <Pencil className="h-4 w-4" />
                <span>Uncommitted</span>
                <span className="ml-auto text-xs">
                  <span className="text-green-500">+{uncommittedAdded}</span>
                  {' / '}
                  <span className="text-red-500">-{uncommittedRemoved}</span>
                </span>
              </DropdownMenuItem>
            )}

            {/* Branch diff */}
            {(branchDiffAdded > 0 || branchDiffRemoved > 0) && (
              <DropdownMenuItem onClick={handleBranchDiffClick}>
                <GitBranch className="h-4 w-4" />
                <span>Branch diff</span>
                <span className="ml-auto text-xs">
                  <span className="text-green-500">+{branchDiffAdded}</span>
                  {' / '}
                  <span className="text-red-500">-{branchDiffRemoved}</span>
                </span>
              </DropdownMenuItem>
            )}

            {/* PR link */}
            {prUrl && prNumber && (
              <DropdownMenuItem asChild>
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    displayStatus
                      ? getPrStatusDisplay(displayStatus).className
                      : ''
                  )}
                >
                  {displayStatus === 'merged' ? (
                    <GitMerge className="h-4 w-4" />
                  ) : (
                    <GitPullRequest className="h-4 w-4" />
                  )}
                  <span>
                    {displayStatus
                      ? getPrStatusDisplay(displayStatus).label
                      : 'Open'}{' '}
                    #{prNumber}
                  </span>
                  <CheckStatusIcon status={checkStatus ?? null} />
                </a>
              </DropdownMenuItem>
            )}

            {/* PR conflicts */}
            {mergeableStatus === 'conflicting' && (
              <DropdownMenuItem
                onClick={onResolvePrConflicts}
                className="text-amber-600 dark:text-amber-400"
              >
                <GitMerge className="h-4 w-4" />
                Resolve Conflicts
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Send/Cancel button */}
        {isSending ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex size-9 items-center justify-center rounded-lg text-sm font-medium transition-all bg-red-500 text-white hover:bg-red-600 active:scale-95"
            title="Cancel"
          >
            <span className="text-xs">Stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={hasPendingQuestions || !canSend}
            className={cn(
              'flex size-9 items-center justify-center rounded-lg text-sm transition-all disabled:pointer-events-none disabled:opacity-40',
              canSend
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-sm'
                : 'bg-muted text-muted-foreground'
            )}
            title="Send message"
          >
            <Send className="size-4" />
          </button>
        )}
      </div>

      {/* Context viewer dialog */}
      {viewingContext && (
        <Dialog open={true} onOpenChange={() => setViewingContext(null)}>
          <DialogContent className="!max-w-[calc(100vw-8rem)] !w-[calc(100vw-8rem)] !h-[calc(100vh-8rem)] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {viewingContext.type === 'issue' && (
                  <CircleDot className="h-4 w-4 text-green-500" />
                )}
                {viewingContext.type === 'pr' && (
                  <GitPullRequest className="h-4 w-4 text-green-500" />
                )}
                {viewingContext.type === 'saved' && (
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                )}
                {viewingContext.number ? `#${viewingContext.number}: ` : ''}
                {viewingContext.title}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 min-h-0">
              <Markdown className="p-4">{viewingContext.content}</Markdown>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
})
