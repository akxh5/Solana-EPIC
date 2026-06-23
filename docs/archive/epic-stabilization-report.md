# EPIC v0.1 Correctness Stabilization Report

**Lead Engineer**: Senior Software Engineer  
**Status**: Stabilization Sprint Completed Successfully (All Bugs Resolved)  
**Date**: 2026-06-18  

---

## 1. Sprint Summary

This sprint addressed all 6 code defects identified in the external review. By restructuring key parsing algorithms in the AST static parser (`@epic/parser`) and the change classification rules inside the comparison engine (`@epic/diff-engine`), we have elevated EPIC's accuracy, safety, and robustness.

*   **Total Bugs Resolved**: 6
*   **Total Tests Added/Updated**: 6 Regression Tests (Fully verified)
*   **Historical Upgrade Validation Accuracy**: 100.0% (15/15 cases passing correctly)
*   **Monorepo Test Suite Status**: ✅ **48/48 tests passing**

---

## 2. Detailed Fixes & Implementation

### Issue 1.1: Custom Nested Struct Sizing Crash
*   **Root Cause**: When evaluating fields in Rust source code, if a field referenced a user-defined helper struct (e.g. `pub config: BankConfig`), the type size resolver returned `null` and threw `AnalysisError` because it had no knowledge of other structs defined in the workspace.
*   **Fix Implemented**:
    1.  Introduced `parseAllRawStructs` in [packages/parser/src/rust.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/src/rust.ts#L30-L75).
    2.  Modified [packages/parser/src/project.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/src/project.ts#L10-L58) to perform an initial pass across all Rust source files to extract and index helper structs inside a global `typesRegistry` Map.
    3.  Modified `sizeOfRustType` in [packages/parser/src/sizes.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/src/sizes.ts#L90-L132) to recursively calculate composite sizes using the registry and check for circular reference issues safely.
*   **Before Behavior**: Analysis aborted immediately with a hard `AnalysisError` due to undefined type sizing.
*   **After Behavior**: Custom nested structures are resolved recursively, correctly contributing to the cumulative layout size.

### Issue 1.2: Lifetimes and Generics Ignored in Source Analysis
*   **Root Cause**: The struct name scanner regex required `{` to immediately follow the struct identifier name. Generic brackets and lifetimes (e.g. `<'info, T>`) broke the pattern match, resulting in the struct block being ignored.
*   **Fix Implemented**:
    Updated `findNextStructBlock` inside [packages/parser/src/rust.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/src/rust.ts#L173-L208) to use a word-boundary based search matching `\bstruct Name\b`. It now locates the next body open-brace `{` while tracing and skipping unit/tuple structs that use a semicolon `;`.
*   **Before Behavior**: Account structs containing lifetime tags or generics were skipped, returning `0` parsed structures.
*   **After Behavior**: Lifetimes, generics, and `where` clauses are correctly parsed, and account fields/sizes are fully extracted.

### Issue 1.3: Multiline Struct Attributes Skip Fields
*   **Root Cause**: Prefix line filters only stripped lines strictly starting with `#[`. For multiline attributes, the inner lines (e.g. `mut,`) were kept in the code stream, causing field regex matchers to fail and silently skip the field.
*   **Fix Implemented**:
    1.  Implemented `stripMacroAttributes` in [packages/parser/src/rust.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/src/rust.ts#L222-L257), which parses the string and strips matching brackets recursively from `#[` to `]`.
    2.  Structured a fail-closed parser check in `parseNamedFields`: if any non-empty text remains after stripping comments and attributes but fails the field regex match, it throws a parse error rather than silently skipping the field.
*   **Before Behavior**: Fields declared below multiline attributes were silently skipped, resulting in incorrect layout calculations without warning.
*   **After Behavior**: Multiline attributes are stripped correctly, fields are parsed, and invalid structures trigger compilation errors.

### Issue 2.1: Swapped Fields Muted on Length Changes
*   **Root Cause**: Reordering detection required matching field lengths. Adding or removing a field at the same time as reordering bypassed the check entirely.
*   **Fix Implemented**:
    Replaced the reordering check inside [packages/diff-engine/src/compare.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/diff-engine/src/compare.ts#L133-L149) with a relative-order evaluation of matching intersecting fields. It checks positional indexes of matching fields between the old and new accounts directly.
*   **Before Behavior**: Simultaneous field swap and additions/removals muted `FIELD_REORDERED` (Critical) and only reported `FIELD_ADDED` (Major).
*   **After Behavior**: Swaps are detected and reported as `CRITICAL` regardless of size or length shifts.

### Issue 2.2: Middle Field Insertion Mapped to MAJOR
*   **Root Cause**: Added fields were mapped to `FIELD_ADDED` which was always classified as `MAJOR` severity in `classify.ts`.
*   **Fix Implemented**:
    1.  Modified [packages/diff-engine/src/compare.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/diff-engine/src/compare.ts#L121-L136) to check if any existing old fields occur after the newly added field in the new struct.
    2.  If so, the field is a middle insertion and is marked as `CRITICAL`. Otherwise, it is a trailing append and is marked as `MAJOR`.
    3.  Preserved this `CRITICAL` severity override in [packages/diff-engine/src/classify.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/diff-engine/src/classify.ts#L22-L31).
*   **Before Behavior**: Middle field insertions (which brick deserializations by shifting byte offsets) were classified as `MAJOR` and bypassed safety checks.
*   **After Behavior**: Middle field insertions are correctly classified as `CRITICAL`, while trailing appends remain `MAJOR`.

### Issue 2.3: Dynamic Enum Variant sizing hidden as static
*   **Root Cause**: Enums were calculated statically based on `1` (tag byte) + size of the largest variant payload, and marked as `dynamic: false` unless a variant field itself was dynamic.
*   **Fix Implemented**:
    Updated the enum calculation block inside [packages/parser/src/project.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/src/project.ts#L260-L282) to track sizes of all variants. If any variants have differing sizes (e.g. 0B vs 32B), the type is marked as `dynamic: true` and flags a warning.
*   **Before Behavior**: Varying enum variants were treated as static, hiding tag-based runtime offset shifts.
*   **After Behavior**: Varying variants are correctly flagged as `dynamic: true` with layout warnings.

---

## 3. Files Modified

The following files were updated during this sprint:
*   [packages/parser/src/sizes.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/src/sizes.ts)
*   [packages/parser/src/rust.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/src/rust.ts)
*   [packages/parser/src/project.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/src/project.ts)
*   [packages/diff-engine/src/compare.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/diff-engine/src/compare.ts)
*   [packages/diff-engine/src/classify.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/diff-engine/src/classify.ts)
*   [packages/parser/test/verification.test.mjs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser/test/verification.test.mjs)
*   [packages/diff-engine/test/verification.test.mjs](file:///Users/aksh/Documents/Solana%20EPIC/packages/diff-engine/test/verification.test.mjs)

---

## 4. Regression Test Suites Added

Six distinct regression tests were added to confirm stabilization:
1.  **`Issue 1.1`** (`parser`): Verifies recursive resolution of a nested custom `BankConfig` struct inside `Vault`.
2.  **`Issue 1.2`** (`parser`): Verifies parsing of generic parameters, lifetime tags (`<'info, T>`), and `where` clauses.
3.  **`Issue 1.3`** (`parser`): Verifies multiline attributes do not omit trailing fields (e.g., `admin`).
4.  **`Issue 2.1`** (`diff-engine`): Verifies field reordering is detected as `CRITICAL` when a new field is added at the same time.
5.  **`Issue 2.2`** (`diff-engine`): Verifies middle-inserted fields are marked `CRITICAL`, while trailing appends remain `MAJOR`.
6.  **`Issue 2.3`** (`diff-engine`): Verifies enums with varying variant sizes are marked as dynamic with layout warnings.

---

## 5. Remaining Known Limitations

*   **Custom Struct Declarations in Non-Scanned Files**: The source parser builds a type registry from scanned files in the project path. If a protocol imports custom structs from a separate crate outside the target project folder, their definitions won't be scanned, resulting in unresolved types. (In these cases, compile to Anchor IDL first and perform IDL-based comparisons).
*   **Borsh vs Memory Layout Alignment**: EPIC calculates Borsh serialized layout sizes on-chain. Developers using native Rust memory sizing functions (e.g. `std::mem::size_of`) should note that EPIC does not calculate memory alignment padding bytes, as Borsh serialization uses no padding.
