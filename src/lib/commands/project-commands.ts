import { FolderPlus, FolderGit, Trash2, Download } from 'lucide-react'
import type { AppCommand } from './types'

export const projectCommands: AppCommand[] = [
  {
    id: 'add-project',
    label: 'Add Project',
    description: 'Add an existing git repository as a project',
    icon: FolderPlus,
    group: 'projects',
    keywords: ['project', 'add', 'import', 'repository', 'git'],

    execute: context => {
      context.addProject()
    },
  },

  {
    id: 'init-project',
    label: 'Initialize Project',
    description: 'Create a new project from scratch',
    icon: FolderGit,
    group: 'projects',
    keywords: ['project', 'init', 'new', 'create', 'initialize'],

    execute: context => {
      context.initProject()
    },
  },

  {
    id: 'clone-github-repo',
    label: 'Clone from GitHub',
    description: 'Clone a repository from GitHub',
    icon: Download,
    group: 'projects',
    keywords: ['clone', 'github', 'repository', 'download', 'git'],

    execute: context => {
      context.cloneFromGitHub()
    },
  },

  {
    id: 'clone-gitlab-repo',
    label: 'Clone from GitLab',
    description: 'Clone a repository from GitLab',
    icon: Download,
    group: 'projects',
    keywords: ['clone', 'gitlab', 'repository', 'download', 'git'],

    execute: context => {
      context.cloneFromGitLab()
    },
  },

  {
    id: 'remove-project',
    label: 'Remove Project',
    description: 'Remove the current project from the sidebar',
    icon: Trash2,
    group: 'projects',
    keywords: ['project', 'remove', 'delete'],

    execute: context => {
      context.removeProject()
    },

    isAvailable: context => context.hasSelectedProject(),
  },
]
