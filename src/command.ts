/** The `/code-review` command handler. */

import { randomUUID } from 'node:crypto'

import { buildReviewContext } from './context.js'
import { ReviewError, messageOf } from './errors.js'
import { buildReviewPrompt, resolveLanguage } from './prompt.js'
import { parseSelector, USAGE } from './selectors.js'
import type {
  CommandInvocation,
  CommandResult,
  Context,
  MessageId,
  ReviewMeta,
  Settings,
  UserMessage,
} from './types.js'

/**
 * Prepare the review context and submit one review turn to the receiving agent.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param invocation - command invocation.
 * @returns the command result.
 */
export async function runReviewCommand(
  ctx: Context,
  settings: Settings,
  invocation: CommandInvocation,
): Promise<CommandResult> {
  const selector = parseSelector(invocation.rawInput)
  if (selector.kind === 'invalid') {
    return { kind: 'error', text: `${selector.message}\n${USAGE}` }
  }

  try {
    const cwd = await ctx.workingDirectory.ensure(invocation.agent, invocation.signal)
    const context = await buildReviewContext({
      ctx,
      settings,
      selector,
      cwd,
      signal: invocation.signal,
    })

    if (invocation.signal.aborted) return { kind: 'error', text: 'Code review cancelled.' }

    const language = resolveLanguage(settings.language, ctx)
    const prompt = buildReviewPrompt({
      meta: context.meta,
      language,
      maxFindings: settings.maxFindings,
    })

    invocation.agent.followup(reviewMessage(prompt))
    return { kind: 'success', text: notice(context.meta) }
  } catch (error) {
    return failure(ctx, invocation.signal, error)
  }
}

function reviewMessage(text: string): UserMessage {
  return deepFreeze({
    id: randomUUID() as MessageId,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  })
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

function notice(meta: ReviewMeta): string {
  const pr = meta.pullRequest
  const repository = meta.repository
  const lines = [
    `Reviewing ${repository.owner}/${repository.repo}#${pr.number} — "${pr.title}"`,
    `${pr.changedFiles} files, +${pr.additions} -${pr.deletions}, head ${pr.headSha.slice(0, 7)}`,
    `Context: ${meta.context.directory}`,
  ]
  if (meta.context.filesTruncated) {
    lines.push(`Context limit reached: ${meta.context.filesIncluded} of ${pr.changedFiles} changed files included.`)
  }
  lines.push('The review continues in this session.')
  return lines.join('\n')
}

function failure(ctx: Context, signal: AbortSignal, error: unknown): CommandResult {
  if (signal.aborted) return { kind: 'error', text: 'Code review cancelled.' }
  if (error instanceof ReviewError) return { kind: 'error', text: error.message }
  try {
    ctx.logger?.warn(`[code-review] ${messageOf(error)}`)
  } catch {
    // Logging must not replace the original failure.
  }
  return { kind: 'error', text: `Code review failed: ${messageOf(error)}` }
}
