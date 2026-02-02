import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  GitBranch,
  Globe,
  Lock,
  GitFork,
  RefreshCw,
  Search,
  AlertCircle,
  Star,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { useProjectsStore } from '@/store/projects-store'
import {
  useGitHubRepos,
  useGitLabRepos,
  useCloneRepository,
} from '@/services/repositories'
import { useGhCliAuth } from '@/services/gh-cli'
import { useGlabCliAuth } from '@/services/glab-cli'
import type { RemoteRepository } from '@/types/repositories'

type Provider = 'github' | 'gitlab'

export function CloneRepoModal() {
  const { cloneRepoModalOpen, cloneRepoModalProvider, closeCloneRepoModal } =
    useUIStore()

  // Local state
  const [activeTab, setActiveTab] = useState<Provider>('github')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItemIndex, setSelectedItemIndex] = useState(0)
  const [useSsh, setUseSsh] = useState(true)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Auth status
  const { data: ghAuth } = useGhCliAuth({ enabled: cloneRepoModalOpen })
  const { data: glabAuth } = useGlabCliAuth({ enabled: cloneRepoModalOpen })

  // Repos queries
  const {
    data: githubRepos,
    isLoading: isLoadingGitHub,
    isFetching: isRefetchingGitHub,
    error: githubError,
    refetch: refetchGitHub,
  } = useGitHubRepos(undefined, {
    enabled: cloneRepoModalOpen && activeTab === 'github' && ghAuth?.authenticated,
  })

  const {
    data: gitlabRepos,
    isLoading: isLoadingGitLab,
    isFetching: isRefetchingGitLab,
    error: gitlabError,
    refetch: refetchGitLab,
  } = useGitLabRepos(undefined, {
    enabled: cloneRepoModalOpen && activeTab === 'gitlab' && glabAuth?.authenticated,
  })

  // Clone mutation
  const cloneMutation = useCloneRepository()

  // Get current data based on active tab
  const repos = activeTab === 'github' ? githubRepos : gitlabRepos
  const isLoading = activeTab === 'github' ? isLoadingGitHub : isLoadingGitLab
  const isRefetching = activeTab === 'github' ? isRefetchingGitHub : isRefetchingGitLab
  const error = activeTab === 'github' ? githubError : gitlabError
  const refetch = activeTab === 'github' ? refetchGitHub : refetchGitLab
  const isAuthenticated =
    activeTab === 'github' ? ghAuth?.authenticated : glabAuth?.authenticated

  // Filter repos by search query
  const filteredRepos = useMemo(() => {
    if (!repos) return []
    if (!searchQuery.trim()) return repos

    const query = searchQuery.toLowerCase()
    return repos.filter(
      repo =>
        repo.name.toLowerCase().includes(query) ||
        repo.fullName.toLowerCase().includes(query) ||
        repo.description?.toLowerCase().includes(query)
    )
  }, [repos, searchQuery])

  // Set initial tab based on provider prop
  useEffect(() => {
    if (cloneRepoModalOpen && cloneRepoModalProvider) {
      setActiveTab(cloneRepoModalProvider)
    }
  }, [cloneRepoModalOpen, cloneRepoModalProvider])

  // Focus search input when modal opens
  useEffect(() => {
    if (cloneRepoModalOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [cloneRepoModalOpen])

  // Reset selection when search or tab changes
  useEffect(() => {
    setSelectedItemIndex(0)
  }, [searchQuery, activeTab])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSearchQuery('')
        setSelectedItemIndex(0)
        closeCloneRepoModal()
      }
    },
    [closeCloneRepoModal]
  )

  const handleTabChange = useCallback((value: string) => {
    if (value) {
      setActiveTab(value as Provider)
      setSearchQuery('')
      setSelectedItemIndex(0)
    }
  }, [])

  const handleClone = useCallback(
    async (repo: RemoteRepository) => {
      const toastId = toast.loading(`Cloning ${repo.name}...`)

      try {
        const project = await cloneMutation.mutateAsync({
          repo,
          useSsh,
        })

        // Expand the projects list to show the new project
        const { expandProject } = useProjectsStore.getState()
        if (project.parent_id) {
          expandProject(project.parent_id)
        }

        toast.success(`Cloned ${repo.name}`, { id: toastId })
        handleOpenChange(false)
      } catch (error) {
        toast.error(`Failed to clone: ${error}`, { id: toastId })
      }
    },
    [cloneMutation, useSsh, handleOpenChange]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const key = e.key.toLowerCase()

      if (filteredRepos.length > 0) {
        if (key === 'arrowdown') {
          e.preventDefault()
          setSelectedItemIndex(prev =>
            Math.min(prev + 1, filteredRepos.length - 1)
          )
          return
        }
        if (key === 'arrowup') {
          e.preventDefault()
          setSelectedItemIndex(prev => Math.max(prev - 1, 0))
          return
        }
        if (key === 'enter' && filteredRepos[selectedItemIndex]) {
          e.preventDefault()
          handleClone(filteredRepos[selectedItemIndex])
          return
        }
      }
    },
    [filteredRepos, selectedItemIndex, handleClone]
  )

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = document.querySelector(
      `[data-clone-item-index="${selectedItemIndex}"]`
    )
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [selectedItemIndex])

  const openLoginModal = useCallback(
    (provider: 'gh' | 'glab') => {
      const { openCliLoginModal } = useUIStore.getState()
      const command = provider === 'gh' ? 'gh auth login' : 'glab auth login'
      openCliLoginModal(provider, command)
    },
    []
  )

  return (
    <Dialog open={cloneRepoModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!max-w-lg h-[550px] p-0 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Clone Repository
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Provider toggle */}
          <div className="px-3 pb-2">
            <ToggleGroup
              type="single"
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full"
            >
              <ToggleGroupItem value="github" className="flex-1">
                GitHub
              </ToggleGroupItem>
              <ToggleGroupItem value="gitlab" className="flex-1">
                GitLab
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Search and options */}
          <div className="px-3 pb-2 space-y-2 border-b border-border">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <button
                onClick={() => refetch()}
                disabled={isRefetching || !isAuthenticated}
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-md border border-border',
                  'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
                  'transition-colors',
                  (isRefetching || !isAuthenticated) &&
                    'opacity-50 cursor-not-allowed'
                )}
                title="Refresh repositories"
              >
                <RefreshCw
                  className={cn(
                    'h-4 w-4 text-muted-foreground',
                    isRefetching && 'animate-spin'
                  )}
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="use-ssh"
                checked={useSsh}
                onCheckedChange={setUseSsh}
              />
              <Label htmlFor="use-ssh" className="text-xs text-muted-foreground cursor-pointer">
                Use SSH for cloning
              </Label>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {/* Not authenticated */}
            {!isAuthenticated && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <AlertCircle className="h-5 w-5 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground mb-3">
                  {activeTab === 'github'
                    ? 'Not authenticated with GitHub'
                    : 'Not authenticated with GitLab'}
                </span>
                <button
                  onClick={() =>
                    openLoginModal(activeTab === 'github' ? 'gh' : 'glab')
                  }
                  className="text-sm text-primary hover:underline"
                >
                  Click here to log in
                </button>
              </div>
            )}

            {/* Loading */}
            {isAuthenticated && isLoading && (
              <div className="flex items-center justify-center py-8">
                <Spinner size={20} />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading repositories...
                </span>
              </div>
            )}

            {/* Error */}
            {isAuthenticated && error && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <AlertCircle className="h-5 w-5 text-destructive mb-2" />
                <span className="text-sm text-muted-foreground">
                  {error instanceof Error
                    ? error.message
                    : 'Failed to load repositories'}
                </span>
              </div>
            )}

            {/* Empty */}
            {isAuthenticated &&
              !isLoading &&
              !error &&
              filteredRepos.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm text-muted-foreground">
                    {searchQuery
                      ? 'No repositories match your search'
                      : 'No repositories found'}
                  </span>
                </div>
              )}

            {/* Repos list */}
            {isAuthenticated &&
              !isLoading &&
              !error &&
              filteredRepos.length > 0 && (
                <div className="py-1">
                  {filteredRepos.map((repo, index) => (
                    <RepoItem
                      key={repo.fullName}
                      repo={repo}
                      index={index}
                      isSelected={index === selectedItemIndex}
                      isCloning={
                        cloneMutation.isPending &&
                        cloneMutation.variables?.repo.fullName === repo.fullName
                      }
                      onMouseEnter={() => setSelectedItemIndex(index)}
                      onClick={() => handleClone(repo)}
                    />
                  ))}
                </div>
              )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface RepoItemProps {
  repo: RemoteRepository
  index: number
  isSelected: boolean
  isCloning: boolean
  onMouseEnter: () => void
  onClick: () => void
}

function RepoItem({
  repo,
  index,
  isSelected,
  isCloning,
  onMouseEnter,
  onClick,
}: RepoItemProps) {
  return (
    <button
      data-clone-item-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      disabled={isCloning}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-2 text-left transition-colors',
        'hover:bg-accent focus:outline-none',
        isSelected && 'bg-accent',
        isCloning && 'opacity-50 cursor-not-allowed'
      )}
    >
      {isCloning ? (
        <Spinner size={16} className="mt-0.5 flex-shrink-0" />
      ) : (
        <GitBranch className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{repo.name}</span>
          {repo.isPrivate && (
            <span title="Private">
              <Lock className="h-3 w-3 text-muted-foreground" />
            </span>
          )}
          {repo.isFork && (
            <span title="Fork">
              <GitFork className="h-3 w-3 text-muted-foreground" />
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {repo.fullName}
        </div>
        {repo.description && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {repo.description}
          </div>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {repo.language && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {repo.language}
            </span>
          )}
          {repo.starsCount > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {repo.starsCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export default CloneRepoModal
