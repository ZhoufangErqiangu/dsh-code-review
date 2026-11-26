import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_SETTINGS, normalizeSettings } from '../src/config.js'

test('missing configuration keeps every default', () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS)
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS)
})

test('known fields override defaults', () => {
  const settings = normalizeSettings({ maxFiles: 12, language: 'zh', concurrency: 2 })
  assert.equal(settings.maxFiles, 12)
  assert.equal(settings.language, 'zh')
  assert.equal(settings.concurrency, 2)
  assert.equal(settings.maxFindings, DEFAULT_SETTINGS.maxFindings)
})

test('invalid values fail loudly', () => {
  assert.throws(() => normalizeSettings({ maxFiles: 0 }), /maxFiles/)
  assert.throws(() => normalizeSettings({ maxFiles: 1.5 }), /maxFiles/)
  assert.throws(() => normalizeSettings({ maxFiles: '10' }), /maxFiles/)
  assert.throws(() => normalizeSettings({ language: 'fr' }), /language/)
  assert.throws(() => normalizeSettings({ ghCommand: '' }), /ghCommand/)
  assert.throws(() => normalizeSettings({ concurrency: 64 }), /concurrency/)
})
