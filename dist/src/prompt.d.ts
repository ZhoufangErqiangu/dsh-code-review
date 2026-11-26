/** Language selection and the review task submitted to the agent. */
import type { Context, Language, ResolvedLanguage, ReviewMeta } from './types.js';
/**
 * Resolve `language: auto` against the profile locale setting, then the host locale.
 * @param setting - configured language.
 * @param ctx - plugin context.
 * @returns resolved language.
 */
export declare function resolveLanguage(setting: Language, ctx: Context): ResolvedLanguage;
/** Fields of the prepared context the prompt actually reads. */
export interface ReviewPromptMeta {
    repository: Pick<ReviewMeta['repository'], 'owner' | 'repo'>;
    context: Pick<ReviewMeta['context'], 'directory'>;
    pullRequest: Pick<ReviewMeta['pullRequest'], 'number' | 'title' | 'headSha' | 'draft'>;
}
/** Inputs for the review turn's user message. */
export interface ReviewPromptInput {
    meta: ReviewPromptMeta;
    language: ResolvedLanguage;
    maxFindings: number;
}
/**
 * Build the user message that starts the review turn.
 * @param input - prompt inputs.
 * @returns the review task.
 */
export declare function buildReviewPrompt({ meta, language, maxFindings }: ReviewPromptInput): string;
//# sourceMappingURL=prompt.d.ts.map