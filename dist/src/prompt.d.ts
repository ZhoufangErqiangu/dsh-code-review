/** Language selection and the delegation task submitted to the main agent. */
import type { Context, Language, ResolvedLanguage } from './types.js';
/**
 * Resolve `language: auto` against the profile locale setting, then the host locale.
 * @param setting - configured language.
 * @param ctx - plugin context.
 * @returns resolved language.
 */
export declare function resolveLanguage(setting: Language, ctx: Context): ResolvedLanguage;
/** Inputs for the delegation turn. */
export interface ReviewStartPromptInput {
    target: string;
    language: ResolvedLanguage;
    maxFindings: number;
}
/**
 * Build the main-agent message that delegates the review to one background
 * subagent. The main session never fetches or reads the diff itself.
 * @param input - prompt inputs.
 * @returns the delegation task.
 */
export declare function buildReviewStartPrompt({ target, language, maxFindings }: ReviewStartPromptInput): string;
//# sourceMappingURL=prompt.d.ts.map