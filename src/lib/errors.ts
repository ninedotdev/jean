/**
 * Error handling utilities for consistent error message extraction
 */

/**
 * Extracts a human-readable error message from any error type.
 * Handles Error objects, strings, and Tauri error responses consistently.
 *
 * @param error - Any error value (Error, string, unknown)
 * @returns A string message suitable for displaying to users
 *
 * @example
 * ```typescript
 * try {
 *   await invoke('some_command')
 * } catch (error) {
 *   toast.error(extractErrorMessage(error))
 * }
 * ```
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return 'Unknown error occurred'
}
