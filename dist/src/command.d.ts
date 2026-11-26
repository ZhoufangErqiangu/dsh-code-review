/** The `/code-review` command handler. */
import type { CommandInvocation, CommandResult, Context, Settings } from './types.js';
/**
 * Submit one review turn immediately. The agent prepares the context with the
 * `prepare_code_review` tool, so the composer is not held by network work.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param invocation - command invocation.
 * @returns the command result.
 */
export declare function runReviewCommand(ctx: Context, settings: Settings, invocation: CommandInvocation): Promise<CommandResult>;
//# sourceMappingURL=command.d.ts.map