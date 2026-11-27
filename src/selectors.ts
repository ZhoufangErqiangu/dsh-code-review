/** Parsing of the `/code-review` argument into a pull request target. */

import type { ReviewSelector } from './types.ts'

export const USAGE = 'Usage: /code-review [number | owner/repo#number | https://github.com/owner/repo/pull/number]'

const URL_RE = /^https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/pull\/([1-9]\d*)(?:\/[A-Za-z0-9._-]+)*\/?(?:[?#].*)?$/i
const NUMBER_RE = /^#?([1-9]\d*)$/
const REF_RE = /^(?:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+))?#([1-9]\d*)$/

/**
 * Parse the raw command input.
 * @param rawInput - text after `/code-review`.
 * @returns the target, or an actionable parse failure.
 */
export function parseSelector(rawInput: string): ReviewSelector {
  const text = typeof rawInput === 'string' ? rawInput.trim() : ''
  if (text === '') return { kind: 'current' }

  const url = URL_RE.exec(text)
  if (url !== null) {
    const host = url[1]
    const owner = url[2]
    const repo = url[3]
    const number = url[4]
    if (host === undefined || owner === undefined || repo === undefined || number === undefined) {
      return invalid('The URL does not name a valid pull request.')
    }
    if (!validName(owner) || !validName(repo)) return invalid('The URL does not name a valid repository.')
    return { kind: 'url', host, owner, repo, number: Number(number) }
  }

  const single = NUMBER_RE.exec(text)
  if (single !== null) {
    const number = single[1]
    return number === undefined ? invalid('Expected a pull request number.') : { kind: 'number', number: Number(number) }
  }

  const ref = REF_RE.exec(text)
  if (ref !== null) {
    const owner = ref[1]
    const repo = ref[2]
    const number = ref[3]
    if (number === undefined) return invalid('Expected a pull request number.')
    if (owner === undefined || repo === undefined) return { kind: 'number', number: Number(number) }
    if (!validName(owner) || !validName(repo)) return invalid('The repository must be written as owner/repo.')
    return { kind: 'ref', owner, repo, number: Number(number) }
  }

  return invalid('Expected a pull request number, owner/repo#number, or pull request URL.')
}

function validName(value: string): boolean {
  return value !== '.' && value !== '..'
}

function invalid(message: string): ReviewSelector {
  return { kind: 'invalid', message }
}
