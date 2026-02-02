/**
 * Utility to parse plan content and extract individual tasks
 */

export interface ParsedTask {
  id: string
  description: string
  originalText: string
}

/**
 * Extract tasks from markdown plan content
 * Looks for numbered lists, checkboxes, or bullet points
 *
 * Supports formats:
 * - "1. Task description"
 * - "- [ ] Task description" (unchecked only, skips completed [x])
 * - "- Task description"
 * - "* Task description"
 */
export function parsePlanTasks(planContent: string): ParsedTask[] {
  const tasks: ParsedTask[] = []

  // Split by lines and process each
  const lines = planContent.split('\n')

  let index = 0
  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and headers
    if (!trimmed || trimmed.startsWith('#')) continue

    // Skip indented lines (sub-tasks, notes, etc.)
    // We only want top-level tasks to be delegateable
    if (line.startsWith(' ') || line.startsWith('\t')) continue

    // Match numbered items: "1. ", "2. ", etc.
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (numberedMatch && numberedMatch[2]) {
      tasks.push({
        id: `task-${index++}`,
        description: numberedMatch[2].trim(),
        originalText: trimmed,
      })
      continue
    }

    // Match unchecked checkboxes only: "- [ ] " (skip completed "- [x] ")
    const checkboxMatch = trimmed.match(/^-\s*\[ \]\s+(.+)$/)
    if (checkboxMatch && checkboxMatch[1]) {
      tasks.push({
        id: `task-${index++}`,
        description: checkboxMatch[1].trim(),
        originalText: trimmed,
      })
      continue
    }

    // Match bullets: "- ", "* "
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch && bulletMatch[1]) {
      // Skip if it looks like a sub-item or note (starts with lowercase after common prefixes)
      const desc = bulletMatch[1].trim()
      // Only include if it looks like a task (starts with verb or capital letter)
      if (desc.length > 0 && /^[A-Z]/.test(desc)) {
        tasks.push({
          id: `task-${index++}`,
          description: desc,
          originalText: trimmed,
        })
      }
      continue
    }
  }

  return tasks
}

/**
 * Extract plan content from ExitPlanMode tool call or Write tool call to plan file
 */
export function extractPlanFromToolCalls(
  toolCalls: { name: string; input: unknown }[]
): string | null {
  // First, check for ExitPlanMode with inline plan
  for (const tc of toolCalls) {
    if (tc.name === 'ExitPlanMode') {
      const input = tc.input as { plan?: string } | undefined
      if (input?.plan) {
        return input.plan
      }
    }
  }

  // Then, check for Write to plan file
  for (const tc of toolCalls) {
    if (tc.name === 'Write') {
      const input = tc.input as { file_path?: string; content?: string } | undefined
      if (input?.file_path?.includes('.claude/plans/') && input?.content) {
        return input.content
      }
    }
  }

  return null
}
