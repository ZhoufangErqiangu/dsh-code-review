/**
 * Shared value types, plus type-only re-exports of the DSH Host API.
 *
 * DSH packages are build-only devDependencies pinned to the Harness version
 * used for the build. They are imported with `import type` only, so the
 * compiled plugin has no runtime import of any `@deepseek-ai` package: the
 * Harness ships those packages, and `dist/` uses Node built-ins plus local
 * modules. Update the devDependency versions and rebuild when upgrading DSH.
 */
export {};
//# sourceMappingURL=types.js.map