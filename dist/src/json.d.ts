/** Narrowing helpers for untrusted JSON values. */
/**
 * @param value - candidate.
 * @returns the value when it is a plain record.
 */
export declare function asRecord(value: unknown): Record<string, unknown> | undefined;
/**
 * @param value - candidate.
 * @returns the value when it is an array.
 */
export declare function asArray(value: unknown): unknown[] | undefined;
/**
 * @param value - candidate.
 * @returns the value when it is a string.
 */
export declare function asString(value: unknown): string | undefined;
/**
 * @param value - candidate.
 * @returns the value when it is a safe integer.
 */
export declare function asInteger(value: unknown): number | undefined;
/**
 * @param value - candidate.
 * @returns the value when it is a boolean.
 */
export declare function asBoolean(value: unknown): boolean | undefined;
//# sourceMappingURL=json.d.ts.map