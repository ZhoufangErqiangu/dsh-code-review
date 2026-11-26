/**
 * Shared value types, plus type-only re-exports of the DSH Host API.
 *
 * DSH packages are build-only devDependencies pinned to the Harness version
 * used for the build. They are imported with `import type` only, so the
 * compiled plugin has no runtime import of any `@deepseek-ai` package: the
 * Harness ships those packages, and `dist/` uses Node built-ins plus local
 * modules. Update the devDependency versions and rebuild when upgrading DSH.
 */
export type Language = 'auto' | 'zh' | 'en';
export type ResolvedLanguage = 'zh' | 'en';
/** Validated settings for the code-review plugin. */
export interface Settings {
    ghCommand: string;
    maxFiles: number;
    maxPatchBytes: number;
    maxFileBytes: number;
    maxTotalFileBytes: number;
    maxFindings: number;
    language: Language;
    retentionDays: number;
    requestTimeoutMs: number;
    concurrency: number;
}
/** Parsed `/code-review` argument. */
export type ReviewSelector = {
    kind: 'current';
} | {
    kind: 'number';
    number: number;
} | {
    kind: 'ref';
    owner: string;
    repo: string;
    number: number;
} | {
    kind: 'url';
    host: string;
    owner: string;
    repo: string;
    number: number;
} | {
    kind: 'invalid';
    message: string;
};
/** A pull request location resolved from a selector. */
export interface RepositoryTarget {
    host: string;
    owner: string;
    repo: string;
    number: number;
}
/** Normalized GitHub pull request metadata. */
export interface PullRequestInfo {
    number: number;
    title: string;
    body: string;
    state: string;
    draft: boolean;
    htmlUrl: string;
    author: string;
    baseRef: string;
    baseSha: string;
    headRef: string;
    headSha: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    labels: string[];
    headRepo: string;
}
/** One changed file returned by the pull request files endpoint. */
export interface ChangedFile {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch: string | null;
    previousFilename: string | null;
}
/** Commit subject shown in the context index. */
export interface CommitSummary {
    sha: string;
    message: string;
    author: string;
}
/** One page-limited read of the pull request files. */
export interface ChangedFilesResult {
    files: ChangedFile[];
    truncated: boolean;
}
/** Why the complete text of one file was not materialized. */
export type SkipReason = 'too-large' | 'unavailable' | 'binary' | 'not-a-file' | 'unsafe-path';
/** Complete-text read result. */
export type FileTextResult = {
    text: string;
    size: number;
} | {
    skipped: SkipReason;
    size?: number;
};
/** Why one context entry is missing material. */
export type OmittedReason = SkipReason | 'removed' | 'budget' | `fetch-failed:${string}`;
/** One changed file in `meta.json` and `index.md`. */
export interface ContextEntry {
    index: number;
    path: string;
    status: string;
    additions: number;
    deletions: number;
    patch: string | null;
    patchTruncated: boolean;
    fullText: string | null;
    fullTextBytes: number;
    fullTextSize: number | null;
    omitted: OmittedReason | null;
}
/** Limits recorded with the prepared context. */
export interface ContextLimits {
    maxFiles: number;
    maxPatchBytes: number;
    maxFileBytes: number;
    maxTotalFileBytes: number;
}
/** Serialized `meta.json`. */
export interface ReviewMeta {
    schemaVersion: 1;
    createdAt: string;
    repository: {
        host: string;
        owner: string;
        repo: string;
        contentRepo: string;
        url: string;
    };
    pullRequest: {
        number: number;
        title: string;
        body: string;
        bodyTruncated: boolean;
        state: string;
        draft: boolean;
        author: string;
        baseRef: string;
        baseSha: string;
        headRef: string;
        headSha: string;
        additions: number;
        deletions: number;
        changedFiles: number;
        labels: string[];
    };
    commits: CommitSummary[];
    context: {
        directory: string;
        filesChanged: number;
        filesFetched: number;
        filesIncluded: number;
        filesTruncated: boolean;
        textBytes: number;
        limits: ContextLimits;
    };
    skipped: {
        generated: string[];
        generatedCount: number;
        overLimit: string[];
        overLimitCount: number;
        notFetched: number;
    };
    files: ContextEntry[];
}
/** Prepared review context returned by the builder. */
export interface ReviewContext {
    directory: string;
    relativeDirectory: string;
    meta: ReviewMeta;
    indexMarkdown: string;
}
/** Resolved pull request plus its repository. */
export interface ResolvedPullRequest extends RepositoryTarget {
    pullRequest: PullRequestInfo;
}
export type { Context } from '@deepseek-ai/cordis';
export type { CommandDefinition, CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands';
export type { MessageId, UserMessage } from '@deepseek-ai/dsh-llm';
export type { SettingsDescriptor, SettingsForms } from '@deepseek-ai/dsh-settings';
export type { SkillRegistration } from '@deepseek-ai/dsh-skill';
export type { SubprocessHandle, SubprocessOutcome, SubprocessOutputReader, SubprocessSpawnSpec, } from '@deepseek-ai/dsh-subprocess';
/** Removes a registration. */
export type Disposer = () => void;
//# sourceMappingURL=types.d.ts.map