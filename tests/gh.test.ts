import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ghFailure, isNotARepositoryMessage, pullRequestTargetFromUrl, repositoryFromUrl } from '../src/gh.js'

test('pull request URLs parse with optional subpaths', () => {
  assert.deepEqual(pullRequestTargetFromUrl('https://github.com/o/r/pull/3'), {
    host: 'github.com',
    owner: 'o',
    repo: 'r',
    number: 3,
  })
  assert.equal(pullRequestTargetFromUrl('https://github.com/o/r/pull/3/files')?.number, 3)
  assert.equal(pullRequestTargetFromUrl('https://github.com/o/r/issues/3'), undefined)
})

test('repository URLs parse and drop a .git suffix', () => {
  assert.deepEqual(repositoryFromUrl('https://ghe.example.com/o/r.git'), {
    host: 'ghe.example.com',
    owner: 'o',
    repo: 'r',
  })
})

test('authentication failures point at gh auth login', () => {
  const failure = ghFailure({ code: 1, stdout: '', stderr: 'HTTP 401: Bad credentials' }, 'Reading the pull request')
  assert.equal(failure.code, 'auth')
  assert.match(failure.message, /gh auth login/)
})

test('missing resources and rate limits are distinguished', () => {
  assert.equal(ghFailure({ code: 1, stdout: '', stderr: 'HTTP 404: Not Found' }, 'x').code, 'not-found')
  assert.equal(ghFailure({ code: 1, stdout: '', stderr: 'API rate limit exceeded' }, 'x').code, 'rate-limit')
  assert.equal(ghFailure({ code: 1, stdout: '', stderr: 'HTTP 403: Forbidden' }, 'x').code, 'forbidden')
})

test('unknown failures keep the first line of detail', () => {
  const failure = ghFailure({ code: 2, stdout: '', stderr: 'first line\nsecond line' }, 'Listing files')
  assert.equal(failure.code, 'gh-failed')
  assert.match(failure.message, /Listing files failed: first line/)
})

test('localized git failures are recognized as a missing checkout', () => {
  assert.equal(isNotARepositoryMessage('failed to run git: fatal: 不是 Git 仓库'), true)
  assert.equal(isNotARepositoryMessage('failed to run git: fatal: not a git repository'), true)
  assert.equal(isNotARepositoryMessage('HTTP 404: Not Found'), false)
})
