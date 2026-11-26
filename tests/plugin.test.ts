import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandId } from '@deepseek-ai/dsh-commands'

import { apply, inject, name } from '../index.js'
import type {
  CommandDefinition,
  CommandInvocation,
  Context,
  SkillRegistration,
  SubprocessHandle,
  SubprocessSpawnSpec,
  ToolDefinition,
  ToolRunContext,
  UserMessage,
} from '../src/types.js'

const PULL_REQUEST = {
  number: 7,
  title: 'Add a value',
  body: 'Small change',
  state: 'open',
  draft: false,
  html_url: 'https://github.com/o/r/pull/7',
  user: { login: 'alice' },
  base: { ref: 'main', sha: 'base0000000000' },
  head: { ref: 'feature', sha: 'head1234567890', repo: { full_name: 'o/r' } },
  additions: 1,
  deletions: 1,
  changed_files: 1,
  labels: [],
}

const FILE = {
  filename: 'src/a.ts',
  status: 'modified',
  additions: 1,
  deletions: 1,
  changes: 2,
  patch: '@@ -1 +1 @@\n-old\n+new',
}

function fakeAgent(followup: (message: UserMessage) => void): Agent {
  return { followup } as unknown as Agent
}

function invocationFor(agent: Agent, rawInput: string): CommandInvocation {
  return {
    commandId: 'test-command' as CommandId,
    agent,
    rawInput,
    attachments: [],
    signal: new AbortController().signal,
  }
}

interface Registries {
  commands: CommandDefinition[]
  skills: SkillRegistration[]
  tools: ToolDefinition[]
}

function fakeContext(cwd: string, registries: Registries): Context {
  return {
    effect: (fn: () => unknown) => fn(),
    commands: {
      register: (definition: CommandDefinition) => {
        registries.commands.push(definition)
        return () => {}
      },
    },
    skills: {
      register: (definition: SkillRegistration) => {
        registries.skills.push(definition)
        return () => {}
      },
    },
    tools: {
      register: (definition: ToolDefinition) => {
        registries.tools.push(definition)
        return () => {}
      },
    },
    workingDirectory: { ensure: async () => cwd },
    subprocess: fakeSubprocess(),
    get: () => undefined,
    logger: { warn: () => {} },
  } as unknown as Context
}

test('the plugin registers one command, one skill, and one preparation tool', () => {
  const registries: Registries = { commands: [], skills: [], tools: [] }
  apply(fakeContext('/tmp', registries), {})

  assert.equal(name, 'code-review')
  assert.deepEqual(inject, ['commands', 'skills', 'subprocess', 'tools', 'workingDirectory'])
  assert.equal(registries.commands.length, 1)
  assert.equal(registries.commands[0]?.name, 'code-review')
  assert.equal(typeof registries.commands[0]?.handler, 'function')
  assert.equal(registries.skills.length, 1)
  const skill = registries.skills[0]
  assert.ok(skill)
  assert.equal(skill.name, 'dsh-code-review')
  assert.equal(skill.invocation?.userInvocable, false)
  assert.match(skill.content, /## Budget/)
  assert.match(skill.content, /prepare_code_review/)
  assert.equal(registries.tools.length, 1)
  assert.equal(registries.tools[0]?.name, 'prepare_code_review')
})

test('a malformed selector returns usage without submitting a turn', async () => {
  const registries: Registries = { commands: [], skills: [], tools: [] }
  apply(fakeContext('/tmp', registries), {})
  const command = registries.commands[0]
  assert.ok(command)
  const result = await command.handler(invocationFor(
    fakeAgent(() => { throw new Error('must not submit') }),
    'not a pull request',
  ))
  if (result.kind !== 'error') assert.fail('expected an error result')
  assert.match(result.text, /Usage: \/code-review/)
})

test('the command submits the review turn immediately', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-code-review-command-'))
  t.after(() => fs.rm(cwd, { recursive: true, force: true }))

  const registries: Registries = { commands: [], skills: [], tools: [] }
  const followed: UserMessage[] = []
  apply(fakeContext(cwd, registries), { retentionDays: 0 })
  const command = registries.commands[0]
  assert.ok(command)
  const agent = fakeAgent(message => followed.push(message))
  const result = await command.handler(invocationFor(agent, 'o/r#7'))

  if (result.kind !== 'success') assert.fail('expected a success result')
  assert.match(result.text ?? '', /Preparing the review for o\/r#7/)
  const message = followed[0]
  assert.ok(message)
  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'user')
  assert.match(message.id, /^[0-9a-f-]{36}$/)
  const block = message.content[0]
  assert.ok(block)
  if (block.type !== 'text') assert.fail('expected a text block')
  assert.match(block.text, /prepare_code_review/)
  assert.match(block.text, /"o\/r#7"/)
  assert.match(block.text, /dsh-code-review/)

  // The command must not do the network work itself, so it creates no context.
  await assert.rejects(fs.access(path.join(cwd, '.dsh')))
})

test('the preparation tool writes the context and returns its index path', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-code-review-tool-'))
  t.after(() => fs.rm(cwd, { recursive: true, force: true }))

  const registries: Registries = { commands: [], skills: [], tools: [] }
  apply(fakeContext(cwd, registries), { retentionDays: 0 })
  const tool = registries.tools[0]
  assert.ok(tool)
  const exec = {
    agent: fakeAgent(() => {}),
    signal: new AbortController().signal,
  } as unknown as ToolRunContext

  const value = await tool.execute({ target: 'o/r#7' }, exec) as {
    directory: string
    indexPath: string
    owner: string
    repo: string
    number: number
    title: string
    headSha: string
    filesChanged: number
    filesIncluded: number
    filesTruncated: boolean
  }

  assert.equal(value.directory, '.dsh/code-review/o-r-7-head123')
  assert.equal(value.indexPath, '.dsh/code-review/o-r-7-head123/index.md')
  assert.equal(value.owner, 'o')
  assert.equal(value.repo, 'r')
  assert.equal(value.number, 7)
  assert.equal(value.title, 'Add a value')
  assert.equal(value.headSha, 'head1234567890')
  assert.equal(value.filesChanged, 1)
  assert.equal(value.filesIncluded, 1)
  assert.equal(value.filesTruncated, false)

  const index = await fs.readFile(path.join(cwd, value.indexPath), 'utf8')
  assert.match(index, /src\/a\.ts/)

  await assert.rejects(tool.execute({}, exec), /requires a "target" string/)
})

function fakeSubprocess(): Context['subprocess'] {
  return {
    resolveExecutable: async (command: string) => command,
    spawn: (spec: SubprocessSpawnSpec) => {
      const args = spec.argv.slice(1)
      const endpoint = args.find(argument => argument.startsWith('repos/'))
      let payload = ''
      let code = 0
      if (endpoint === 'repos/o/r/pulls/7') payload = JSON.stringify(PULL_REQUEST)
      else if (endpoint?.startsWith('repos/o/r/pulls/7/commits')) payload = '[]'
      else if (endpoint?.startsWith('repos/o/r/pulls/7/files')) payload = JSON.stringify([FILE])
      else if (endpoint?.startsWith('repos/o/r/contents/')) {
        const text = 'export const a = 1\n'
        payload = JSON.stringify({
          type: 'file',
          encoding: 'base64',
          size: Buffer.byteLength(text),
          content: Buffer.from(text).toString('base64'),
        })
      } else {
        payload = `unexpected endpoint: ${String(endpoint)}`
        code = 1
      }
      return {
        done: Promise.resolve({ exitCode: code, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: payload, nextOffset: payload.length, lossy: false }) },
          stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) },
        },
        terminate: () => {},
        waitForExit: async () => true,
      } as unknown as SubprocessHandle
    },
  } as unknown as Context['subprocess']
}
