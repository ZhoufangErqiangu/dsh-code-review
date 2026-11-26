/** Pull request resolution and GitHub reads shared by the command. */
import type { ChangedFilesResult, CommitSummary, FileTextResult, Context, PullRequestInfo, RepositoryTarget, ResolvedPullRequest, ReviewSelector, Settings } from './types.js';
/**
 * Resolve a parsed selector and read its open pull request.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param selector - parsed target.
 * @param cwd - session working directory.
 * @param signal - command cancellation.
 * @returns the target and metadata.
 */
export declare function resolvePullRequest(ctx: Context, settings: Settings, selector: ReviewSelector, cwd: string, signal: AbortSignal): Promise<ResolvedPullRequest>;
/**
 * Read one page-limited list of the pull request's commits; failure is not fatal.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param target - pull request location.
 * @param limit - maximum commits to keep.
 * @returns commit summaries.
 */
export declare function fetchCommits(ctx: Context, settings: Settings, target: RepositoryTarget & {
    cwd: string;
    signal: AbortSignal;
}, limit?: number): Promise<CommitSummary[]>;
/**
 * Read the changed files of a pull request, one hundred per request.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param target - pull request location.
 * @param limit - maximum entries to read.
 * @returns file entries.
 */
export declare function fetchChangedFiles(ctx: Context, settings: Settings, target: RepositoryTarget & {
    cwd: string;
    signal: AbortSignal;
}, limit: number): Promise<ChangedFilesResult>;
/**
 * Read one complete file at a commit.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param request - file request.
 * @returns text or why it was skipped.
 */
export declare function fetchFileText(ctx: Context, settings: Settings, request: {
    host: string;
    repo: string;
    sha: string;
    path: string;
    cwd: string;
    signal: AbortSignal;
}): Promise<FileTextResult>;
/**
 * Normalize one REST pull request.
 * @param data - REST response.
 * @param what - diagnostic label.
 * @returns normalized metadata.
 */
export declare function normalizePullRequest(data: unknown, what: string): PullRequestInfo;
//# sourceMappingURL=pull-request.d.ts.map