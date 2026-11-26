/** Read-only GitHub CLI access through the harness subprocess service. */
import { ReviewError } from './errors.js';
import type { Context, RepositoryTarget, Settings } from './types.js';
/** Exit facts and bounded output of one `gh` invocation. */
export interface GhOutput {
    code: number;
    stdout: string;
    stderr: string;
    truncated: boolean;
}
/** Execution options for one `gh` invocation. */
export interface RunGhOptions {
    cwd: string;
    signal?: AbortSignal;
    maxBytes?: number;
}
/** Request options for one REST call. */
export interface GhApiOptions extends RunGhOptions {
    host?: string;
    what?: string;
}
/**
 * Run one `gh` invocation.
 * @param ctx - plugin context with `subprocess`.
 * @param settings - resolved settings.
 * @param args - arguments after the executable.
 * @param options - execution options.
 * @returns exit facts and bounded output.
 */
export declare function runGh(ctx: Context, settings: Settings, args: readonly string[], options: RunGhOptions): Promise<GhOutput>;
/**
 * Call one GitHub REST endpoint and parse its JSON body.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param path - REST path, for example `repos/o/r/pulls/1`.
 * @param options - request options.
 * @returns parsed JSON, typed by the caller.
 */
export declare function ghApi<T = unknown>(ctx: Context, settings: Settings, path: string, options: GhApiOptions): Promise<T>;
/**
 * Resolve the pull request of the current branch.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param cwd - session working directory.
 * @param signal - command cancellation.
 * @returns the target.
 */
export declare function currentPullRequest(ctx: Context, settings: Settings, cwd: string, signal: AbortSignal): Promise<{
    host: string;
    owner: string;
    repo: string;
    number: number;
}>;
/**
 * Resolve the repository of the session working directory.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param cwd - session working directory.
 * @param signal - command cancellation.
 * @returns the repository.
 */
export declare function currentRepository(ctx: Context, settings: Settings, cwd: string, signal: AbortSignal): Promise<{
    host: string;
    owner: string;
    repo: string;
}>;
/**
 * Parse `https://host/owner/repo/pull/123` and its `/files` variants.
 * @param value - candidate URL.
 * @returns the target.
 */
export declare function pullRequestTargetFromUrl(value: unknown): RepositoryTarget | undefined;
/**
 * @param value - repository URL.
 * @returns the repository.
 */
export declare function repositoryFromUrl(value: unknown): {
    host: string;
    owner: string;
    repo: string;
} | undefined;
/**
 * Whether a `gh` failure means the working directory is not a usable checkout.
 * The `failed to run git` prefix is gh-owned English; its suffix follows the host locale.
 * @param value - combined stdout and stderr.
 * @returns true when the directory is not a Git checkout with a remote.
 */
export declare function isNotARepositoryMessage(value: string): boolean;
/**
 * Map a non-zero `gh` result to an actionable failure.
 * @param output - command result.
 * @param what - the operation being described.
 * @returns the mapped failure.
 */
export declare function ghFailure(output: Pick<GhOutput, 'code' | 'stdout' | 'stderr'>, what: string): ReviewError;
//# sourceMappingURL=gh.d.ts.map