/**
 * `/code-review` — submit a review turn immediately; the `prepare_code_review`
 * tool writes the pull request context under the session workspace, and the
 * agent continues with the bundled review skill.
 * @module @local/dsh-code-review
 */
import { runReviewCommand } from './src/command.js';
import { normalizeSettings } from './src/config.js';
import { registerReviewSkill } from './src/skill.js';
import { createPrepareReviewTool } from './src/tool.js';
export const name = 'code-review';
export const inject = ['commands', 'skills', 'subprocess', 'tools', 'workingDirectory'];
/**
 * Register the embedded review skill and the global `/code-review` command.
 * @param ctx - Host plugin context.
 * @param config - Loader row configuration.
 */
export function apply(ctx, config) {
    const settings = normalizeSettings(config);
    ctx.effect(() => registerReviewSkill(ctx));
    ctx.effect(() => ctx.tools.register(createPrepareReviewTool(ctx, settings)));
    ctx.effect(() => ctx.commands.register({
        name: 'code-review',
        description: 'Review a GitHub pull request and report findings',
        input: { hint: '<number | owner/repo#number | URL>' },
        handler: invocation => runReviewCommand(ctx, settings, invocation),
    }));
}
//# sourceMappingURL=index.js.map