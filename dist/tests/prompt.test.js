import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPrompt, resolveLanguage } from '../src/prompt.js';
function contextWithLocale(preference) {
    return {
        get: () => ({ describe: () => [{ ns: 'locale', value: { preference } }] }),
    };
}
test('auto language follows the profile locale setting', () => {
    assert.equal(resolveLanguage('auto', contextWithLocale('zh-CN')), 'zh');
});
test('auto language falls back to the host locale without settings', () => {
    const language = resolveLanguage('auto', { get: () => undefined });
    assert.ok(language === 'zh' || language === 'en');
});
test('explicit language wins over the profile', () => {
    const ctx = contextWithLocale('en');
    assert.equal(resolveLanguage('zh', ctx), 'zh');
    assert.equal(resolveLanguage('en', ctx), 'en');
});
test('the review prompt names the context, the head commit, and the rules', () => {
    const meta = {
        repository: { owner: 'o', repo: 'r' },
        context: { directory: '.dsh/code-review/o-r-1-abcdef0' },
        pullRequest: {
            number: 1,
            title: 'Fix the thing',
            headSha: 'abcdef0123456789',
            draft: false,
        },
    };
    const prompt = buildReviewPrompt({ meta, language: 'en', maxFindings: 12 });
    assert.match(prompt, /o\/r#1/);
    assert.match(prompt, /abcdef0123456789/);
    assert.match(prompt, /\.dsh\/code-review\/o-r-1-abcdef0/);
    assert.match(prompt, /dsh-code-review/);
    assert.match(prompt, /untrusted data/);
    assert.match(prompt, /at most 12 findings/);
    assert.match(prompt, /English/);
    assert.match(prompt, /do not modify repository files/);
});
//# sourceMappingURL=prompt.test.js.map