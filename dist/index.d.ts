/**
 * `/code-review` — submit a review turn immediately; the `prepare_code_review`
 * tool writes the pull request context under the session workspace, and the
 * agent continues with the bundled review skill.
 * @module @local/dsh-code-review
 */
import type { Context } from './src/types.js';
export declare const name = "code-review";
export declare const inject: string[];
/**
 * Register the embedded review skill and the global `/code-review` command.
 * @param ctx - Host plugin context.
 * @param config - Loader row configuration.
 */
export declare function apply(ctx: Context, config?: unknown): void;
//# sourceMappingURL=index.d.ts.map