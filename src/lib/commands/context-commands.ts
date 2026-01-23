import { Download, Upload } from 'lucide-react'
import type { AppCommand } from './types'

export const contextCommands: AppCommand[] = [
  {
    id: 'load-context',
    label: 'Load Context...',
    description: 'Load saved context, issues, or PRs into the session',
    icon: Download,
    group: 'context',
    keywords: ['load', 'context', 'issue', 'pr', 'import', 'attach'],

    execute: context => {
      context.loadContext()
    },

    isAvailable: context => context.hasActiveWorktree(),
  },

  {
    id: 'save-context',
    label: 'Save Context',
    description: 'Save current session context with AI summarization',
    icon: Upload,
    group: 'context',
    keywords: ['save', 'context', 'export', 'summarize', 'snapshot'],

    execute: context => {
      context.saveContext()
    },

    isAvailable: context => context.hasActiveSession(),
  },
]
