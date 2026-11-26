#!/usr/bin/env node
/**
 * Build one real review context with the local `gh` CLI and print the prompt.
 * Usage: node dist/scripts/dry-run.js <pull request URL | owner/repo#number | number>
 */

import { spawn } from 'node:child_process'

import { buildReviewContext } from '../src/context.js'
import { normalizeSettings } from '../src/config.js'
import { buildReviewPrompt, resolveLanguage } from '../src/prompt.js'
import { parseSelector } from '../src/selectors.js'
import type { Context, SubprocessHandle, SubprocessOutcome, SubprocessSpawnSpec } from '../src/types.js'

const input = process.argv[2]
if (input === undefined || input.trim() === '') {
  console.error('Usage: node dist/scripts/dry-run.js <pull request URL | owner/repo#number | number>')
  process.exit(2)
}

const selector = parseSelector(input)
if (selector.kind === 'invalid') {
  console.error(selector.message)
  process.exit(2)
}

const subprocess = {
  resolveExecutable: async (command: string) => command,
  spawn: (spec: SubprocessSpawnSpec) => {
    const child = spawn(spec.argv[0] ?? 'gh', spec.argv.slice(1), {
      cwd: spec.cwd,
      env: { ...process.env, ...spec.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => { stdout += chunk })
    child.stderr?.on('data', (chunk: string) => { stderr += chunk })
    const done = new Promise<SubprocessOutcome>((resolve, reject) => {
      child.on('close', code => resolve({ exitCode: code, signal: null }))
      child.on('error', reject)
    })
    spec.signal?.addEventListener('abort', () => child.kill('SIGTERM'), { once: true })
    const reader = (get: () => string) => ({
      readFrom: () => {
        const value = get()
        return { text: value, nextOffset: value.length, lossy: false }
      },
    })
    return {
      done,
      collected: { stdout: reader(() => stdout), stderr: reader(() => stderr) },
      terminate: () => child.kill('SIGTERM'),
      waitForExit: async () => true,
    } as unknown as SubprocessHandle
  },
} as unknown as Context['subprocess']

const ctx = { subprocess, get: () => undefined } as unknown as Context
const settings = normalizeSettings({ retentionDays: 0 })

try {
  const result = await buildReviewContext({
    ctx,
    settings,
    selector,
    cwd: process.cwd(),
    signal: new AbortController().signal,
  })

  console.log(result.indexMarkdown)
  console.log('\n--- prompt ---\n')
  console.log(buildReviewPrompt({
    meta: result.meta,
    language: resolveLanguage(settings.language, ctx),
    maxFindings: settings.maxFindings,
  }))
  console.log(`\n--- context directory ---\n${result.directory}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
