import { useState, useEffect, useRef } from 'react'
import { Plus, Folder, Archive, Briefcase, Settings, Download, Search } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useSidebarWidth } from '@/components/layout/SidebarWidthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useProjects,
  useCreateFolder,
} from '@/services/projects'
import { usePreferences } from '@/services/preferences'
import { fetchWorktreesStatus } from '@/services/git-status'
import { prefetchSessions } from '@/services/chat'
import { useProjectsStore } from '@/store/projects-store'
import { useUIStore } from '@/store/ui-store'
import { ProjectTree } from './ProjectTree'
import { AddProjectDialog } from './AddProjectDialog'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import { ArchivedModal } from '@/components/archive/ArchivedModal'
import { ProviderUsageSidebar } from './ProviderUsageSidebar'
import type { Worktree } from '@/types/projects'

export function ProjectsSidebar() {
  const { data: projects = [], isLoading } = useProjects()
  const { data: preferences } = usePreferences()
  const { setAddProjectDialogOpen } = useProjectsStore()
  const [archivedModalOpen, setArchivedModalOpen] = useState(false)
  const createFolder = useCreateFolder()
  const queryClient = useQueryClient()
  const sidebarWidth = useSidebarWidth()

  // Responsive layout threshold
  const isNarrow = sidebarWidth < 180

  // Listen for command palette events
  useEffect(() => {
    const handleOpenArchivedModal = () => setArchivedModalOpen(true)
    window.addEventListener('command:open-archived-modal', handleOpenArchivedModal)
    return () =>
      window.removeEventListener('command:open-archived-modal', handleOpenArchivedModal)
  }, [])

  // Fetch worktree status and sessions for all projects on startup
  // Priority: expanded projects first, then all others
  const hasFetchedRef = useRef(false)
  useEffect(() => {
    if (hasFetchedRef.current || projects.length === 0) return
    hasFetchedRef.current = true

    // Filter to only actual projects (not folders)
    const actualProjects = projects.filter(p => !p.is_folder)
    if (actualProjects.length === 0) return

    // Get expanded projects from store (use getState to avoid subscription)
    const { expandedProjectIds } = useProjectsStore.getState()

    // Split into expanded (priority) and collapsed projects
    const expandedProjects = actualProjects.filter(p => expandedProjectIds.has(p.id))
    const collapsedProjects = actualProjects.filter(p => !expandedProjectIds.has(p.id))

    // Fetch git status for a batch of projects
    const fetchGitStatusBatch = async (batch: typeof actualProjects) => {
      await Promise.all(
        batch.map(p =>
          fetchWorktreesStatus(p.id).catch(err =>
            console.warn(`[startup] Failed to fetch git status for ${p.name}:`, err)
          )
        )
      )
    }

    // Fetch sessions for all worktrees in a project
    const fetchSessionsForProject = async (projectId: string) => {
      try {
        const worktrees = await invoke<Worktree[]>('list_worktrees', { projectId })
        await Promise.all(
          worktrees.map(w =>
            prefetchSessions(queryClient, w.id, w.path).catch(err =>
              console.warn(`[startup] Failed to prefetch sessions for ${w.name}:`, err)
            )
          )
        )
      } catch (err) {
        console.warn(`[startup] Failed to list worktrees for project ${projectId}:`, err)
      }
    }

    const fetchAll = async () => {
      const concurrencyLimit = 3

      console.info(
        '[startup] Fetching worktree status and sessions: expanded=%d, collapsed=%d',
        expandedProjects.length,
        collapsedProjects.length
      )

      // First: fetch expanded projects (user sees these immediately)
      // Fetch both git status and sessions in parallel
      for (let i = 0; i < expandedProjects.length; i += concurrencyLimit) {
        const batch = expandedProjects.slice(i, i + concurrencyLimit)
        await Promise.all([
          fetchGitStatusBatch(batch),
          ...batch.map(p => fetchSessionsForProject(p.id)),
        ])
      }

      // Then: fetch collapsed projects in background (lazy load for when user expands)
      for (let i = 0; i < collapsedProjects.length; i += concurrencyLimit) {
        const batch = collapsedProjects.slice(i, i + concurrencyLimit)
        await Promise.all([
          fetchGitStatusBatch(batch),
          ...batch.map(p => fetchSessionsForProject(p.id)),
        ])
      }

      console.info('[startup] Done fetching worktree status and sessions for all projects')
    }

    fetchAll()
  }, [projects, queryClient])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-3 py-2 pt-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Workspaces
        </span>
      </div>

      {/* Search bar */}
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
          className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Multi-provider usage limits */}
      {preferences?.show_usage_status_bar && <ProviderUsageSidebar />}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onAddProject={() => setAddProjectDialogOpen(true)} />
        ) : (
          <ProjectTree projects={projects} />
        )}
      </div>

      {/* Footer - simplified */}
      <div className="flex items-center gap-1 p-1.5 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <Plus className="size-4" />
              {!isNarrow && <span>Add</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => useUIStore.getState().openCloneRepoModal()}>
              <Download className="mr-2 size-3.5" />
              Clone Repository
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddProjectDialogOpen(true)}>
              <Briefcase className="mr-2 size-3.5" />
              Add Local Repository
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createFolder.mutate({ name: 'New Folder' })}>
              <Folder className="mr-2 size-3.5" />
              New Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              title="More options"
            >
              <Settings className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setArchivedModalOpen(true)}>
              <Archive className="mr-2 size-3.5" />
              View Archived
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialogs */}
      <AddProjectDialog />
      <ProjectSettingsDialog />
      <ArchivedModal
        open={archivedModalOpen}
        onOpenChange={setArchivedModalOpen}
      />
    </div>
  )
}

function EmptyState({ onAddProject }: { onAddProject: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Plus className="h-10 w-10 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium">No projects yet</p>
        <p className="text-xs text-muted-foreground">
          Add a git repository to get started
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onAddProject}>
        <Plus className="mr-2 h-4 w-4" />
        Add Project
      </Button>
    </div>
  )
}
