import { Sparkles, Brain, Zap, CircleDot } from 'lucide-react'
import type { AppCommand } from './types'

export const modelCommands: AppCommand[] = [
  // Model selection commands
  {
    id: 'set-model-opus',
    label: 'Model: Claude Opus',
    description: 'Switch to Claude Opus (most capable)',
    icon: Sparkles,
    group: 'model',
    keywords: ['model', 'opus', 'claude', 'ai'],

    execute: context => {
      context.setModel('opus')
    },

    isAvailable: context => context.getCurrentModel() !== 'opus',
  },

  {
    id: 'set-model-sonnet',
    label: 'Model: Claude Sonnet',
    description: 'Switch to Claude Sonnet (balanced)',
    icon: Sparkles,
    group: 'model',
    keywords: ['model', 'sonnet', 'claude', 'ai'],

    execute: context => {
      context.setModel('sonnet')
    },

    isAvailable: context => context.getCurrentModel() !== 'sonnet',
  },

  {
    id: 'set-model-haiku',
    label: 'Model: Claude Haiku',
    description: 'Switch to Claude Haiku (fastest)',
    icon: Sparkles,
    group: 'model',
    keywords: ['model', 'haiku', 'claude', 'ai', 'fast'],

    execute: context => {
      context.setModel('haiku')
    },

    isAvailable: context => context.getCurrentModel() !== 'haiku',
  },

  // Thinking level commands
  {
    id: 'thinking-off',
    label: 'Thinking: Off',
    description: 'Disable extended thinking',
    icon: CircleDot,
    group: 'thinking',
    keywords: ['thinking', 'off', 'disable', 'normal'],

    execute: context => {
      context.setThinkingLevel('off')
    },

    isAvailable: context =>
      context.hasActiveSession() && context.getCurrentThinkingLevel() !== 'off',
  },

  {
    id: 'thinking-think',
    label: 'Thinking: Think (4K)',
    description: 'Enable basic extended thinking',
    icon: Brain,
    group: 'thinking',
    keywords: ['thinking', 'think', 'basic', '4k'],

    execute: context => {
      context.setThinkingLevel('think')
    },

    isAvailable: context =>
      context.hasActiveSession() &&
      context.getCurrentThinkingLevel() !== 'think',
  },

  {
    id: 'thinking-megathink',
    label: 'Thinking: Megathink (10K)',
    description: 'Enable extended thinking with more tokens',
    icon: Brain,
    group: 'thinking',
    keywords: ['thinking', 'megathink', 'extended', '10k'],

    execute: context => {
      context.setThinkingLevel('megathink')
    },

    isAvailable: context =>
      context.hasActiveSession() &&
      context.getCurrentThinkingLevel() !== 'megathink',
  },

  {
    id: 'thinking-ultrathink',
    label: 'Thinking: Ultrathink (32K)',
    description: 'Enable maximum extended thinking',
    icon: Zap,
    group: 'thinking',
    keywords: ['thinking', 'ultrathink', 'maximum', '32k'],

    execute: context => {
      context.setThinkingLevel('ultrathink')
    },

    isAvailable: context =>
      context.hasActiveSession() &&
      context.getCurrentThinkingLevel() !== 'ultrathink',
  },
]
