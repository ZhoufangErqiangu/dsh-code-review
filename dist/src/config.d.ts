/** Validated settings for the code-review plugin. */
import type { Settings } from './types.js';
export declare const DEFAULT_SETTINGS: Readonly<{
    ghCommand: string;
    maxFiles: number;
    maxPatchBytes: number;
    maxFileBytes: number;
    maxTotalFileBytes: number;
    maxFindings: number;
    language: "auto";
    retentionDays: number;
    requestTimeoutMs: number;
    concurrency: number;
}>;
/**
 * Merge the row configuration over the defaults and reject unusable values.
 * @param raw - Loader-supplied row configuration.
 * @returns complete settings.
 */
export declare function normalizeSettings(raw: unknown): Settings;
//# sourceMappingURL=config.d.ts.map