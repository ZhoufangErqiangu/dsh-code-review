/** The `/code-review` command handler. */

import { randomUUID } from 'node:crypto'

import { ReviewError, messageOf } from './errors.js'
import { buildReviewStartPrompt, resolveLanguage } from './prompt.js'
import { parseSelector, USAGE } from './selectors.js'
import { PREPARE_TOOL_NAME } from './tool.js'
import type {
  CommandInvocation,
  CommandResult,
  Context,
  MessageId,
  Settings,
  UserMessage,
} from './types.js'

/**
 * Submit one review turn immediately. The agent prepares the context with the
 * `prepare_code_review` tool, so the composer is not held by network work.
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
    const target = invocation.rawInput.trim()
    const language = resolveLanguage(settings.language, ctx)
    const prompt = buildReviewStartPrompt({
      target,
      language,
      maxFindings: settings.maxFindings,
    })
    invocation.agent.followup(reviewMessage(prompt))
    return { kind: 'success', text: notice(target) }
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

function notice(target: string): string {
  const subject = target === '' ? 'the current branch pull request' : target
  return [
    `Preparing the review for ${subject}.`,
    `The agent will call ${PREPARE_TOOL_NAME} and continue in this session.`,
  ].join('\n')
}

function failure(ctx: Context, signal: AbortSignal, error: unknown): CommandResult {
  if (signal.aborted) return { kind: 'error', text: 'Code review cancelled.' }
  if (error instanceof ReviewError) return { kind: 'error', text: error.message }
  try {
    ctx.logger?.warn?.(`[code-review] ${messageOf(error)}`)
  } catch {
    // Logging must not replace the original failure.
  }
  return { kind: 'error', text: `Code review failed: ${messageOf(error)}` }
}
