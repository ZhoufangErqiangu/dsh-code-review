import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewStartPrompt, resolveLanguage } from '../src/prompt.js';
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
test('the start prompt names the target, the preparation tool, and the rules', () => {
    const prompt = buildReviewStartPrompt({
        target: 'https://github.com/o/r/pull/1',
        language: 'en',
        maxFindings: 12,
    });
    assert.match(prompt, /https:\/\/github\.com\/o\/r\/pull\/1/);
    assert.match(prompt, /prepare_code_review/);
    assert.match(prompt, /dsh-code-review/);
    assert.match(prompt, /untrusted data/);
    assert.match(prompt, /at most 12 findings/);
    assert.match(prompt, /English/);
    assert.match(prompt, /do not modify repository files/);
    assert.match(prompt, /reports an error/);
});
test('an empty target asks for the current branch pull request', () => {
    const prompt = buildReviewStartPrompt({ target: '', language: 'zh', maxFindings: 5 });
    assert.match(prompt, /the current branch/);
    assert.match(prompt, /target ""/);
    assert.match(prompt, /Simplified Chinese/);
});
//# sourceMappingURL=prompt.test.js.map