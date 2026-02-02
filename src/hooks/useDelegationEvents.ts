import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useChatStore } from '@/store/chat-store'
import { logger } from '@/lib/logger'

/**
 * Event payloads from Rust backend for delegation progress
 */
interface DelegationTaskStartedEvent {
  session_id: string
  worktree_id: string
  task_id: string
  task_index: number
  total_tasks: number
  provider: string
  model: string
}

interface DelegationTaskCompletedEvent {
  session_id: string
  worktree_id: string
  task_id: string
  task_index: number
  total_tasks: number
  output: string | null
}

interface DelegationTaskFailedEvent {
  session_id: string
  worktree_id: string
  task_id: string
  task_index: number
  total_tasks: number
  error: string
}

interface DelegationTaskOutputEvent {
  session_id: string
  worktree_id: string
  content: string
}

interface DelegationCompletedEvent {
  session_id: string
  worktree_id: string
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
}

/**
 * Hook to listen for delegation progress events from the Rust backend
 *
 * This enables real-time UI updates as delegated tasks execute,
 * rather than waiting for the entire delegation to complete.
 */
export function useDelegationEvents() {
  useEffect(() => {
    const setupListeners = async () => {
      const unlisteners = await Promise.all([
        listen<DelegationTaskStartedEvent>(
          'delegation:task-started',
          event => {
            const {
              session_id,
              task_id,
              task_index,
              total_tasks,
              provider,
              model,
            } = event.payload

            logger.info('Delegation task started', {
              sessionId: session_id,
              taskId: task_id,
              taskIndex: task_index,
              totalTasks: total_tasks,
              provider,
              model,
            })

            const { updateDelegatedTaskStatus, setCurrentDelegationProgress } =
              useChatStore.getState()

            // Update task status to in_progress
            updateDelegatedTaskStatus(session_id, task_id, 'in_progress')

            // Update progress tracking
            setCurrentDelegationProgress(session_id, {
              currentTaskIndex: task_index,
              totalTasks: total_tasks,
              currentTaskId: task_id,
              currentProvider: provider,
              currentModel: model,
              output: '',
            })
          }
        ),

        listen<DelegationTaskCompletedEvent>(
          'delegation:task-completed',
          event => {
            const { session_id, task_id, task_index, total_tasks, output } =
              event.payload

            logger.info('Delegation task completed', {
              sessionId: session_id,
              taskId: task_id,
              taskIndex: task_index,
              totalTasks: total_tasks,
            })

            const { updateDelegatedTaskStatus, setCurrentDelegationProgress } =
              useChatStore.getState()

            // Update task status to completed
            updateDelegatedTaskStatus(session_id, task_id, 'completed')

            // Update progress - clear current task output for next task
            setCurrentDelegationProgress(session_id, {
              currentTaskIndex: task_index,
              totalTasks: total_tasks,
              currentTaskId: task_id,
              completedOutput: output ?? undefined,
              output: '',
            })
          }
        ),

        listen<DelegationTaskFailedEvent>(
          'delegation:task-failed',
          event => {
            const { session_id, task_id, task_index, total_tasks, error } =
              event.payload

            logger.warn('Delegation task failed', {
              sessionId: session_id,
              taskId: task_id,
              taskIndex: task_index,
              totalTasks: total_tasks,
              error,
            })

            const { updateDelegatedTaskStatus, setCurrentDelegationProgress } =
              useChatStore.getState()

            // Update task status to failed with error
            updateDelegatedTaskStatus(session_id, task_id, 'failed', error)

            // Update progress
            setCurrentDelegationProgress(session_id, {
              currentTaskIndex: task_index,
              totalTasks: total_tasks,
              currentTaskId: task_id,
              error,
              output: '',
            })
          }
        ),

        listen<DelegationTaskOutputEvent>('delegation:task-output', event => {
          const { session_id, content } = event.payload

          // Append streaming output to current progress
          const { appendDelegationOutput } = useChatStore.getState()
          appendDelegationOutput(session_id, content)
        }),

        listen<DelegationCompletedEvent>('delegation:completed', event => {
          const {
            session_id,
            total_tasks,
            completed_tasks,
            failed_tasks,
          } = event.payload

          logger.info('Delegation completed', {
            sessionId: session_id,
            totalTasks: total_tasks,
            completedTasks: completed_tasks,
            failedTasks: failed_tasks,
          })

          // Clear progress tracking when delegation finishes
          const { clearDelegationProgress } = useChatStore.getState()
          clearDelegationProgress(session_id)
        }),
      ])

      logger.debug('Delegation event listeners set up successfully')
      return unlisteners
    }

    let unlisteners: (() => void)[] = []
    setupListeners()
      .then(listeners => {
        unlisteners = listeners
      })
      .catch(error => {
        logger.error('Failed to setup delegation event listeners', { error })
      })

    return () => {
      unlisteners.forEach(unlisten => {
        if (unlisten && typeof unlisten === 'function') {
          unlisten()
        }
      })
    }
  }, [])
}
