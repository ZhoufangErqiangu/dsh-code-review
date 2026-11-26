/** Language selection and the review task submitted to the agent. */
import type { Context, Language, ResolvedLanguage } from './types.js';
/**
 * Resolve `language: auto` against the profile locale setting, then the host locale.
 * @param setting - configured language.
 * @param ctx - plugin context.
 * @returns resolved language.
 */
export declare function resolveLanguage(setting: Language, ctx: Context): ResolvedLanguage;
/** Inputs for the review turn that starts before the context exists. */
export interface ReviewStartPromptInput {
    target: string;
    language: ResolvedLanguage;
    maxFindings: number;
}
/**
 * Build the user message that starts the review turn.
 * @param input - prompt inputs.
 * @returns the review task.
 */
export declare function buildReviewStartPrompt({ target, language, maxFindings }: ReviewStartPromptInput): string;
//# sourceMappingURL=prompt.d.ts.map