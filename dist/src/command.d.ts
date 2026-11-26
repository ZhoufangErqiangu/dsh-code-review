/** The `/code-review` command handler. */
import type { CommandInvocation, CommandResult, Context, Settings } from './types.js';
/**
 * Prepare the review context and submit one review turn to the receiving agent.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param invocation - command invocation.
 * @returns the command result.
 */
export declare function runReviewCommand(ctx: Context, settings: Settings, invocation: CommandInvocation): Promise<CommandResult>;
//# sourceMappingURL=command.d.ts.map