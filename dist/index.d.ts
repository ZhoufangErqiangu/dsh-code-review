/**
 * `/code-review` — resolve a GitHub pull request, prepare its diff and complete
 * file text under the session workspace, and hand the current agent one
 * structured review task.
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