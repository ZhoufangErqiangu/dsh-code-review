#!/usr/bin/env node
/**
 * Build one real review context with the local `gh` CLI and print the prompt.
 * Usage: node dist/scripts/dry-run.js <pull request URL | owner/repo#number | number>
 */
import { spawn } from 'node:child_process';
import { buildReviewContext } from '../src/context.js';
import { normalizeSettings } from '../src/config.js';
import { buildReviewStartPrompt, resolveLanguage } from '../src/prompt.js';
import { parseSelector } from '../src/selectors.js';
const input = process.argv[2];
if (input === undefined || input.trim() === '') {
    console.error('Usage: node dist/scripts/dry-run.js <pull request URL | owner/repo#number | number>');
    process.exit(2);
}
const selector = parseSelector(input);
if (selector.kind === 'invalid') {
    console.error(selector.message);
    process.exit(2);
}
const subprocess = {
    resolveExecutable: async (command) => command,
    spawn: (spec) => {
        const child = spawn(spec.argv[0] ?? 'gh', spec.argv.slice(1), {
            cwd: spec.cwd,
            env: { ...process.env, ...spec.env },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');
        child.stdout?.on('data', (chunk) => { stdout += chunk; });
        child.stderr?.on('data', (chunk) => { stderr += chunk; });
        const done = new Promise((resolve, reject) => {
            child.on('close', code => resolve({ exitCode: code, signal: null }));
            child.on('error', reject);
        });
        spec.signal?.addEventListener('abort', () => child.kill('SIGTERM'), { once: true });
        const reader = (get) => ({
            readFrom: () => {
                const value = get();
                return { text: value, nextOffset: value.length, lossy: false };
            },
        });
        return {
            done,
            collected: { stdout: reader(() => stdout), stderr: reader(() => stderr) },
            terminate: () => child.kill('SIGTERM'),
            waitForExit: async () => true,
        };
    },
};
const ctx = { subprocess, get: () => undefined };
const settings = normalizeSettings({ retentionDays: 0 });
try {
    const result = await buildReviewContext({
        ctx,
        settings,
        selector,
        cwd: process.cwd(),
        signal: new AbortController().signal,
    });
    console.log(result.indexMarkdown);
    console.log('\n--- prompt ---\n');
    console.log(buildReviewStartPrompt({
        target: input.trim(),
        language: resolveLanguage(settings.language, ctx),
        maxFindings: settings.maxFindings,
    }));
    console.log(`\n--- context directory ---\n${result.directory}`);
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
//# sourceMappingURL=dry-run.js.map