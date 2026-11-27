/** Path classification and safe materialization helpers. */

import path from 'node:path'

import type { ChangedFile } from './types.ts'

const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.c', '.cc', '.cpp', '.cs', '.dart', '.ex', '.exs', '.go', '.graphql', '.h', '.hpp', '.hs', '.java',
  '.js', '.jsx', '.kt', '.kts', '.lua', '.m', '.mm', '.php', '.pl', '.proto', '.py', '.r', '.rb', '.rs',
  '.scala', '.sh', '.sql', '.svelte', '.swift', '.ts', '.tsx', '.vue', '.zig', '.clj', '.erl', '.nim',
])

const DOC_EXTENSIONS: ReadonlySet<string> = new Set(['.md', '.mdx', '.rst', '.txt', '.adoc'])

const CONFIG_EXTENSIONS: ReadonlySet<string> = new Set([
  '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.properties', '.xml', '.env',
])

const TEXT_BASENAMES: ReadonlySet<string> = new Set([
  'Makefile', 'Dockerfile', 'Containerfile', 'LICENSE', 'LICENCE', 'NOTICE', 'README', 'Procfile',
  'Gemfile', 'Rakefile', 'Justfile', 'Cargo.toml', 'go.mod', '.gitignore', '.dockerignore',
  '.editorconfig', '.npmrc', '.nvmrc', '.prettierrc', '.eslintrc', '.babelrc',
])

const GENERATED_PATTERNS: readonly RegExp[] = [
  /(^|\/)(node_modules|bower_components|vendor|dist|build|out|coverage|target|__snapshots__|\.next|\.nuxt|\.cache)\//i,
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|composer\.lock|Cargo\.lock|go\.sum|poetry\.lock|Pipfile\.lock|Gemfile\.lock|mix\.lock|pubspec\.lock|flake\.lock)$/i,
  /\.min\.(js|css|mjs)$/i,
  /\.(map|snap)$/i,
  /(^|\/)(generated|gen)\//i,
]

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

/**
 * Whether a changed path is build output, a lockfile, or another generated artifact.
 * @param filePath - repository-relative path.
 * @returns true when the path should not consume review context.
 */
export function isGenerated(filePath: string): boolean {
  return GENERATED_PATTERNS.some(pattern => pattern.test(filePath))
}

/**
 * Rank a changed file for inclusion.
 * @param file - GitHub file entry fields used for ranking.
 * @returns larger values are reviewed first.
 */
export function scoreFile(file: Pick<ChangedFile, 'filename' | 'status' | 'additions' | 'deletions'>): number {
  if (isGenerated(file.filename)) return -1000
  const extension = path.posix.extname(file.filename).toLowerCase()
  const name = file.filename.split('/').at(-1) ?? file.filename
  const looksLikeTest = /(^|\/)(__tests__|tests?|specs?)\//i.test(file.filename)
    || /(^|\.)(test|spec)\.[^.]+$/i.test(name)
    || /_test\.[^.]+$/i.test(name)
    || /^test_.*\.py$/i.test(name)
    || /(Test|Tests)\.(java|kt|cs)$/.test(name)
  if (looksLikeTest) return 80
  if (SOURCE_EXTENSIONS.has(extension)) return 100
  if (CONFIG_EXTENSIONS.has(extension)) return 60
  if (DOC_EXTENSIONS.has(extension)) return 15
  if (TEXT_BASENAMES.has(name)) return 50
  return 40
}

/**
 * Whether an unknown-patch file is worth a complete-text request.
 * Files that GitHub returned a patch for are text regardless of this predicate.
 * @param filePath - repository-relative path.
 * @returns true when the file is likely text.
 */
export function isProbablyText(filePath: string): boolean {
  const extension = path.posix.extname(filePath).toLowerCase()
  const name = filePath.split('/').at(-1) ?? filePath
  return SOURCE_EXTENSIONS.has(extension)
    || DOC_EXTENSIONS.has(extension)
    || CONFIG_EXTENSIONS.has(extension)
    || TEXT_BASENAMES.has(name)
}

/**
 * Validate a repository-relative path before joining it under the context root.
 * @param value - candidate path.
 * @returns the normalized path, or null when unsafe.
 */
export function safeRepositoryPath(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null
  if (CONTROL_CHARACTERS.test(value) || value.includes('\\') || value.startsWith('/')) return null
  if (value.length > 4096) return null
  const segments = value.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..' || segment.length > 255) return null
  }
  return segments.join('/')
}

/**
 * Encode each segment of a repository path for the contents API.
 * @param value - validated repository-relative path.
 * @returns encoded path with `/` separators preserved.
 */
export function encodeRepositoryPath(value: string): string {
  return value.split('/').map(encodeURIComponent).join('/')
}

/**
 * Build a filesystem-friendly patch filename from the repository path.
 * @param value - repository-relative path.
 * @returns a short basename.
 */
export function patchBasename(value: string): string {
  const name = value.split('/').at(-1) ?? 'file'
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 80)
  return cleaned === '' ? 'file' : cleaned
}

/**
 * Zero-padded file index used in context paths.
 * @param index - 1-based file position.
 * @returns four-digit index.
 */
export function padIndex(index: number): string {
  return String(index).padStart(4, '0')
}
