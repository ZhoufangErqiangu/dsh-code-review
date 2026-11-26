/** Read-only GitHub CLI access through the harness subprocess service. */
import { ReviewError, messageOf } from './errors.js';
import { asInteger, asRecord, asString } from './json.js';
const OUTPUT_LIMIT = 32 * 1024 * 1024;
const STDERR_LIMIT = 64 * 1024;
const TERMINATION_GRACE_MS = 5000;
const GH_ENV = Object.freeze({
    GH_PROMPT_DISABLED: '1',
    GH_NO_UPDATE_NOTIFIER: '1',
    GH_PAGER: '',
    NO_COLOR: '1',
    CLICOLOR: '0',
});
/**
 * Run one `gh` invocation.
 * @param ctx - plugin context with `subprocess`.
 * @param settings - resolved settings.
 * @param args - arguments after the executable.
 * @param options - execution options.
 * @returns exit facts and bounded output.
 */
export async function runGh(ctx, settings, args, options) {
    const { cwd, signal, maxBytes = OUTPUT_LIMIT } = options;
    throwIfAborted(signal);
    let executable;
    try {
        executable = await ctx.subprocess.resolveExecutable(settings.ghCommand, undefined, signal);
    }
    catch (error) {
        throwIfAborted(signal);
        throw new ReviewError('gh-missing', `Cannot start "${settings.ghCommand}". Install the GitHub CLI and sign in with "gh auth login". (${messageOf(error)})`, { cause: error });
    }
    const timeout = AbortSignal.timeout(settings.requestTimeoutMs);
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
    const command = ['gh', ...args].join(' ');
    let handle;
    try {
        handle = ctx.subprocess.spawn({
            argv: [executable, ...args],
            cwd,
            stdio: { stdin: 'ignore', stdout: { maxBytes }, stderr: { maxBytes: STDERR_LIMIT } },
            graceMs: TERMINATION_GRACE_MS,
            signal: combined,
            env: GH_ENV,
        });
    }
    catch (error) {
        throwIfAborted(signal);
        if (timeout.aborted)
            throw timeoutError(command, settings);
        throw new ReviewError('gh-failed', `Cannot start "${command}": ${messageOf(error)}`, { cause: error });
    }
    let outcome;
    try {
        outcome = await handle.done;
    }
    catch (error) {
        throwIfAborted(signal);
        if (timeout.aborted)
            throw timeoutError(command, settings);
        throw new ReviewError('gh-failed', `"${command}" failed to run: ${messageOf(error)}`, { cause: error });
    }
    throwIfAborted(signal);
    if (timeout.aborted)
        throw timeoutError(command, settings);
    const stdout = readCollected(handle.collected.stdout);
    const stderr = readCollected(handle.collected.stderr);
    return {
        code: outcome.exitCode ?? 1,
        stdout: stdout.text,
        stderr: stderr.text,
        truncated: stdout.lossy || stderr.lossy,
    };
}
/**
 * Call one GitHub REST endpoint and parse its JSON body.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param path - REST path, for example `repos/o/r/pulls/1`.
 * @param options - request options.
 * @returns parsed JSON, typed by the caller.
 */
export async function ghApi(ctx, settings, path, options) {
    const { cwd, host, signal, what, maxBytes } = options;
    const args = ['api'];
    if (host !== undefined && host.toLowerCase() !== 'github.com')
        args.push('--hostname', host);
    args.push('-H', 'Accept: application/vnd.github+json', path);
    const output = await runGh(ctx, settings, args, { cwd, signal, maxBytes });
    if (output.code !== 0)
        throw ghFailure(output, what ?? `GitHub request ${path}`);
    if (output.truncated) {
        throw new ReviewError('too-large', `The GitHub response for ${what ?? path} exceeded the output limit.`);
    }
    try {
        return JSON.parse(output.stdout);
    }
    catch (error) {
        throw new ReviewError('bad-response', `GitHub returned invalid JSON for ${what ?? path}.`, { cause: error });
    }
}
/**
 * Resolve the pull request of the current branch.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param cwd - session working directory.
 * @param signal - command cancellation.
 * @returns the target.
 */
export async function currentPullRequest(ctx, settings, cwd, signal) {
    const output = await runGh(ctx, settings, ['pr', 'view', '--json', 'number,url'], { cwd, signal, maxBytes: 128 * 1024 });
    if (output.code !== 0) {
        const text = `${output.stderr}\n${output.stdout}`.toLowerCase();
        if (text.includes('no pull requests found') || text.includes('no open pull requests') || text.includes('no pull request')) {
            throw new ReviewError('no-pr', 'No pull request is associated with the current branch. Pass a number, owner/repo#number, or a pull request URL.');
        }
        if (isNotARepositoryMessage(text)) {
            throw new ReviewError('not-a-repository', 'The session directory is not a Git checkout. Pass owner/repo#number or a pull request URL.');
        }
        throw ghFailure(output, 'Reading the current branch pull request');
    }
    let parsed;
    try {
        parsed = JSON.parse(output.stdout);
    }
    catch (error) {
        throw new ReviewError('bad-response', 'gh pr view returned invalid JSON.', { cause: error });
    }
    const record = asRecord(parsed);
    const url = asString(record?.url);
    const number = asInteger(record?.number);
    const target = pullRequestTargetFromUrl(url);
    if (target === undefined || number === undefined || number <= 0) {
        throw new ReviewError('no-pr', 'gh pr view did not return a usable pull request URL.');
    }
    return { ...target, number };
}
/**
 * Resolve the repository of the session working directory.
 * @param ctx - plugin context.
 * @param settings - resolved settings.
 * @param cwd - session working directory.
 * @param signal - command cancellation.
 * @returns the repository.
 */
export async function currentRepository(ctx, settings, cwd, signal) {
    const output = await runGh(ctx, settings, ['repo', 'view', '--json', 'nameWithOwner,url'], {
        cwd,
        signal,
        maxBytes: 128 * 1024,
    });
    if (output.code !== 0) {
        const text = `${output.stderr}\n${output.stdout}`.toLowerCase();
        if (isNotARepositoryMessage(text) || text.includes('not a github')) {
            throw new ReviewError('not-a-repository', 'The session directory is not a GitHub repository. Run the command from a checkout, or pass owner/repo#number or a pull request URL.');
        }
        throw ghFailure(output, 'Reading the repository of the session directory');
    }
    let parsed;
    try {
        parsed = JSON.parse(output.stdout);
    }
    catch (error) {
        throw new ReviewError('bad-response', 'gh repo view returned invalid JSON.', { cause: error });
    }
    const url = asString(asRecord(parsed)?.url);
    const repository = repositoryFromUrl(url);
    if (repository === undefined)
        throw new ReviewError('not-a-repository', 'gh repo view did not return a usable repository URL.');
    return repository;
}
/**
 * Parse `https://host/owner/repo/pull/123` and its `/files` variants.
 * @param value - candidate URL.
 * @returns the target.
 */
export function pullRequestTargetFromUrl(value) {
    if (typeof value !== 'string')
        return undefined;
    const match = /^https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/pull\/([1-9]\d*)(?:\/[A-Za-z0-9._-]+)*\/?(?:[?#].*)?$/i.exec(value);
    if (match === null)
        return undefined;
    const host = match[1];
    const owner = match[2];
    const repo = match[3];
    const number = match[4];
    if (host === undefined || owner === undefined || repo === undefined || number === undefined)
        return undefined;
    return { host, owner, repo, number: Number(number) };
}
/**
 * @param value - repository URL.
 * @returns the repository.
 */
export function repositoryFromUrl(value) {
    if (typeof value !== 'string')
        return undefined;
    const match = /^https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/?$/i.exec(value);
    if (match === null)
        return undefined;
    const host = match[1];
    const owner = match[2];
    const repo = match[3];
    if (host === undefined || owner === undefined || repo === undefined)
        return undefined;
    return { host, owner, repo: repo.replace(/\.git$/i, '') };
}
/**
 * Whether a `gh` failure means the working directory is not a usable checkout.
 * The `failed to run git` prefix is gh-owned English; its suffix follows the host locale.
 * @param value - combined stdout and stderr.
 * @returns true when the directory is not a Git checkout with a remote.
 */
export function isNotARepositoryMessage(value) {
    const text = value.toLowerCase();
    return text.includes('failed to run git') || text.includes('not a git repository') || text.includes('no git remotes');
}
/**
 * Map a non-zero `gh` result to an actionable failure.
 * @param output - command result.
 * @param what - the operation being described.
 * @returns the mapped failure.
 */
export function ghFailure(output, what) {
    const detail = output.stderr.trim() || output.stdout.trim();
    const text = detail.toLowerCase();
    if (text.includes('gh auth login') || text.includes('not logged in') || text.includes('http 401') || text.includes('authentication')) {
        return new ReviewError('auth', 'GitHub authentication failed. Run "gh auth login" and retry.');
    }
    if (text.includes('http 404') || text.includes('not found')) {
        return new ReviewError('not-found', `${what} was not found, or the signed-in account cannot read it.`);
    }
    if (text.includes('rate limit')) {
        return new ReviewError('rate-limit', 'The GitHub API rate limit was reached. Retry later.');
    }
    if (text.includes('http 403') || text.includes('http 410')) {
        return new ReviewError('forbidden', `${what} is not available to the signed-in account.`);
    }
    if (text.includes('could not resolve host') || text.includes('dial tcp') || text.includes('connection refused') || text.includes('network is unreachable')) {
        return new ReviewError('network', 'Cannot reach GitHub. Check the network and retry.');
    }
    const first = detail.split('\n').find(line => line.trim() !== '') ?? `gh exited with code ${output.code}`;
    return new ReviewError('gh-failed', `${what} failed: ${first}`);
}
function readCollected(reader) {
    if (reader === undefined)
        return { text: '', lossy: false };
    const read = reader.readFrom(0);
    return { text: read.text, lossy: read.lossy };
}
function throwIfAborted(signal) {
    if (signal?.aborted === true)
        throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}
function timeoutError(command, settings) {
    return new ReviewError('timeout', `"${command}" did not finish within ${settings.requestTimeoutMs} ms.`);
}
//# sourceMappingURL=gh.js.map