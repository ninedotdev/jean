import { FileSearch } from 'lucide-react'
import type { AppCommand } from './types'

export const aiCommands: AppCommand[] = [
  {
    id: 'run-ai-review',
    label: 'Run AI Review',
    description: 'Run AI code review on current worktree changes',
    icon: FileSearch,
    group: 'ai',
    keywords: ['review', 'ai', 'code', 'analyze', 'check', 'audit'],

    execute: async context => {
      await context.runAIReview()
    },

    isAvailable: context => context.hasActiveWorktree(),
  },
]
