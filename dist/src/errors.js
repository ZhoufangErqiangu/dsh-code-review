/** Errors whose message is safe and useful to show in the command row. */
export class ReviewError extends Error {
    code;
    /**
     * @param code - stable machine-readable cause.
     * @param message - actionable text for the user.
     * @param options - original cause for logs.
     */
    constructor(code, message, options = {}) {
        super(message, options);
        this.name = 'ReviewError';
        this.code = code;
    }
}
/**
 * @param error - any thrown value.
 * @returns its message, or a string form.
 */
export function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=errors.js.map