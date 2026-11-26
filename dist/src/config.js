/** Validated settings for the code-review plugin. */
export const DEFAULT_SETTINGS = Object.freeze({
    ghCommand: 'gh',
    maxFiles: 200,
    maxPatchBytes: 256 * 1024,
    maxFileBytes: 128 * 1024,
    maxTotalFileBytes: 8 * 1024 * 1024,
    maxFindings: 15,
    language: 'auto',
    retentionDays: 7,
    requestTimeoutMs: 30_000,
    concurrency: 4,
});
const LANGUAGES = new Set(['auto', 'zh', 'en']);
/**
 * Merge the row configuration over the defaults and reject unusable values.
 * @param raw - Loader-supplied row configuration.
 * @returns complete settings.
 */
export function normalizeSettings(raw) {
    const input = isRecord(raw) ? raw : {};
    return {
        ghCommand: stringValue(input.ghCommand, 'ghCommand', 'gh'),
        maxFiles: integerValue(input.maxFiles, 'maxFiles', 200, 1, 2000),
        maxPatchBytes: integerValue(input.maxPatchBytes, 'maxPatchBytes', 256 * 1024, 1024, 16 * 1024 * 1024),
        maxFileBytes: integerValue(input.maxFileBytes, 'maxFileBytes', 128 * 1024, 1024, 4 * 1024 * 1024),
        maxTotalFileBytes: integerValue(input.maxTotalFileBytes, 'maxTotalFileBytes', 8 * 1024 * 1024, 1024, 64 * 1024 * 1024),
        maxFindings: integerValue(input.maxFindings, 'maxFindings', 15, 1, 100),
        language: languageValue(input.language),
        retentionDays: integerValue(input.retentionDays, 'retentionDays', 7, 0, 365),
        requestTimeoutMs: integerValue(input.requestTimeoutMs, 'requestTimeoutMs', 30_000, 1000, 300_000),
        concurrency: integerValue(input.concurrency, 'concurrency', 4, 1, 16),
    };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringValue(value, name, fallback) {
    if (value === undefined)
        return fallback;
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`code-review: "${name}" must be a non-empty string`);
    }
    return value;
}
function integerValue(value, name, fallback, min, max) {
    if (value === undefined)
        return fallback;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
        throw new TypeError(`code-review: "${name}" must be an integer between ${min} and ${max}`);
    }
    return value;
}
function languageValue(value) {
    if (value === undefined)
        return 'auto';
    if (typeof value !== 'string' || !LANGUAGES.has(value)) {
        throw new TypeError('code-review: "language" must be "auto", "zh", or "en"');
    }
    return value;
}
//# sourceMappingURL=config.js.map