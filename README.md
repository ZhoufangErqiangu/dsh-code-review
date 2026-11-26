# Code review

`/code-review` prepares a GitHub pull request and hands the current agent a structured review task. It is designed for the Web client, and works anywhere slash commands are available.

## Requirements

- The `gh` CLI installed and signed in (`gh auth login`). The plugin runs `gh` itself, so `GH_TOKEN` in the environment is not forwarded; sign in through `gh` instead.
- A GitHub-hosted pull request. GitLab and other code hosts are not supported.
- A session with a working directory. It is used for the review context directory.
- Node.js 22 or newer for development. The plugin itself runs in the Harness's Node process.

## Install

Open **Plugins** and add the **package root** with **Add plugin** — the directory containing `package.json` and `cordis.patch.yml`. For this checkout that is the repository root, **not** `dist/`: the dialog reads `<path>/package.json` and then the bundle patch, so `dist/` alone is not a valid plugin package. Enabling the bundle inserts one Host row, `code-review`; no Client bundle is required.

The Harness loads the compiled entry `dist/index.js`. This workspace keeps a built `dist/`, so a local install works without a build step. After editing `src/`, run `npm run build` before reinstalling or reloading.

## Use

```text
/code-review                        review the open pull request of the current branch
/code-review 123                    review PR #123 in the repository of the session directory
/code-review owner/repo#123         review #123 in another repository
/code-review https://github.com/owner/repo/pull/123
```

The command resolves the pull request, fetches its metadata, the patch of every changed file, and the complete text of those files at the head commit, writes that material under `.dsh/code-review/<owner>-<repo>-<pr>-<head>/`, and submits one review request to the current agent. The command row reports the pull request, the number of files, and the diff size; the review itself arrives as the agent's reply.

The generated `index.md` lists every file with its patch and full text path, and records anything omitted because of limits. The agent can fetch a missing file read-only with `gh api` when it needs one.

## Review behavior

The bundled `dsh-code-review` skill defines the procedure: read the change, use the complete file for context, look for concrete defects, then try to falsify every candidate finding against the code before reporting it. Findings carry a severity and an exact `path:line`; pure style preferences are not reported.

The review is read-only by instruction: the prompt forbids modifying repository files, committing, and posting to GitHub. It does not change the session's permission preset, so choose a read-only preset when you want enforcement.

A project skill named `dsh-code-review` under `.dsh/skills` or `.agents/skills` takes precedence over the bundled methodology, so a repository can tune the rubric without changing the plugin.

## Configuration

The row accepts these fields in `cordis.patch.yml`:

| Field | Default | Meaning |
|---|---|---|
| `ghCommand` | `gh` | Executable used for GitHub reads |
| `maxFiles` | `200` | Maximum changed files fetched into the context |
| `maxPatchBytes` | `262144` | Per-file patch cap; a longer patch is truncated with a marker |
| `maxFileBytes` | `131072` | Per-file complete-text cap; larger files keep only their patch |
| `maxTotalFileBytes` | `8388608` | Total complete-text budget across the context |
| `maxFindings` | `15` | Findings the reviewer may report |
| `language` | `auto` | Report language: `auto`, `zh`, or `en` |
| `retentionDays` | `7` | Old review context directories are pruned after this many days |
| `requestTimeoutMs` | `30000` | Deadline for one `gh` invocation |
| `concurrency` | `4` | Concurrent file fetches |

## Limits and privacy

- Pull request metadata, patches, and complete file text are sent to the session's model as review input. Do not review private pull requests in a session whose provider may not receive that content.
- Only the first `maxFiles` changed files are fetched; a larger pull request is truncated and the omission is recorded in `index.md`.
- Binary files, generated files, lockfiles, and minified assets are skipped for complete text.
- The plugin never checks out the pull request and never writes to the reviewed repository. Review context lives under the session directory and is ignored by Git through a local `.gitignore`.
- Reviewing a pull request does not run its tests.

## Development

The plugin, tests, and scripts are TypeScript. `tsc` compiles them to `dist/`, which is the package entry the Harness loads; Node does not strip types for files under `node_modules`, so the compiled JavaScript is required.

```sh
npm install
npm run build        # tsc -> dist/
npm test             # build, then node --test on dist/tests
npm run typecheck    # tsc --noEmit
npm run dry-run -- https://github.com/owner/repo/pull/123
```

`dry-run` builds the review context with a local `gh` runner and prints the prompt instead of starting an agent turn. It is the fastest way to check selector parsing, GitHub access, and context budgets before installing.

### Types

The DSH Host API is imported **type-only** from exact-version devDependencies, not hand-written:

- `@deepseek-ai/cordis` `4.1.0`
- `@deepseek-ai/dsh-agent`, `-commands`, `-llm`, `-settings`, `-skill`, `-subprocess`, `-working-directory` `0.2.2-rc.3`

The versions are pinned because npm's `latest` tag for the DSH packages is stale (`0.0.1-rc.1`); installing without an explicit version would fetch an incompatible API. The compiled `dist/` has no `@deepseek-ai/*` import — verify with:

```sh
grep -rE "from ['\"]@deepseek-ai|import ['\"]@deepseek-ai|require\(['\"]@deepseek-ai" dist --include=*.js
```

When upgrading the Harness, update these devDependencies to the installed version and rebuild. Domain types (`Settings`, `ReviewMeta`, `ContextEntry`, and so on) remain local because they describe this plugin's own files, not a DSH contract.

### Layout

| Path | Role |
|---|---|
| `index.ts` | Bundle entry: `apply()`, `inject`, command registration |
| `src/command.ts` | `/code-review` handler |
| `src/context.ts` | Review context builder |
| `src/pull-request.ts`, `src/gh.ts` | GitHub reads through `ctx.subprocess` |
| `src/skill.ts` | Embedded `dsh-code-review` methodology |
| `src/types.ts` | Domain value types and type-only re-exports of the DSH Host API |
| `tests/` | `node:test` suites, compiled to `dist/tests` |
