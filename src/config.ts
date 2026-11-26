/** Validated settings for the code-review plugin. */

import type { Language, Settings } from './types.js'

export const DEFAULT_SETTINGS = Object.freeze({
  ghCommand: 'gh',
  maxFiles: 200,
  maxPatchBytes: 256 * 1024,
  maxFileBytes: 128 * 1024,
  maxTotalFileBytes: 8 * 1024 * 1024,
  maxFindings: 15,
  language: 'auto',
  retentionDays: 7,
  requestTimeoutMs: 30_000,
  concurrency: 4,
} satisfies Settings)

const LANGUAGES: ReadonlySet<string> = new Set(['auto', 'zh', 'en'])

/**
 * Merge the row configuration over the defaults and reject unusable values.
 * @param raw - Loader-supplied row configuration.
 * @returns complete settings.
 */
export function normalizeSettings(raw: unknown): Settings {
  const input = isRecord(raw) ? raw : {}
  return {
    ghCommand: stringValue(unwrap(input.ghCommand), 'ghCommand', 'gh'),
    maxFiles: integerValue(unwrap(input.maxFiles), 'maxFiles', 200, 1, 2000),
    maxPatchBytes: integerValue(unwrap(input.maxPatchBytes), 'maxPatchBytes', 256 * 1024, 1024, 16 * 1024 * 1024),
    maxFileBytes: integerValue(unwrap(input.maxFileBytes), 'maxFileBytes', 128 * 1024, 1024, 4 * 1024 * 1024),
    maxTotalFileBytes: integerValue(unwrap(input.maxTotalFileBytes), 'maxTotalFileBytes', 8 * 1024 * 1024, 1024, 64 * 1024 * 1024),
    maxFindings: integerValue(unwrap(input.maxFindings), 'maxFindings', 15, 1, 100),
    language: languageValue(unwrap(input.language)),
    retentionDays: integerValue(unwrap(input.retentionDays), 'retentionDays', 7, 0, 365),
    requestTimeoutMs: integerValue(unwrap(input.requestTimeoutMs), 'requestTimeoutMs', 30_000, 1000, 300_000),
    concurrency: integerValue(unwrap(input.concurrency), 'concurrency', 4, 1, 16),
  }
}

/**
 * Read one Config field. Volatile fields reach `apply` as stable references
 * whose value the Loader commits in place, so every read unwraps them; fields
 * declared without `.volatile()` arrive as plain values.
 * @param value - raw or volatile Config field.
 * @returns the current plain value.
 */
function unwrap(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && typeof (value as { get?: unknown }).get === 'function') {
    return (value as { get(): unknown }).get()
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, name: string, fallback: string): string {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`code-review: "${name}" must be a non-empty string`)
  }
  return value
}

function integerValue(value: unknown, name: string, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(`code-review: "${name}" must be an integer between ${min} and ${max}`)
  }
  return value
}

function languageValue(value: unknown): Language {
  if (value === undefined) return 'auto'
  if (typeof value !== 'string' || !LANGUAGES.has(value)) {
    throw new TypeError('code-review: "language" must be "auto", "zh", or "en"')
  }
  return value as Language
}
