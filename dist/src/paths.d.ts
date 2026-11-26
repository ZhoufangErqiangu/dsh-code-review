/** Path classification and safe materialization helpers. */
import type { ChangedFile } from './types.js';
/**
 * Whether a changed path is build output, a lockfile, or another generated artifact.
 * @param filePath - repository-relative path.
 * @returns true when the path should not consume review context.
 */
export declare function isGenerated(filePath: string): boolean;
/**
 * Rank a changed file for inclusion.
 * @param file - GitHub file entry fields used for ranking.
 * @returns larger values are reviewed first.
 */
export declare function scoreFile(file: Pick<ChangedFile, 'filename' | 'status' | 'additions' | 'deletions'>): number;
/**
 * Whether an unknown-patch file is worth a complete-text request.
 * Files that GitHub returned a patch for are text regardless of this predicate.
 * @param filePath - repository-relative path.
 * @returns true when the file is likely text.
 */
export declare function isProbablyText(filePath: string): boolean;
/**
 * Validate a repository-relative path before joining it under the context root.
 * @param value - candidate path.
 * @returns the normalized path, or null when unsafe.
 */
export declare function safeRepositoryPath(value: unknown): string | null;
/**
 * Encode each segment of a repository path for the contents API.
 * @param value - validated repository-relative path.
 * @returns encoded path with `/` separators preserved.
 */
export declare function encodeRepositoryPath(value: string): string;
/**
 * Build a filesystem-friendly patch filename from the repository path.
 * @param value - repository-relative path.
 * @returns a short basename.
 */
export declare function patchBasename(value: string): string;
/**
 * Zero-padded file index used in context paths.
 * @param index - 1-based file position.
 * @returns four-digit index.
 */
export declare function padIndex(index: number): string;
//# sourceMappingURL=paths.d.ts.map