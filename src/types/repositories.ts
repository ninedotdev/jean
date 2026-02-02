/**
 * Repository information from GitHub or GitLab
 */
export interface RemoteRepository {
  /** Repository name (e.g., "my-repo") */
  name: string
  /** Full name including owner (e.g., "owner/my-repo") */
  fullName: string
  /** Repository description */
  description: string | null
  /** HTTPS clone URL */
  cloneUrl: string
  /** SSH clone URL */
  sshUrl: string
  /** Whether the repository is private */
  isPrivate: boolean
  /** Whether the repository is a fork */
  isFork: boolean
  /** Default branch name */
  defaultBranch: string
  /** Last updated timestamp (ISO format) */
  updatedAt: string
  /** Primary language */
  language: string | null
  /** Star count */
  starsCount: number
  /** Git provider ("github" or "gitlab") */
  provider: 'github' | 'gitlab'
}
