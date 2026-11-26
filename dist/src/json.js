/** Narrowing helpers for untrusted JSON values. */
/**
 * @param value - candidate.
 * @returns the value when it is a plain record.
 */
export function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
/**
 * @param value - candidate.
 * @returns the value when it is an array.
 */
export function asArray(value) {
    return Array.isArray(value) ? value : undefined;
}
/**
 * @param value - candidate.
 * @returns the value when it is a string.
 */
export function asString(value) {
    return typeof value === 'string' ? value : undefined;
}
/**
 * @param value - candidate.
 * @returns the value when it is a safe integer.
 */
export function asInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}
/**
 * @param value - candidate.
 * @returns the value when it is a boolean.
 */
export function asBoolean(value) {
    return typeof value === 'boolean' ? value : undefined;
}
//# sourceMappingURL=json.js.map