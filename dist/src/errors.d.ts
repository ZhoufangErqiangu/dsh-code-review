/** Errors whose message is safe and useful to show in the command row. */
export declare class ReviewError extends Error {
    readonly code: string;
    /**
     * @param code - stable machine-readable cause.
     * @param message - actionable text for the user.
     * @param options - original cause for logs.
     */
    constructor(code: string, message: string, options?: ErrorOptions);
}
/**
 * @param error - any thrown value.
 * @returns its message, or a string form.
 */
export declare function messageOf(error: unknown): string;
//# sourceMappingURL=errors.d.ts.map