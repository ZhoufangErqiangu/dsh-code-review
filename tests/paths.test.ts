import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  encodeRepositoryPath,
  isGenerated,
  isProbablyText,
  padIndex,
  patchBasename,
  safeRepositoryPath,
  scoreFile,
} from '../src/paths.ts'

test('repository paths are accepted only when safe', () => {
  assert.equal(safeRepositoryPath('src/app.ts'), 'src/app.ts')
  assert.equal(safeRepositoryPath('a b/c#d.ts'), 'a b/c#d.ts')
  const unsafe: unknown[] = ['../a.ts', 'a/../../b.ts', '/etc/passwd', 'a//b.ts', 'a\\b.ts', 'a/\u0000b.ts', '', 42]
  for (const value of unsafe) {
    assert.equal(safeRepositoryPath(value), null, String(value))
  }
})

test('generated paths are recognized without flagging ordinary sources', () => {
  for (const value of ['pnpm-lock.yaml', 'node_modules/a/index.js', 'dist/a.js', 'assets/app.min.js', 'coverage/lcov.info']) {
    assert.equal(isGenerated(value), true, value)
  }
  for (const value of ['src/lock.ts', 'src/components/Target.tsx', 'docs/guide.md']) {
    assert.equal(isGenerated(value), false, value)
  }
})

test('source files rank above tests, configuration, and documentation', () => {
  const file = (filename: string) => scoreFile({ filename, status: 'modified', additions: 1, deletions: 1 })
  const source = file('src/app.ts')
  const testFile = file('src/app.test.ts')
  const goTest = file('pkg/app_test.go')
  const config = file('config/app.yaml')
  const docs = file('docs/app.md')
  const generated = file('yarn.lock')
  assert.ok(source > testFile)
  assert.ok(source > goTest)
  assert.ok(testFile > config)
  assert.ok(config > docs)
  assert.ok(generated < 0)
})

test('text detection covers common source, config, and no-extension names', () => {
  assert.equal(isProbablyText('src/app.py'), true)
  assert.equal(isProbablyText('Dockerfile'), true)
  assert.equal(isProbablyText('assets/logo.png'), false)
})

test('patch names are safe and short', () => {
  assert.equal(patchBasename('src/weird name?.ts'), 'weird_name_.ts')
  assert.equal(patchBasename('src/...hidden'), 'hidden')
  assert.equal(patchBasename('src/'), 'file')
  assert.ok(patchBasename(`src/${'a'.repeat(200)}.ts`).length <= 80)
})

test('repository API paths encode each segment', () => {
  assert.equal(encodeRepositoryPath('src/a b/c#d.ts'), 'src/a%20b/c%23d.ts')
})

test('file indexes are zero padded', () => {
  assert.equal(padIndex(7), '0007')
  assert.equal(padIndex(1234), '1234')
})
