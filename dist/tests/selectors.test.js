import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSelector } from '../src/selectors.js';
test('empty input targets the current branch pull request', () => {
    assert.deepEqual(parseSelector(''), { kind: 'current' });
    assert.deepEqual(parseSelector('   '), { kind: 'current' });
});
test('bare numbers and hash numbers target the current repository', () => {
    assert.deepEqual(parseSelector('123'), { kind: 'number', number: 123 });
    assert.deepEqual(parseSelector('#7'), { kind: 'number', number: 7 });
});
test('owner/repo#number targets another repository', () => {
    assert.deepEqual(parseSelector('deepseek-ai/deepseek-harness#42'), {
        kind: 'ref',
        owner: 'deepseek-ai',
        repo: 'deepseek-harness',
        number: 42,
    });
});
test('pull request URLs are accepted with trailing paths, slashes, and queries', () => {
    const expected = { kind: 'url', host: 'github.com', owner: 'o', repo: 'r', number: 9 };
    assert.deepEqual(parseSelector('https://github.com/o/r/pull/9'), expected);
    assert.deepEqual(parseSelector('https://github.com/o/r/pull/9/'), expected);
    assert.deepEqual(parseSelector('https://github.com/o/r/pull/9/files'), expected);
    assert.deepEqual(parseSelector('https://github.com/o/r/pull/9?diff=split'), expected);
});
test('enterprise hosts and dotted repository names are accepted', () => {
    assert.deepEqual(parseSelector('https://ghe.example.com/team/.github/pull/3'), {
        kind: 'url',
        host: 'ghe.example.com',
        owner: 'team',
        repo: '.github',
        number: 3,
    });
});
test('invalid selectors report a reason', () => {
    for (const input of ['abc', 'owner/repo', '0', '-1', 'https://github.com/o/r/issues/1', 'https://github.com/o/r/pull/0']) {
        const parsed = parseSelector(input);
        if (parsed.kind !== 'invalid')
            assert.fail(`expected invalid selector for ${input}`);
        assert.ok(parsed.message.length > 0);
    }
});
//# sourceMappingURL=selectors.test.js.map