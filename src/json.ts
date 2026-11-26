/** Narrowing helpers for untrusted JSON values. */

/**
 * @param value - candidate.
 * @returns the value when it is a plain record.
 */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/**
 * @param value - candidate.
 * @returns the value when it is an array.
 */
export function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

/**
 * @param value - candidate.
 * @returns the value when it is a string.
 */
export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * @param value - candidate.
 * @returns the value when it is a safe integer.
 */
export function asInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined
}

/**
 * @param value - candidate.
 * @returns the value when it is a boolean.
 */
export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}
