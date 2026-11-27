/** The agent-facing tool that prepares the review context. */

import { buildReviewContext } from './context.ts'
import { ReviewError } from './errors.ts'
import { asRecord, asString } from './json.ts'
import { USAGE, parseSelector } from './selectors.ts'
import type { Context, Settings, ToolDefinition } from './types.ts'

export const PREPARE_TOOL_NAME = 'prepare_code_review'

/** Canonical result of one context preparation. */
export interface PreparedReview {
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

/**
 * Build the `prepare_code_review` tool. The `/code-review` command returns
 * immediately and asks the agent to call this tool, so the composer is
 * released before the network work starts and progress appears as a tool card.
 * @param ctx - plugin context.
 * @param currentSettings - reads the configuration for one invocation, so a
 * live settings write applies without restarting the plugin.
 * @returns the tool definition.
 */
export function createPrepareReviewTool(ctx: Context, currentSettings: () => Settings): ToolDefinition {
  return {
    name: PREPARE_TOOL_NAME,
    description: 'Prepare a pull-request review context: resolve the pull request, fetch per-file patches and complete files at the head commit, and write them under .dsh/code-review. '
      + 'Call this before reviewing a pull request when /code-review asks you to. Does not modify the repository or GitHub. '
      + 'Read the returned indexPath first, then review only what that context reports.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['target'],
      properties: {
        target: {
          type: 'string',
          description: 'Pull request number, owner/repo#number, or a full pull request URL. Use an empty string for the current branch\'s pull request.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['directory', 'indexPath', 'owner', 'repo', 'number', 'title', 'headSha', 'filesChanged', 'filesIncluded', 'filesTruncated'],
        properties: {
          directory: { type: 'string' },
          indexPath: { type: 'string' },
          owner: { type: 'string' },
          repo: { type: 'string' },
          number: { type: 'integer' },
          title: { type: 'string' },
          headSha: { type: 'string' },
          filesChanged: { type: 'integer' },
          filesIncluded: { type: 'integer' },
          filesTruncated: { type: 'boolean' },
        },
      },
      render: (_args, value) => {
        const summary = value as unknown as PreparedReview
        const limit = summary.filesTruncated
          ? ` The context hit its limit: ${summary.filesIncluded} of ${summary.filesChanged} changed files are included.`
          : ''
        return [{
          type: 'text',
          text: `Prepared the review context for ${summary.owner}/${summary.repo}#${summary.number} "${summary.title}" at ${summary.headSha.slice(0, 7)}: ${summary.filesIncluded} of ${summary.filesChanged} files.${limit}\nRead ${summary.indexPath} first.`,
        }]
      },
    },
    async execute(args, exec) {
      const target = asString(asRecord(args)?.target)
      if (target === undefined) {
        throw new Error(`prepare_code_review requires a "target" string; use "" for the current branch. ${USAGE}`)
      }
      const selector = parseSelector(target)
      if (selector.kind === 'invalid') throw new Error(`${selector.message}\n${USAGE}`)
      if (exec.agent === undefined) throw new Error('prepare_code_review requires an agent session')

      const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal)
      try {
        const context = await buildReviewContext({
          ctx,
          settings: currentSettings(),
          selector,
          cwd,
          signal: exec.signal,
        })
        const pr = context.meta.pullRequest
        return {
          directory: context.relativeDirectory,
          indexPath: `${context.relativeDirectory}/index.md`,
          owner: context.meta.repository.owner,
          repo: context.meta.repository.repo,
          number: pr.number,
          title: pr.title,
          headSha: pr.headSha,
          filesChanged: pr.changedFiles,
          filesIncluded: context.meta.context.filesIncluded,
          filesTruncated: context.meta.context.filesTruncated,
        } satisfies PreparedReview
      } catch (error) {
        if (exec.signal.aborted) throw error
        if (error instanceof ReviewError) throw new Error(error.message, { cause: error })
        throw error
      }
    },
  }
}
