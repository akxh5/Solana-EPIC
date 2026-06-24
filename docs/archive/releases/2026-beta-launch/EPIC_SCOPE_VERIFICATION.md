# EPIC Scope Verification Report

This document audits the NPM package naming, visibility configurations, and organization scopes.

## Audit Checklist

1.  **Scope Configured**: `@epic`
2.  **Public Visibility Settings**: All package.json descriptors have:
    ```json
    "publishConfig": {
      "access": "public"
    }
    ```
3.  **Scoped Package Names**:
    *   `@epic/cli`
    *   `@epic/parser`
    *   `@epic/diff-engine`
    *   `@epic/github-action`
    *   `@epic/cli-darwin-arm64`
    *   `@epic/cli-darwin-x64`
    *   `@epic/cli-linux-x64`
    *   `@epic/cli-win32-x64`

---

## Verdict & Scope Contingency Plan

*   **If `@epic` is owned by the team**: **No scope rename is required.** Aksh can publish immediately using the current configuration.
*   **If `@epic` is taken on the NPM registry**:
    A scope rename is required. Use the `@epic-analyzer` scope.

### Scope Rename Plan
If renaming is necessary, modify `package.json` in the workspaces:

1.  **Update package names**:
    *   `@epic/cli` ➔ `@epic-analyzer/cli`
    *   `@epic/parser` ➔ `@epic-analyzer/parser`
    *   `@epic/diff-engine` ➔ `@epic-analyzer/diff-engine`
    *   `@epic/github-action` ➔ `@epic-analyzer/github-action`
    *   `@epic/cli-<platform>-<arch>` ➔ `@epic-analyzer/cli-<platform>-<arch>`

2.  **Update references**:
    *   In `packages/cli/package.json` under `dependencies` and `optionalDependencies` update `@epic/*` keys to `@epic-analyzer/*`.
    *   In `packages/diff-engine/package.json` under `dependencies` update `@epic/parser` to `@epic-analyzer/parser`.
    *   In `packages/github-action/package.json` update `@epic/*` dependencies to `@epic-analyzer/*`.
    *   In `packages/cli/src/loader.ts` under `PLATFORM_MAP` update values to `@epic-analyzer/cli-*`.
