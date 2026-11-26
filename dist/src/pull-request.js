/** Pull request resolution and GitHub reads shared by the command. */
import { ReviewError } from './errors.js';
import { currentPullRequest, currentRepository, ghApi } from './gh.js';
import { asArray, asBoolean, asInteger, asRecord, asString } from './json.js';
import { encodeRepositoryPath, safeRepositoryPath } from './paths.js';
/**
 * Resolve a parsed selector and read its open pull request.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param selector - parsed target.
 * @param cwd - session working directory.
 * @param signal - command cancellation.
 * @returns the target and metadata.
 */
export async function resolvePullRequest(ctx, settings, selector, cwd, signal) {
    let target;
    switch (selector.kind) {
        case 'current': {
            target = await currentPullRequest(ctx, settings, cwd, signal);
            break;
        }
        case 'number': {
            const repository = await currentRepository(ctx, settings, cwd, signal);
            target = { ...repository, number: selector.number };
            break;
        }
        case 'ref': {
            target = { host: 'github.com', owner: selector.owner, repo: selector.repo, number: selector.number };
            break;
        }
        case 'url': {
            target = { host: selector.host, owner: selector.owner, repo: selector.repo, number: selector.number };
            break;
        }
        default: {
            throw new ReviewError('invalid-target', 'Unsupported pull request target.');
        }
    }
    const { host, owner, repo, number } = target;
    const what = `Pull request ${owner}/${repo}#${number}`;
    const data = await ghApi(ctx, settings, `repos/${owner}/${repo}/pulls/${number}`, { cwd, host, signal, what });
    const pullRequest = normalizePullRequest(data, what);
    return { ...target, pullRequest };
}
/**
 * Read one page-limited list of the pull request's commits; failure is not fatal.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param target - pull request location.
 * @param limit - maximum commits to keep.
 * @returns commit summaries.
 */
export async function fetchCommits(ctx, settings, target, limit = 50) {
    try {
        const items = await ghApi(ctx, settings, `repos/${target.owner}/${target.repo}/pulls/${target.number}/commits?per_page=${limit}`, { cwd: target.cwd, host: target.host, signal: target.signal, what: 'Pull request commits', maxBytes: 2 * 1024 * 1024 });
        const list = asArray(items);
        if (list === undefined)
            return [];
        return list.slice(0, limit).map(item => {
            const record = asRecord(item);
            const commit = asRecord(record?.commit);
            return {
                sha: asString(record?.sha) ?? '',
                message: firstLine(asString(commit?.message) ?? ''),
                author: asString(asRecord(record?.author)?.login) ?? '',
            };
        });
    }
    catch (error) {
        if (error instanceof ReviewError)
            return [];
        throw error;
    }
}
/**
 * Read the changed files of a pull request, one hundred per request.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param target - pull request location.
 * @param limit - maximum entries to read.
 * @returns file entries.
 */
export async function fetchChangedFiles(ctx, settings, target, limit) {
    const files = [];
    let truncated = false;
    let page = 1;
    while (files.length < limit && page <= 10) {
        const items = await ghApi(ctx, settings, `repos/${target.owner}/${target.repo}/pulls/${target.number}/files?per_page=100&page=${page}`, { cwd: target.cwd, host: target.host, signal: target.signal, what: 'Pull request files', maxBytes: 32 * 1024 * 1024 });
        const list = asArray(items);
        if (list === undefined)
            throw new ReviewError('bad-response', 'GitHub returned an unexpected file list.');
        for (const item of list) {
            if (files.length >= limit) {
                truncated = true;
                break;
            }
            files.push(normalizeFile(item));
        }
        if (list.length < 100)
            break;
        page += 1;
    }
    return { files, truncated };
}
/**
 * Read one complete file at a commit.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param request - file request.
 * @returns text or why it was skipped.
 */
export async function fetchFileText(ctx, settings, request) {
    const { host, repo, sha, path, cwd, signal } = request;
    if (safeRepositoryPath(path) === null)
        return { skipped: 'unsafe-path' };
    const endpoint = `repos/${repo}/contents/${encodeRepositoryPath(path)}?ref=${encodeURIComponent(sha)}`;
    const data = await ghApi(ctx, settings, endpoint, {
        cwd,
        host,
        signal,
        what: `File ${path}`,
        maxBytes: Math.max(2 * 1024 * 1024, settings.maxFileBytes * 2),
    });
    const record = asRecord(data);
    if (record === undefined || asString(record.type) !== 'file')
        return { skipped: 'not-a-file' };
    const size = asInteger(record.size) ?? 0;
    if (size > settings.maxFileBytes)
        return { skipped: 'too-large', size };
    const encoding = asString(record.encoding);
    const content = asString(record.content);
    if (encoding !== 'base64' || content === undefined)
        return { skipped: 'unavailable', size };
    const buffer = Buffer.from(content, 'base64');
    if (buffer.includes(0))
        return { skipped: 'binary', size: buffer.length };
    return { text: buffer.toString('utf8'), size: buffer.length };
}
/**
 * Normalize one REST pull request.
 * @param data - REST response.
 * @param what - diagnostic label.
 * @returns normalized metadata.
 */
export function normalizePullRequest(data, what) {
    const record = asRecord(data);
    if (record === undefined)
        throw new ReviewError('bad-response', `${what} returned no data.`);
    const head = asRecord(record.head);
    const base = asRecord(record.base);
    const headSha = asString(head?.sha);
    const baseSha = asString(base?.sha);
    if (headSha === undefined || headSha === '' || baseSha === undefined || baseSha === '') {
        throw new ReviewError('bad-response', `${what} is missing its head or base commit.`);
    }
    const state = asString(record.state);
    if (state !== 'open') {
        const label = asBoolean(record.merged) === true ? 'already merged' : `not open (${state ?? 'unknown'})`;
        throw new ReviewError('pr-closed', `${what} is ${label}. Only open pull requests can be reviewed.`);
    }
    return {
        number: asInteger(record.number) ?? 0,
        title: asString(record.title) ?? '',
        body: asString(record.body) ?? '',
        state,
        draft: asBoolean(record.draft) === true,
        htmlUrl: asString(record.html_url) ?? '',
        author: asString(asRecord(record.user)?.login) ?? '',
        baseRef: asString(base?.ref) ?? '',
        baseSha,
        headRef: asString(head?.ref) ?? '',
        headSha,
        additions: asInteger(record.additions) ?? 0,
        deletions: asInteger(record.deletions) ?? 0,
        changedFiles: asInteger(record.changed_files) ?? 0,
        labels: (asArray(record.labels) ?? [])
            .map(label => asString(asRecord(label)?.name) ?? '')
            .filter(label => label !== ''),
        headRepo: asString(asRecord(head?.repo)?.full_name) ?? '',
    };
}
function normalizeFile(item) {
    const record = asRecord(item);
    return {
        filename: asString(record?.filename) ?? '',
        status: asString(record?.status) ?? 'modified',
        additions: asInteger(record?.additions) ?? 0,
        deletions: asInteger(record?.deletions) ?? 0,
        changes: asInteger(record?.changes) ?? 0,
        patch: asString(record?.patch) ?? null,
        previousFilename: asString(record?.previous_filename) ?? null,
    };
}
function firstLine(value) {
    return value.split('\n', 1)[0]?.slice(0, 500) ?? '';
}
//# sourceMappingURL=pull-request.js.map