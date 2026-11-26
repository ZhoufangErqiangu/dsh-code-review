import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Config } from '../index.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/config.js';
test('missing configuration keeps every default', () => {
    assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
    assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
});
test('known fields override defaults', () => {
    const settings = normalizeSettings({ maxFiles: 12, language: 'zh', concurrency: 2 });
    assert.equal(settings.maxFiles, 12);
    assert.equal(settings.language, 'zh');
    assert.equal(settings.concurrency, 2);
    assert.equal(settings.maxFindings, DEFAULT_SETTINGS.maxFindings);
});
test('volatile Config references are unwrapped', () => {
    const settings = normalizeSettings({
        maxFiles: { get: () => 12 },
        language: { get: () => 'zh' },
        retentionDays: { get: () => 0 },
    });
    assert.equal(settings.maxFiles, 12);
    assert.equal(settings.language, 'zh');
    assert.equal(settings.retentionDays, 0);
});
test('invalid values fail loudly', () => {
    assert.throws(() => normalizeSettings({ maxFiles: 0 }), /maxFiles/);
    assert.throws(() => normalizeSettings({ maxFiles: 1.5 }), /maxFiles/);
    assert.throws(() => normalizeSettings({ maxFiles: '10' }), /maxFiles/);
    assert.throws(() => normalizeSettings({ language: 'fr' }), /language/);
    assert.throws(() => normalizeSettings({ ghCommand: '' }), /ghCommand/);
    assert.throws(() => normalizeSettings({ concurrency: 64 }), /concurrency/);
});
test('the Config schema validates the row and makes the five card fields live', () => {
    const parsed = Config({ maxFiles: 12, language: 'zh', retentionDays: 0 });
    assert.equal(parsed.maxFiles.get(), 12);
    assert.equal(parsed.language.get(), 'zh');
    assert.equal(parsed.retentionDays.get(), 0);
    assert.equal(parsed.maxFindings.get(), DEFAULT_SETTINGS.maxFindings);
    assert.equal(parsed.concurrency, DEFAULT_SETTINGS.concurrency);
    const settings = normalizeSettings(parsed);
    assert.equal(settings.maxFiles, 12);
    assert.equal(settings.maxFileBytes, DEFAULT_SETTINGS.maxFileBytes);
    assert.throws(() => Config({ language: 'fr' }), /language/);
    assert.throws(() => Config({ maxFiles: 0 }), /maxFiles/);
});
//# sourceMappingURL=config.test.js.map