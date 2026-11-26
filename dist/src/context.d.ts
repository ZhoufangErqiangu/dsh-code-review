/** Builds the on-disk review context handed to the agent. */
import type { ChangedFilesResult, CommitSummary, FileTextResult, Context, RepositoryTarget, ResolvedPullRequest, ReviewContext, ReviewSelector, Settings } from './types.js';
/** GitHub reads used by the builder; replaceable in tests. */
export interface GitHubReads {
    resolvePullRequest(ctx: Context, settings: Settings, selector: ReviewSelector, cwd: string, signal: AbortSignal): Promise<ResolvedPullRequest>;
    fetchCommits(ctx: Context, settings: Settings, target: RepositoryTarget & {
        cwd: string;
        signal: AbortSignal;
    }, limit?: number): Promise<CommitSummary[]>;
    fetchChangedFiles(ctx: Context, settings: Settings, target: RepositoryTarget & {
        cwd: string;
        signal: AbortSignal;
    }, limit: number): Promise<ChangedFilesResult>;
    fetchFileText(ctx: Context, settings: Settings, request: {
        host: string;
        repo: string;
        sha: string;
        path: string;
        cwd: string;
        signal: AbortSignal;
    }): Promise<FileTextResult>;
}
/** Build request for one review context. */
export interface BuildReviewContextRequest {
    ctx: Context;
    settings: Settings;
    selector: ReviewSelector;
    cwd: string;
    signal: AbortSignal;
    github?: GitHubReads;
}
/**
 * Resolve the pull request, read its changed files, and materialize the context.
 * @param request - build request.
 * @returns the prepared context.
 */
export declare function buildReviewContext(request: BuildReviewContextRequest): Promise<ReviewContext>;
//# sourceMappingURL=context.d.ts.map