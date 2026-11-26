/** The agent-facing tool that prepares the review context. */
import type { Context, Settings, ToolDefinition } from './types.js';
export declare const PREPARE_TOOL_NAME = "prepare_code_review";
/** Canonical result of one context preparation. */
export interface PreparedReview {
    directory: string;
    indexPath: string;
    owner: string;
    repo: string;
    number: number;
    title: string;
    headSha: string;
    filesChanged: number;
    filesIncluded: number;
    filesTruncated: boolean;
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
export declare function createPrepareReviewTool(ctx: Context, currentSettings: () => Settings): ToolDefinition;
//# sourceMappingURL=tool.d.ts.map