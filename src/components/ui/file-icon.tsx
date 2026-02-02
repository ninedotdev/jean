import { getExtension, getFilename } from '@/lib/path-utils'
import { cn } from '@/lib/utils'
import { File, Folder, FolderOpen } from 'lucide-react'
import type { IconType } from 'react-icons'
import { FaJava } from 'react-icons/fa6'
import {
  SiTypescript,
  SiJavascript,
  SiRust,
  SiHtml5,
  SiCss3,
  SiJson,
  SiMarkdown,
  SiPython,
  SiReact,
  SiDocker,
  SiYaml,
  SiToml,
  SiGnubash,
  SiGit,
  SiBun,
  SiNodedotjs,
  SiVite,
  SiC,
  SiCplusplus,
  SiGo,
  SiKotlin,
  SiSwift,
  SiRuby,
  SiPhp,
  SiLua,
  SiDart,
  SiSvelte,
  SiVuedotjs,
  SiGraphql,
  SiPrisma,
  SiPostgresql,
  SiPnpm,
  SiYarn,
  SiNpm,
  SiEslint,
  SiPrettier,
  SiR,
  SiSass,
  SiLess,
  SiStylus,
  SiTailwindcss,
  SiNextdotjs,
  SiAstro,
} from 'react-icons/si'
import { VscFileMedia, VscFilePdf, VscFileBinary, VscFileCode } from 'react-icons/vsc'

interface FileIconProps {
  path: string
  isDirectory?: boolean
  isExpanded?: boolean
  className?: string
}

// Icon definition with color
type IconDef = {
  icon: IconType | typeof File
  color?: string
}

// Special filename mappings
const FILENAME_ICONS: Record<string, IconDef> = {
  'package.json': { icon: SiNodedotjs, color: 'text-green-600' },
  'tsconfig.json': { icon: SiTypescript, color: 'text-blue-600' },
  'jsconfig.json': { icon: SiJavascript, color: 'text-yellow-500' },
  'bun.lockb': { icon: SiBun, color: 'text-orange-100' },
  'bun.lock': { icon: SiBun, color: 'text-orange-100' },
  'yarn.lock': { icon: SiYarn, color: 'text-blue-500' },
  'pnpm-lock.yaml': { icon: SiPnpm, color: 'text-yellow-500' },
  'package-lock.json': { icon: SiNpm, color: 'text-red-500' },
  'dockerfile': { icon: SiDocker, color: 'text-blue-500' },
  'docker-compose.yml': { icon: SiDocker, color: 'text-blue-500' },
  'docker-compose.yaml': { icon: SiDocker, color: 'text-blue-500' },
  'makefile': { icon: VscFileCode, color: 'text-gray-500' },
  '.gitignore': { icon: SiGit, color: 'text-orange-600' },
  '.gitattributes': { icon: SiGit, color: 'text-orange-600' },
  '.env': { icon: VscFileCode, color: 'text-yellow-500' },
  '.env.local': { icon: VscFileCode, color: 'text-yellow-500' },
  '.editorconfig': { icon: VscFileCode, color: 'text-gray-500' },
  '.eslintrc.js': { icon: SiEslint, color: 'text-purple-500' },
  '.eslintrc.json': { icon: SiEslint, color: 'text-purple-500' },
  'eslint.config.js': { icon: SiEslint, color: 'text-purple-500' },
  '.prettierrc': { icon: SiPrettier, color: 'text-pink-500' },
  'prettier.config.js': { icon: SiPrettier, color: 'text-pink-500' },
  'vite.config.ts': { icon: SiVite, color: 'text-purple-500' },
  'vite.config.js': { icon: SiVite, color: 'text-purple-500' },
  'next.config.js': { icon: SiNextdotjs, color: 'text-black dark:text-white' },
  'tailwind.config.js': { icon: SiTailwindcss, color: 'text-cyan-500' },
  'tailwind.config.ts': { icon: SiTailwindcss, color: 'text-cyan-500' },
  'cargo.toml': { icon: SiRust, color: 'text-orange-500' },
  'cargo.lock': { icon: SiRust, color: 'text-orange-400' },
  'gemfile': { icon: SiRuby, color: 'text-red-500' },
  'go.mod': { icon: SiGo, color: 'text-blue-400' },
  'go.sum': { icon: SiGo, color: 'text-blue-400' },
  'composer.json': { icon: SiPhp, color: 'text-indigo-500' },
  'requirements.txt': { icon: SiPython, color: 'text-blue-500' },
}

// Extension mappings
const EXTENSION_ICONS: Record<string, IconDef> = {
  // Web
  html: { icon: SiHtml5, color: 'text-orange-500' },
  css: { icon: SiCss3, color: 'text-blue-500' },
  scss: { icon: SiSass, color: 'text-pink-500' },
  sass: { icon: SiSass, color: 'text-pink-500' },
  less: { icon: SiLess, color: 'text-blue-800' },
  styl: { icon: SiStylus, color: 'text-green-500' },
  js: { icon: SiJavascript, color: 'text-yellow-500' },
  jsx: { icon: SiReact, color: 'text-blue-400' },
  ts: { icon: SiTypescript, color: 'text-blue-600' },
  tsx: { icon: SiReact, color: 'text-blue-400' },
  svelte: { icon: SiSvelte, color: 'text-orange-500' },
  vue: { icon: SiVuedotjs, color: 'text-green-500' },
  astro: { icon: SiAstro, color: 'text-orange-500' },
  
  // Data / Config
  json: { icon: SiJson, color: 'text-yellow-600' },
  yaml: { icon: SiYaml, color: 'text-red-400' },
  yml: { icon: SiYaml, color: 'text-red-400' },
  toml: { icon: SiToml, color: 'text-gray-400' },
  xml: { icon: VscFileCode, color: 'text-orange-400' },
  csv: { icon: VscFileCode, color: 'text-green-500' },
  ini: { icon: VscFileCode, color: 'text-gray-400' },
  
  // Documentation
  md: { icon: SiMarkdown, color: 'text-blue-300' },
  mdx: { icon: SiMarkdown, color: 'text-blue-300' },
  txt: { icon: VscFileCode, color: 'text-gray-400' },
  pdf: { icon: VscFilePdf, color: 'text-red-500' },
  
  // Images / Media
  png: { icon: VscFileMedia, color: 'text-purple-400' },
  jpg: { icon: VscFileMedia, color: 'text-purple-400' },
  jpeg: { icon: VscFileMedia, color: 'text-purple-400' },
  gif: { icon: VscFileMedia, color: 'text-purple-400' },
  svg: { icon: VscFileMedia, color: 'text-yellow-500' },
  ico: { icon: VscFileMedia, color: 'text-gray-400' },
  webp: { icon: VscFileMedia, color: 'text-purple-400' },
  mp3: { icon: VscFileMedia, color: 'text-purple-400' },
  mp4: { icon: VscFileMedia, color: 'text-purple-400' },
  wav: { icon: VscFileMedia, color: 'text-purple-400' },
  
  // Programming Languages
  rs: { icon: SiRust, color: 'text-orange-500' },
  py: { icon: SiPython, color: 'text-blue-500' },
  pyc: { icon: SiPython, color: 'text-blue-300' },
  pyd: { icon: SiPython, color: 'text-blue-300' },
  go: { icon: SiGo, color: 'text-blue-400' },
  java: { icon: FaJava, color: 'text-red-500' },
  c: { icon: SiC, color: 'text-blue-600' },
  cpp: { icon: SiCplusplus, color: 'text-blue-600' },
  h: { icon: SiC, color: 'text-blue-600' },
  hpp: { icon: SiCplusplus, color: 'text-blue-600' },
  cs: { icon: VscFileCode, color: 'text-purple-600' },
  kt: { icon: SiKotlin, color: 'text-purple-500' },
  kts: { icon: SiKotlin, color: 'text-purple-500' },
  swift: { icon: SiSwift, color: 'text-orange-500' },
  rb: { icon: SiRuby, color: 'text-red-500' },
  php: { icon: SiPhp, color: 'text-indigo-500' },
  lua: { icon: SiLua, color: 'text-blue-500' },
  dart: { icon: SiDart, color: 'text-blue-500' },
  r: { icon: SiR, color: 'text-blue-600' },
  sh: { icon: SiGnubash, color: 'text-green-500' },
  bash: { icon: SiGnubash, color: 'text-green-500' },
  zsh: { icon: SiGnubash, color: 'text-green-500' },
  
  // Database
  sql: { icon: SiPostgresql, color: 'text-blue-400' },
  prisma: { icon: SiPrisma, color: 'text-blue-900 dark:text-blue-100' },
  graphql: { icon: SiGraphql, color: 'text-pink-500' },
  gql: { icon: SiGraphql, color: 'text-pink-500' },
  
  // System / Archives
  zip: { icon: VscFileBinary, color: 'text-yellow-600' },
  tar: { icon: VscFileBinary, color: 'text-yellow-600' },
  gz: { icon: VscFileBinary, color: 'text-yellow-600' },
  
  // Misc
  lock: { icon: VscFileCode, color: 'text-gray-400' },
  diff: { icon: VscFileCode, color: 'text-green-500' },
  patch: { icon: VscFileCode, color: 'text-green-500' },
}

export function FileIcon({ path, isDirectory, isExpanded, className }: FileIconProps) {
  // Folder handling
  if (isDirectory) {
    if (isExpanded) {
      return <FolderOpen className={cn('shrink-0 text-muted-foreground', className)} />
    }
    return <Folder className={cn('shrink-0 text-muted-foreground', className)} />
  }

  const filename = getFilename(path).toLowerCase()
  
  // Exact filename match
  if (FILENAME_ICONS[filename]) {
    const { icon: Icon, color } = FILENAME_ICONS[filename]
    return <Icon className={cn('shrink-0', color, className)} />
  }

  // Extension match
  const ext = getExtension(path).replace('.', '').toLowerCase()
  if (EXTENSION_ICONS[ext]) {
    const { icon: Icon, color } = EXTENSION_ICONS[ext]
    return <Icon className={cn('shrink-0', color, className)} />
  }

  // Default file icon
  return <File className={cn('shrink-0 text-muted-foreground', className)} />
}