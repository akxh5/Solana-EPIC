# EPIC GitHub Action: Architecture & Implementation Design

This document outlines the package structure, inputs/outputs, execution flow, and implementation plan for `@epic/github-action` (to be shippable in under 3 days).

---

## 1. Directory Structure

```plaintext
packages/github-action/
├── action.yml               # GitHub Action metadata
├── package.json             # Dependencies & build scripts
├── tsconfig.json            # TypeScript configuration
├── DESIGN.md                # This design specification
├── src/
│   ├── index.ts             # Entry point (inputs parsing, run compare, set exit codes)
│   ├── github.ts            # Octokit wrapper (finding/posting/updating PR comments)
│   └── diff.ts              # Bridge to @epic/diff-engine
└── dist/
    └── index.js             # Bundled production single-file bundle (built via esbuild)
```

---

## 2. Package Structure

### `package.json`
```json
{
  "name": "@epic/github-action",
  "version": "0.1.0",
  "description": "Solana EPIC Upgrade Guard GitHub Action",
  "private": true,
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist/index.js",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@actions/core": "^1.10.1",
    "@actions/github": "^6.0.0",
    "@epic/diff-engine": "workspace:*",
    "@epic/parser": "workspace:*"
  },
  "devDependencies": {
    "esbuild": "^0.20.1",
    "typescript": "^5.3.3"
  }
}
```

### `tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

## 3. `action.yml` Definition

```yaml
name: 'Solana EPIC Upgrade Guard'
description: 'Analyze Solana program upgrade impact and verify state layout compatibility'
author: 'Solana EPIC'
inputs:
  github_token:
    description: 'GitHub Token for posting pull request comments (e.g. ${{ secrets.GITHUB_TOKEN }})'
    required: true
  old_path:
    description: 'Path to the old program version (source directory or JSON IDL file)'
    required: true
  new_path:
    description: 'Path to the new program version (source directory or JSON IDL file)'
    required: true
  fail_on_severity:
    description: 'Minimum severity level to trigger a non-zero exit code (Safe, Minor, Major, Critical)'
    required: false
    default: 'Critical'
outputs:
  severity:
    description: 'Overall upgrade severity (Safe, Minor, Major, Critical)'
  findings_count:
    description: 'Number of detected upgrade findings'
runs:
  using: 'node20'
  main: 'dist/index.js'
```

---

## 4. Execution Flow

```plaintext
1. PR Event Triggers GitHub Action
   │
   ▼
2. Read inputs (github_token, old_path, new_path, fail_on_severity)
   │
   ▼
3. Run compareAnchorPrograms(old_path, new_path)
   ├── Resolves IDL JSON files or Rust AST folders
   └── Compares layouts, field ordering, and enums
   │
   ▼
4. Format Report to Markdown
   │
   ▼
5. Upsert PR Comment
   ├── Query existing comments by "EPIC Upgrade Guard" author/header
   ├── If found: Update existing comment to prevent spam
   └── If not found: Post new comment
   │
   ▼
6. Evaluate Exit Gates
   ├── If report.severity >= fail_on_severity:
   │     ├── Log core.setFailed("EPIC blocked merge due to critical layout changes.")
   │     └── Exit 1
   └── Else:
         └── Exit 0
```

---

## 5. Implementation Plan

### Day 1: Setup, Action Scaffold, and Build Configuration
*   Create `packages/github-action` directory.
*   Write `package.json`, `tsconfig.json`, and `action.yml`.
*   Verify that `npm run build` bundles the TypeScript entry point using `esbuild` cleanly without bundling errors.

### Day 2: Diff Integration and Octokit Comment Upsert
*   Write `src/diff.ts` to wrap `@epic/diff-engine`.
*   Write `src/github.ts` using `@actions/github` to query PR comments and find comments containing `<!-- epic-upgrade-guard-comment -->`.
*   Implement create/update logic (upsert) to avoid comment spamming on repeated commits.

### Day 3: Gate Evaluation, Testing & Acceptance
*   Implement exit code logic matching `fail_on_severity`.
*   Create a test workflow to execute the action locally against the mock IDLs in the monorepo workspace.
*   Assert correct Markdown rendering, exit code gating (0 vs 1), and upserting.

---

## 6. Acceptance Criteria

1.  **Direct Execution:** The Action runs successfully using the Node 20 runner directly (no BPF compile wait times).
2.  **No Comment Spam:** Repeated runs on the same PR update the same comment, leaving only one EPIC report at any time.
3.  **Correct Exit Status:**
    *   Exits with status `1` (blocking PR) when a layout change exceeds the severity filter.
    *   Exits with status `0` (approving PR) when changes are safe.
4.  **Markdown Integrity:** Renders structured tables, collapsible sections, and an actionable checklist cleanly inside the GitHub PR UI.
