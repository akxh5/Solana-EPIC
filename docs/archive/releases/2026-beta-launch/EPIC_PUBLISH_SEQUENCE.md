# EPIC Publication Sequence

This document describes the exact publication order of the EPIC monorepo workspaces based on dependency topology.

## Dependency Tree Graph

```
             @epic/cli (CLI Entry Point)
              /     |     \          \
             /      |      \          \--- (Optional prebuilt binary packages:
            /       |       \               @epic/cli-darwin-arm64
   @epic/parser     |    @epic/cli-linux-x64
        \           /    @epic/cli-darwin-x64
         \         /     @epic/cli-win32-x64)
       @epic/diff-engine
             |
     @epic/github-action (GitHub Action wrapper)
```

---

## Publication Order

To prevent registry dependency mismatches on publication, packages must be published in the following topological order:

### Step 1: Prebuilt Native Platform Targets
These packages have zero internal dependencies:
1.  `@epic/cli-darwin-arm64` (`packages/cli-darwin-arm64`)
2.  `@epic/cli-darwin-x64` (`packages/cli-darwin-x64`)
3.  `@epic/cli-linux-x64` (`packages/cli-linux-x64`)
4.  `@epic/cli-win32-x64` (`packages/cli-win32-x64`)

### Step 2: Shared Libraries
5.  `@epic/parser` (`packages/parser`) — Depends only on external modules.
6.  `@epic/diff-engine` (`packages/diff-engine`) — Depends on `@epic/parser`.

### Step 3: CLI Entry Point
7.  `@epic/cli` (`packages/cli`) — Depends on `@epic/parser`, `@epic/diff-engine`, and optional target binary platform packages.

### Step 4: GitHub Action Wrapper
8.  `@epic/github-action` (`packages/github-action`) — Depends on `@epic/parser` and `@epic/diff-engine`.

---

## Publication Commands

Run the following commands sequentially from the monorepo root:

```bash
# Step 1: Publish prebuilt binary targets
cd packages/cli-darwin-arm64 && npm publish --access public
cd ../cli-darwin-x64 && npm publish --access public
cd ../cli-linux-x64 && npm publish --access public
cd ../cli-win32-x64 && npm publish --access public

# Step 2: Publish shared libraries
cd ../parser && npm publish --access public
cd ../diff-engine && npm publish --access public

# Step 3: Publish main CLI binary loader
cd ../cli && npm publish --access public

# Step 4: Publish GitHub Action
cd ../github-action && npm publish --access public
```
