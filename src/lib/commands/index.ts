// Command system exports
export * from './registry'
export * from '../../hooks/use-command-context'
import { navigationCommands } from './navigation-commands'
import { windowCommands } from './window-commands'
import { notificationCommands } from './notification-commands'
import { githubCommands } from './github-commands'
import { sessionCommands } from './session-commands'
import { worktreeCommands } from './worktree-commands'
import { gitCommands } from './git-commands'
import { openInCommands } from './open-in-commands'
import { modelCommands } from './model-commands'
import { executionCommands } from './execution-commands'
import { projectCommands } from './project-commands'
import { archiveCommands } from './archive-commands'
import { contextCommands } from './context-commands'
import { aiCommands } from './ai-commands'
import { terminalCommands } from './terminal-commands'
import { registerCommands } from './registry'

/**
 * Initialize the command system by registering all commands.
 * This should be called once during app initialization.
 */
export function initializeCommandSystem(): void {
  registerCommands(navigationCommands)
  registerCommands(windowCommands)
  registerCommands(notificationCommands)
  registerCommands(githubCommands)
  registerCommands(sessionCommands)
  registerCommands(worktreeCommands)
  registerCommands(gitCommands)
  registerCommands(openInCommands)
  registerCommands(modelCommands)
  registerCommands(executionCommands)
  registerCommands(projectCommands)
  registerCommands(archiveCommands)
  registerCommands(contextCommands)
  registerCommands(aiCommands)
  registerCommands(terminalCommands)

  if (import.meta.env.DEV) {
    console.log('Command system initialized')
  }
}

export {
  navigationCommands,
  windowCommands,
  notificationCommands,
  githubCommands,
  sessionCommands,
  worktreeCommands,
  gitCommands,
  openInCommands,
  modelCommands,
  executionCommands,
  projectCommands,
  archiveCommands,
  contextCommands,
  aiCommands,
  terminalCommands,
}
