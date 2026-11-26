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
import type { Context } from './src/types.js';
export declare const name = "code-review";
export declare const inject: string[];
/**
 * Row configuration. All fields are validated at activation; the settings
 * service projects the volatile subset into the Plugins page card.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    ghCommand: z<string, string, "defined">;
    maxFiles: z<number, number, "volatile-defined">;
    maxPatchBytes: z<number, number, "volatile-defined">;
    maxFileBytes: z<number, number, "defined">;
    maxTotalFileBytes: z<number, number, "defined">;
    maxFindings: z<number, number, "volatile-defined">;
    language: z<"auto" | "zh" | "en", "auto" | "zh" | "en", "volatile-defined">;
    retentionDays: z<number, number, "volatile-defined">;
    requestTimeoutMs: z<number, number, "defined">;
    concurrency: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    ghCommand: z<string, string, "defined">;
    maxFiles: z<number, number, "volatile-defined">;
    maxPatchBytes: z<number, number, "volatile-defined">;
    maxFileBytes: z<number, number, "defined">;
    maxTotalFileBytes: z<number, number, "defined">;
    maxFindings: z<number, number, "volatile-defined">;
    language: z<"auto" | "zh" | "en", "auto" | "zh" | "en", "volatile-defined">;
    retentionDays: z<number, number, "volatile-defined">;
    requestTimeoutMs: z<number, number, "defined">;
    concurrency: z<number, number, "defined">;
}>>, "plain">;
/**
 * Register the embedded review skill, the global `/code-review` command, and
 * the prepare tool. Settings are read per call so a live form write applies
 * without restarting the plugin.
 * @param ctx - Host plugin context.
 * @param config - Loader row configuration.
 */
export declare function apply(ctx: Context, config?: unknown): void;
//# sourceMappingURL=index.d.ts.map