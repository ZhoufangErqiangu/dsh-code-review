/**
 * `/code-review` — resolve a GitHub pull request, prepare its diff and complete
 * file text under the session workspace, and hand the current agent one
 * structured review task.
 * @module @local/dsh-code-review
 */

import { runReviewCommand } from './src/command.js'
import { normalizeSettings } from './src/config.js'
import { registerReviewSkill } from './src/skill.js'
import type { Context } from './src/types.js'

export const name = 'code-review'
export const inject = ['commands', 'subprocess', 'workingDirectory', 'skills']

/**
 * Register the embedded review skill and the global `/code-review` command.
 * @param ctx - Host plugin context.
 * @param config - Loader row configuration.
 */
export function apply(ctx: Context, config?: unknown): void {
  const settings = normalizeSettings(config)
  ctx.effect(() => registerReviewSkill(ctx))
  ctx.effect(() => ctx.commands.register({
    name: 'code-review',
    description: 'Review a GitHub pull request and report findings',
    input: { hint: '<number | owner/repo#number | URL>' },
    handler: invocation => runReviewCommand(ctx, settings, invocation),
  }))
}
