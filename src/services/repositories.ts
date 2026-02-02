/**
 * Repository listing and cloning service
 *
 * Provides TanStack Query hooks for listing repositories from GitHub/GitLab
 * and cloning them to the workspace.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import type { RemoteRepository } from '@/types/repositories'
import type { Project } from '@/types/projects'
import { projectsQueryKeys } from './projects'

// Check if running in Tauri context (vs plain browser)
const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Query keys for repositories
export const repositoriesQueryKeys = {
  all: ['repositories'] as const,
  github: () => [...repositoriesQueryKeys.all, 'github'] as const,
  githubList: (owner?: string) =>
    [...repositoriesQueryKeys.github(), 'list', owner ?? 'me'] as const,
  gitlab: () => [...repositoriesQueryKeys.all, 'gitlab'] as const,
  gitlabList: (group?: string) =>
    [...repositoriesQueryKeys.gitlab(), 'list', group ?? 'me'] as const,
}

/**
 * Hook to list GitHub repositories for the authenticated user or a specific owner/org
 */
export function useGitHubRepos(owner?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: repositoriesQueryKeys.githubList(owner),
    queryFn: async (): Promise<RemoteRepository[]> => {
      if (!isTauri()) {
        logger.debug('Not in Tauri context, returning empty repos list')
        return []
      }

      try {
        logger.debug('Fetching GitHub repositories', { owner })
        const repos = await invoke<RemoteRepository[]>('list_github_repos', {
          owner: owner ?? null,
          limit: 100,
        })
        logger.info('Fetched GitHub repositories', { count: repos.length })
        return repos
      } catch (error) {
        logger.error('Failed to fetch GitHub repositories', { error })
        throw error
      }
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  })
}

/**
 * Hook to list GitLab repositories for the authenticated user or a specific group
 */
export function useGitLabRepos(group?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: repositoriesQueryKeys.gitlabList(group),
    queryFn: async (): Promise<RemoteRepository[]> => {
      if (!isTauri()) {
        logger.debug('Not in Tauri context, returning empty repos list')
        return []
      }

      try {
        logger.debug('Fetching GitLab repositories', { group })
        const repos = await invoke<RemoteRepository[]>('list_gitlab_repos', {
          group: group ?? null,
        })
        logger.info('Fetched GitLab repositories', { count: repos.length })
        return repos
      } catch (error) {
        logger.error('Failed to fetch GitLab repositories', { error })
        throw error
      }
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  })
}

interface CloneRepositoryParams {
  repo: RemoteRepository
  parentId?: string
  useSsh: boolean
}

/**
 * Hook to clone a repository and register it as a project
 */
export function useCloneRepository() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      repo,
      parentId,
      useSsh,
    }: CloneRepositoryParams): Promise<Project> => {
      if (!isTauri()) {
        throw new Error('Cannot clone repository outside Tauri context')
      }

      const cloneUrl = useSsh ? repo.sshUrl : repo.cloneUrl

      logger.info('Cloning repository', {
        name: repo.name,
        provider: repo.provider,
        useSsh,
      })

      const project = await invoke<Project>('clone_repository', {
        cloneUrl,
        repoName: repo.name,
        provider: repo.provider,
        parentId: parentId ?? null,
        useSsh,
      })

      return project
    },
    onSuccess: project => {
      // Invalidate projects list to show the new project
      queryClient.invalidateQueries({ queryKey: projectsQueryKeys.list() })
      logger.info('Repository cloned successfully', { project: project.name })
    },
    onError: error => {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('Failed to clone repository', { error })
      toast.error('Failed to clone repository', { description: message })
    },
  })
}
