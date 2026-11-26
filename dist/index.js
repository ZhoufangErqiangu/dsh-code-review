/**
 * `/code-review` — submit a review turn immediately; the `prepare_code_review`
 * tool writes the pull request context under the session workspace, and the
 * agent continues with the bundled review skill.
 *
 * The five fields the Web settings card exposes are volatile: the Loader
 * commits a form write into the running Config references, and every
 * invocation reads them again. The other fields stay ordinary configuration
 * for `cordis.patch.yml`.
 * @module @local/dsh-code-review
 */
import z from '@deepseek-ai/schemastery';
import { runReviewCommand } from './src/command.js';
import { DEFAULT_SETTINGS, normalizeSettings } from './src/config.js';
import { registerReviewSkill } from './src/skill.js';
import { createPrepareReviewTool } from './src/tool.js';
export const name = 'code-review';
export const inject = ['commands', 'skills', 'subprocess', 'tools', 'workingDirectory'];
/**
 * Row configuration. All fields are validated at activation; the settings
 * service projects the volatile subset into the Plugins page card.
 */
export const Config = z.object({
    ghCommand: z.string().min(1).default(DEFAULT_SETTINGS.ghCommand),
    maxFiles: z.natural().min(1).max(2000).default(DEFAULT_SETTINGS.maxFiles).volatile(),
    maxPatchBytes: z.natural().min(1024).max(16 * 1024 * 1024).default(DEFAULT_SETTINGS.maxPatchBytes).volatile(),
    maxFileBytes: z.natural().min(1024).max(4 * 1024 * 1024).default(DEFAULT_SETTINGS.maxFileBytes),
    maxTotalFileBytes: z.natural().min(1024).max(64 * 1024 * 1024).default(DEFAULT_SETTINGS.maxTotalFileBytes),
    maxFindings: z.natural().min(1).max(100).default(DEFAULT_SETTINGS.maxFindings).volatile(),
    language: z.union(['auto', 'zh', 'en']).default(DEFAULT_SETTINGS.language).volatile(),
    retentionDays: z.natural().min(0).max(365).default(DEFAULT_SETTINGS.retentionDays).volatile(),
    requestTimeoutMs: z.natural().min(1000).max(300_000).default(DEFAULT_SETTINGS.requestTimeoutMs),
    concurrency: z.natural().min(1).max(16).default(DEFAULT_SETTINGS.concurrency),
});
/**
 * Register the embedded review skill, the global `/code-review` command, and
 * the prepare tool. Settings are read per call so a live form write applies
 * without restarting the plugin.
 * @param ctx - Host plugin context.
 * @param config - Loader row configuration.
 */
export function apply(ctx, config) {
    const currentSettings = () => normalizeSettings(config);
    // Validate the row once at activation; later reads pick up live writes.
    currentSettings();
    ctx.effect(() => registerReviewSkill(ctx));
    ctx.effect(() => ctx.tools.register(createPrepareReviewTool(ctx, currentSettings)));
    ctx.effect(() => ctx.commands.register({
        name: 'code-review',
        description: 'Review a GitHub pull request and report findings',
        input: { hint: '<number | owner/repo#number | URL>' },
        handler: invocation => runReviewCommand(ctx, currentSettings(), invocation),
    }));
    // This bundle ships its own settings card; without this policy a future
    // client that generates pages from schemas would render a second one.
    ctx.inject?.(['settings'], (settingsCtx) => {
        settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber));
    });
}
//# sourceMappingURL=index.js.map