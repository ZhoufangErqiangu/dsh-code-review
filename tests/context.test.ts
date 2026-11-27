import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { buildReviewContext, type GitHubReads } from '../src/context.ts'
import { DEFAULT_SETTINGS } from '../src/config.ts'
import type {
  ChangedFile,
  Context,
  PullRequestInfo,
  ReviewMeta,
  ReviewSelector,
  Settings,
} from '../src/types.ts'

const PULL_REQUEST: PullRequestInfo = {
  number: 7,
  title: 'Add the widget',
  body: 'Body of the pull request',
  state: 'open',
  draft: false,
  htmlUrl: 'https://github.com/o/r/pull/7',
  author: 'alice',
  baseRef: 'main',
  baseSha: 'base0000000000',
  headRef: 'feature',
  headSha: 'head1234567890',
  additions: 5,
  deletions: 2,
  changedFiles: 3,
  labels: ['ui'],
  headRepo: 'o/r',
}

interface FakeGitHub extends GitHubReads {
  requested: string[]
}

function fakeGithub(): FakeGitHub {
  const files: ChangedFile[] = [
    {
      filename: 'src/app.js',
      status: 'modified',
      additions: 3,
      deletions: 1,
      changes: 4,
      patch: '@@ -1,3 +1,5 @@\n-old\n+new',
      previousFilename: null,
    },
    {
      filename: 'package-lock.json',
      status: 'modified',
      additions: 100,
      deletions: 2,
      changes: 102,
      patch: '@@ -1 +1 @@\n-old\n+new',
      previousFilename: null,
    },
    {
      filename: '../evil.js',
      status: 'added',
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: '@@ -0,0 +1 @@\n+bad',
      previousFilename: null,
    },
  ]
  const requested: string[] = []
  return {
    requested,
    resolvePullRequest: async () => ({ host: 'github.com', owner: 'o', repo: 'r', number: 7, pullRequest: PULL_REQUEST }),
    fetchCommits: async () => [{ sha: 'abc123', message: 'Add widget', author: 'alice' }],
    fetchChangedFiles: async () => ({ files, truncated: false }),
    fetchFileText: async (_ctx, _settings, request) => {
      requested.push(request.path)
      return { text: `// complete ${request.path}\n`, size: 20 }
    },
  }
}

function contextForTest(): Context {
  return {} as Context
}

function selectorForTest(): ReviewSelector {
  return { kind: 'ref', owner: 'o', repo: 'r', number: 7 }
}

test('the context directory holds patches, complete files, and an index', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-code-review-'))
  t.after(() => fs.rm(cwd, { recursive: true, force: true }))

  const github = fakeGithub()
  const settings: Settings = { ...DEFAULT_SETTINGS, concurrency: 2, retentionDays: 0 }
  const result = await buildReviewContext({
    ctx: contextForTest(),
    settings,
    selector: selectorForTest(),
    cwd,
    signal: new AbortController().signal,
    github,
  })

  assert.match(result.relativeDirectory, /^\.dsh\/code-review\/o-r-7-head123$/)
  assert.deepEqual(github.requested, ['src/app.js'])

  const app = result.meta.files.find(file => file.path === 'src/app.js')
  assert.ok(app, 'source entry is present')
  const patchPath = app.patch
  assert.ok(patchPath, 'source patch is materialized')
  const fullTextPath = app.fullText
  assert.ok(fullTextPath, 'source file text is materialized')

  const patch = await fs.readFile(path.join(result.directory, patchPath), 'utf8')
  assert.match(patch, /diff --git a\/src\/app\.js b\/src\/app\.js/)
  assert.match(patch, /@@ -1,3 \+1,5 @@/)

  const fullText = await fs.readFile(path.join(result.directory, fullTextPath), 'utf8')
  assert.equal(fullText, '// complete src/app.js\n')

  const evil = result.meta.files.find(file => file.path === '../evil.js')
  assert.equal(evil?.omitted, 'unsafe-path')
  await assert.rejects(fs.access(path.join(cwd, '.dsh', 'evil.js')))

  assert.deepEqual(result.meta.skipped.generated, ['package-lock.json'])
  assert.equal(result.meta.skipped.generatedCount, 1)
  assert.match(result.indexMarkdown, /package-lock\.json/)
  assert.match(result.indexMarkdown, /untrusted data/)

  const meta = JSON.parse(await fs.readFile(path.join(result.directory, 'meta.json'), 'utf8')) as ReviewMeta
  assert.equal(meta.pullRequest.headSha, PULL_REQUEST.headSha)
  assert.equal(meta.files.length, result.meta.files.length)

  const gitignore = await fs.readFile(path.join(result.directory, '.gitignore'), 'utf8')
  assert.equal(gitignore, '*\n')
})

test('patches truncate and the text budget is reported', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-code-review-'))
  t.after(() => fs.rm(cwd, { recursive: true, force: true }))

  const github = fakeGithub()
  github.fetchFileText = async () => ({ text: 'x'.repeat(100), size: 100 })
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    maxFiles: 5,
    maxPatchBytes: 40,
    maxFileBytes: 200,
    maxTotalFileBytes: 50,
    retentionDays: 0,
  }
  const result = await buildReviewContext({
    ctx: contextForTest(),
    settings,
    selector: selectorForTest(),
    cwd,
    signal: new AbortController().signal,
    github,
  })

  const app = result.meta.files.find(file => file.path === 'src/app.js')
  assert.ok(app)
  assert.equal(app.patchTruncated, true)
  assert.equal(app.fullText, null)
  assert.equal(app.omitted, 'budget')
  const patchPath = app.patch
  assert.ok(patchPath)
  const patch = await fs.readFile(path.join(result.directory, patchPath), 'utf8')
  assert.match(patch, /truncated by dsh-code-review/)
})

test('skip reasons from the content read are preserved', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-code-review-'))
  t.after(() => fs.rm(cwd, { recursive: true, force: true }))

  const github = fakeGithub()
  github.fetchFileText = async () => ({ skipped: 'too-large', size: 999_999 })
  const settings: Settings = { ...DEFAULT_SETTINGS, maxFiles: 5, retentionDays: 0 }
  const result = await buildReviewContext({
    ctx: contextForTest(),
    settings,
    selector: selectorForTest(),
    cwd,
    signal: new AbortController().signal,
    github,
  })
  const app = result.meta.files.find(file => file.path === 'src/app.js')
  assert.equal(app?.omitted, 'too-large')
  assert.equal(app?.fullTextSize, 999_999)
})

test('old context directories are pruned and foreign directories are kept', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-code-review-'))
  t.after(() => fs.rm(cwd, { recursive: true, force: true }))

  const root = path.join(cwd, '.dsh', 'code-review')
  const oldDirectory = path.join(root, 'old-review')
  const foreignDirectory = path.join(root, 'not-ours')
  await fs.mkdir(oldDirectory, { recursive: true })
  await fs.mkdir(foreignDirectory, { recursive: true })
  await fs.writeFile(path.join(oldDirectory, '.code-review-context'), 'dsh-code-review v1\n')
  await fs.writeFile(path.join(foreignDirectory, 'meta.json'), '{}\n')
  const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000)
  await fs.utimes(path.join(oldDirectory, '.code-review-context'), eightDaysAgo, eightDaysAgo)

  const settings: Settings = { ...DEFAULT_SETTINGS, maxFiles: 5, retentionDays: 7 }
  await buildReviewContext({
    ctx: contextForTest(),
    settings,
    selector: selectorForTest(),
    cwd,
    signal: new AbortController().signal,
    github: fakeGithub(),
  })

  await assert.rejects(fs.access(oldDirectory))
  await fs.access(foreignDirectory)
})
