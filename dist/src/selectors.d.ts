/** Parsing of the `/code-review` argument into a pull request target. */
import type { ReviewSelector } from './types.js';
export declare const USAGE = "Usage: /code-review [number | owner/repo#number | https://github.com/owner/repo/pull/number]";
/**
 * Parse the raw command input.
 * @param rawInput - text after `/code-review`.
 * @returns the target, or an actionable parse failure.
 */
export declare function parseSelector(rawInput: string): ReviewSelector;
//# sourceMappingURL=selectors.d.ts.map