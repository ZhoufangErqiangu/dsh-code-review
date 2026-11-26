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

test('the plugin declares its services and registers one command and one skill', () => {
  const commands: CommandDefinition[] = []
  const skills: SkillRegistration[] = []
  const ctx = {
    effect: (fn: () => unknown) => fn(),
    commands: {
      register: (definition: CommandDefinition) => {
        commands.push(definition)
        return () => {}
      },
    },
    skills: {
      register: (definition: SkillRegistration) => {
        skills.push(definition)
        return () => {}
      },
    },
  } as unknown as Context

  apply(ctx, {})

  assert.equal(name, 'code-review')
  assert.deepEqual(inject, ['commands', 'subprocess', 'workingDirectory', 'skills'])
  assert.equal(commands.length, 1)
  assert.equal(commands[0]?.name, 'code-review')
  assert.equal(typeof commands[0]?.handler, 'function')
  assert.equal(skills.length, 1)
  const skill = skills[0]
  assert.ok(skill)
  assert.equal(skill.name, 'dsh-code-review')
  assert.equal(skill.invocation?.userInvocable, false)
  assert.match(skill.content, /## Budget/)
  assert.match(skill.content, /Do not modify files/)
})

test('a malformed selector returns usage without reading GitHub', async () => {
  const commands: CommandDefinition[] = []
  const ctx = {
    effect: (fn: () => unknown) => fn(),
    commands: {
      register: (definition: CommandDefinition) => {
        commands.push(definition)
        return () => {}
      },
    },
    skills: { register: () => () => {} },
  } as unknown as Context
  apply(ctx, {})
  const command = commands[0]
  assert.ok(command)
  const result = await command.handler(invocationFor(
    fakeAgent(() => { throw new Error('must not submit') }),
    'not a pull request',
  ))
  if (result.kind !== 'error') assert.fail('expected an error result')
  assert.match(result.text, /Usage: \/code-review/)
})

test('the command prepares the context and submits one review turn', async (t) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-code-review-command-'))
  t.after(() => fs.rm(cwd, { recursive: true, force: true }))

  const commands: CommandDefinition[] = []
  const followed: UserMessage[] = []
  const ctx = {
    effect: (fn: () => unknown) => fn(),
    commands: {
      register: (definition: CommandDefinition) => {
        commands.push(definition)
        return () => {}
      },
    },
    skills: { register: () => () => {} },
    workingDirectory: { ensure: async () => cwd },
    subprocess: fakeSubprocess(),
    get: () => undefined,
    logger: { warn: () => {} },
  } as unknown as Context
  apply(ctx, { retentionDays: 0 })
  const command = commands[0]
  assert.ok(command)
  const agent = fakeAgent(message => followed.push(message))
  const result = await command.handler(invocationFor(agent, 'o/r#7'))

  if (result.kind !== 'success') assert.fail('expected a success result')
  assert.match(result.text ?? '', /Reviewing o\/r#7/)
  assert.match(result.text ?? '', /1 files, \+1 -1/)
  const message = followed[0]
  assert.ok(message)
  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'user')
  assert.match(message.id, /^[0-9a-f-]{36}$/)
  const block = message.content[0]
  assert.ok(block)
  if (block.type !== 'text') assert.fail('expected a text block')
  assert.match(block.text, /head1234567890/)
  assert.match(block.text, /dsh-code-review/)
  assert.match(block.text, /\.dsh\/code-review\/o-r-7-head123/)

  const index = await fs.readFile(path.join(cwd, '.dsh', 'code-review', 'o-r-7-head123', 'index.md'), 'utf8')
  assert.match(index, /src\/a\.ts/)
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
