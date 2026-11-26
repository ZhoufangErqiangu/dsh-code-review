/** The `/code-review` command handler. */
import { randomUUID } from 'node:crypto';
import { ReviewError, messageOf } from './errors.js';
import { buildReviewStartPrompt, resolveLanguage } from './prompt.js';
import { parseSelector, USAGE } from './selectors.js';
/**
 * Submit one review turn immediately. The agent prepares the context with the
 * `prepare_code_review` tool, so the composer is not held by network work.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param invocation - command invocation.
 * @returns the command result.
 */
export async function runReviewCommand(ctx, settings, invocation) {
    const selector = parseSelector(invocation.rawInput);
    if (selector.kind === 'invalid') {
        return { kind: 'error', text: `${selector.message}\n${USAGE}` };
    }
    try {
        const target = invocation.rawInput.trim();
        const language = resolveLanguage(settings.language, ctx);
        const prompt = buildReviewStartPrompt({
            target,
            language,
            maxFindings: settings.maxFindings,
        });
        invocation.agent.followup(reviewMessage(prompt));
        return { kind: 'success', text: notice(target) };
    }
    catch (error) {
        return failure(ctx, invocation.signal, error);
    }
}
function reviewMessage(text) {
    return deepFreeze({
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text }],
        source: { kind: 'user' },
    });
}
function deepFreeze(value) {
    if (typeof value !== 'object' || value === null)
        return value;
    Object.freeze(value);
    for (const child of Object.values(value))
        deepFreeze(child);
    return value;
}
function notice(target) {
    const subject = target === '' ? 'the current branch pull request' : target;
    return [
        `Starting the review for ${subject} in a background subagent.`,
        'The report will appear here when it completes.',
    ].join('\n');
}
function failure(ctx, signal, error) {
    if (signal.aborted)
        return { kind: 'error', text: 'Code review cancelled.' };
    if (error instanceof ReviewError)
        return { kind: 'error', text: error.message };
    try {
        ctx.logger?.warn?.(`[code-review] ${messageOf(error)}`);
    }
    catch {
        // Logging must not replace the original failure.
    }
    return { kind: 'error', text: `Code review failed: ${messageOf(error)}` };
}
//# sourceMappingURL=command.js.map