/**
 * Git diff types for displaying GitHub-style diffs
 */

/** A single line in a diff hunk */
export interface DiffLine {
  /** Line type: "context", "addition", "deletion" */
  line_type: 'context' | 'addition' | 'deletion'
  /** The actual content (without +/- prefix) */
  content: string
  /** Old line number (null for additions) */
  old_line_number: number | null
  /** New line number (null for deletions) */
  new_line_number: number | null
}

/** A single hunk in a diff */
export interface DiffHunk {
  /** Header line (e.g., "@@ -1,5 +1,7 @@") */
  header: string
  /** Old file starting line */
  old_start: number
  /** Old file line count */
  old_lines: number
  /** New file starting line */
  new_start: number
  /** New file line count */
  new_lines: number
  /** Lines in this hunk */
  lines: DiffLine[]
}

/** A single file in a diff */
export interface DiffFile {
  /** File path relative to repo root */
  path: string
  /** Previous file path (for renames) */
  old_path: string | null
  /** File status: "added", "modified", "deleted", "renamed" */
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  /** Lines added */
  additions: number
  /** Lines removed */
  deletions: number
  /** Whether this is a binary file */
  is_binary: boolean
  /** The actual diff hunks */
  hunks: DiffHunk[]
}

/** Complete diff response */
export interface GitDiff {
  /** Type of diff: "uncommitted" or "branch" */
  diff_type: 'uncommitted' | 'branch'
  /** Base ref (e.g., "origin/main" or "HEAD") */
  base_ref: string
  /** Target ref (e.g., "HEAD" or "working directory") */
  target_ref: string
  /** Total lines added */
  total_additions: number
  /** Total lines removed */
  total_deletions: number
  /** Files changed */
  files: DiffFile[]
  /** Raw unified diff patch output (for rendering with external libraries) */
  raw_patch: string
}

/** Request to open the diff modal */
export interface DiffRequest {
  type: 'uncommitted' | 'branch'
  worktreePath: string
  baseBranch: string
}
