import type {
  ReviewFinding,
  FindingSeverity,
  SuggestionOption,
} from '@/types/chat'

// Simple LRU-like cache for parsed findings to avoid re-parsing on every render
// Key: content string, Value: parsed findings array
const findingsCache = new Map<string, ReviewFinding[]>()
const CACHE_MAX_SIZE = 100

/**
 * Parse review findings from Claude's response text
 * Looks for <<<FINDING>>> ... <<<END_FINDING>>> blocks
 * Results are cached to avoid expensive re-parsing on every render
 */
export function parseReviewFindings(content: string): ReviewFinding[] {
  // Check cache first
  const cached = findingsCache.get(content)
  if (cached) return cached

  const findings: ReviewFinding[] = []
  const findingRegex = /<<<FINDING>>>([\s\S]*?)<<<END_FINDING>>>/g

  let match
  while ((match = findingRegex.exec(content)) !== null) {
    const block = match[1]
    if (block) {
      const finding = parseFindingBlock(block)
      if (finding) {
        findings.push(finding)
      }
    }
  }

  // Cache result (evict oldest if full)
  if (findingsCache.size >= CACHE_MAX_SIZE) {
    const firstKey = findingsCache.keys().next().value
    if (firstKey) findingsCache.delete(firstKey)
  }
  findingsCache.set(content, findings)

  return findings
}

/**
 * Parse suggestions from the suggestions field
 * Format:
 * - Label for option 1: code or description
 * - Label for option 2: code or description
 *
 * Falls back to single suggestion if no list format detected
 */
function parseSuggestions(suggestionsText: string): SuggestionOption[] {
  const suggestions: SuggestionOption[] = []

  // Match lines starting with "- " that have a label: value format
  const lines = suggestionsText.split('\n')
  let currentOption: { label: string; codeLines: string[] } | null = null

  for (const line of lines) {
    // Check for new option: "- Label: code"
    const optionMatch = line.match(/^-\s+(.+?):\s*(.*)$/)
    if (optionMatch) {
      // Save previous option if exists
      if (currentOption) {
        suggestions.push({
          label: currentOption.label,
          code: currentOption.codeLines.join('\n').trim(),
        })
      }
      currentOption = {
        label: optionMatch[1]?.trim() ?? '',
        codeLines: [optionMatch[2] ?? ''],
      }
    } else if (currentOption && line.startsWith('  ')) {
      // Continuation of multi-line code (indented)
      currentOption.codeLines.push(line.trim())
    } else if (currentOption && line.trim() === '') {
      // Empty line - could be end of option or part of code
      currentOption.codeLines.push('')
    }
  }

  // Save last option
  if (currentOption) {
    suggestions.push({
      label: currentOption.label,
      code: currentOption.codeLines.join('\n').trim(),
    })
  }

  // If no structured suggestions found, treat whole text as single suggestion
  if (suggestions.length === 0 && suggestionsText.trim()) {
    suggestions.push({
      label: 'Suggested fix',
      code: suggestionsText.trim(),
    })
  }

  return suggestions
}

/**
 * Parse a single finding block into a ReviewFinding object
 */
function parseFindingBlock(block: string): ReviewFinding | null {
  const lines = block.trim().split('\n')
  const data: Record<string, string> = {}

  let currentKey: string | null = null
  let currentValue: string[] = []

  for (const line of lines) {
    // Check if line starts a new field (key: value)
    const fieldMatch = line.match(/^(\w+):\s*(.*)$/)
    if (fieldMatch) {
      // Save previous field if exists
      if (currentKey) {
        data[currentKey] = currentValue.join('\n').trim()
      }
      currentKey = fieldMatch[1] ?? null
      currentValue = [fieldMatch[2] ?? '']
    } else if (currentKey) {
      // Continue multi-line value
      currentValue.push(line)
    }
  }

  // Save last field
  if (currentKey) {
    data[currentKey] = currentValue.join('\n').trim()
  }

  // Validate required fields
  const severity = data.severity?.toLowerCase() as FindingSeverity
  if (!severity || !['error', 'warning', 'info'].includes(severity)) {
    return null
  }

  if (!data.file || !data.line || !data.title) {
    return null
  }

  // Parse suggestions - supports both old "suggestion" field and new "suggestions" field
  const suggestionsText = data.suggestions ?? data.suggestion ?? ''
  const suggestions = parseSuggestions(suggestionsText)

  return {
    severity,
    file: data.file,
    line: data.line,
    title: data.title,
    description: data.description ?? '',
    code: data.code ?? '',
    suggestions,
  }
}

/**
 * Check if content contains any review findings
 */
export function hasReviewFindings(content: string): boolean {
  return (
    content.includes('<<<FINDING>>>') || content.includes('<<<NO_FINDINGS>>>')
  )
}

/**
 * Check if content indicates no findings
 */
export function hasNoFindings(content: string): boolean {
  return content.includes('<<<NO_FINDINGS>>>')
}

/**
 * Remove finding blocks from content (for rendering the rest as markdown)
 * Keeps the content before and after the findings section
 */
export function stripFindingBlocks(content: string): string {
  // Remove all <<<FINDING>>> ... <<<END_FINDING>>> blocks
  let stripped = content.replace(/<<<FINDING>>>[\s\S]*?<<<END_FINDING>>>/g, '')

  // Remove <<<NO_FINDINGS>>> ... <<<END_NO_FINDINGS>>> blocks
  stripped = stripped.replace(
    /<<<NO_FINDINGS>>>[\s\S]*?<<<END_NO_FINDINGS>>>/g,
    ''
  )

  // Clean up excessive newlines left behind
  stripped = stripped.replace(/\n{3,}/g, '\n\n')

  return stripped.trim()
}

/**
 * Generate a unique key for a finding based on its content
 */
export function getFindingKey(finding: ReviewFinding, index: number): string {
  return `${finding.file}:${finding.line}:${index}`
}
