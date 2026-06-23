# EPIC v0.1 External Protocol Engineer & DX Review

**Reviewer Status**: Skeptical External Protocol Engineer (Adversarial Audit)  
**Target Version**: EPIC v0.1.0-beta.1  
**Date**: 2026-06-18  

---

## Executive Summary

EPIC v0.1 is promoted as a "zero-SaaS, compile-free upgrade safety guard" that statically verifies Solana state layout drift. However, from the perspective of an external protocol engineer looking to adopt this in production, **the tool has severe architectural assumptions, parser edge cases, and diff-engine vulnerabilities** that can lead to false-negatives (undetected bricked states) or constant parser crashes (blocking pipelines).

This review details **9 critical weaknesses** categorized by severity, along with concrete reproduction scenarios and blocking evaluations for release.

---

## 1. Architectural & Parser Failures

### Issue 1.1: Parser Crash on Custom Nested Structs (Source-Based Analysis)
*   **Severity**: 🔴 **CRITICAL**
*   **Reproduction Steps**:
    1. Define a custom configuration struct without `#[account]` (e.g., `pub struct Config { pub authority: Pubkey }`).
    2. Define a state account containing it:
       ```rust
       #[account]
       pub struct Vault {
           pub config: Config, // Nested custom type
       }
       ```
    3. Run `epic analyze <rust_source_folder>`.
*   **Expected Behavior**: The parser resolves the size of `Config` recursively, or at least falls back to a warning/graceful error.
*   **Actual Behavior**: `sizes.ts::sizeOfRustType` fails to resolve `Config` and returns `byteSize: null`. This causes `rust.ts::parseNamedFields` to throw an `AnalysisError`, aborting the CLI execution with a stack trace.
*   **Impact & Blockers**:
    *   **Blocks Public Beta**: Yes. Almost every production Solana program uses nested custom structures. The tool will crash on nearly all real-world Rust source codebases.
    *   **Blocks External Testing**: Yes.
    *   **Blocks Superteam Grant**: Yes. (Forces teams to use IDL comparison instead of source directories, violating the "compile-free source analysis" claim).

### Issue 1.2: Struct Declarations with Lifetimes/Generics are Ignored
*   **Severity**: 🔴 **CRITICAL** (False Negative)
*   **Reproduction Steps**:
    1. Write an account struct with generic bounds or lifetime parameter:
       ```rust
       #[account]
       pub struct UserState<'info> {
           pub key: Pubkey,
           pub remaining: &'info [u8],
       }
       ```
    2. Run `epic analyze <rust_source_folder>`.
*   **Expected Behavior**: Parser extracts the struct block, registers the field types, and reports size calculations.
*   **Actual Behavior**: The struct matcher regex `/b(?:pub\s+)?struct\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g` expects the open brace `{` immediately after the struct name. The generic/lifetime bracket `<...>` breaks this regex, causing the parser to **completely ignore the struct** and report 0 accounts.
*   **Impact & Blockers**:
    *   **Blocks Public Beta**: Yes. Developers changing fields inside generic/lifetime structures will receive a false `SAFE` report, bypass CI, and brick their live accounts.
    *   **Blocks External Testing**: Yes.

### Issue 1.3: Multiline Struct Attributes Crash the Parser
*   **Severity**: 🟠 **MAJOR**
*   **Reproduction Steps**:
    1. Define an account struct with a multiline field macro attribute:
       ```rust
       #[account]
       pub struct Vault {
           #[account(
               mut,
               has_one = authority
           )]
           pub admin: Pubkey,
       }
       ```
    2. Run `epic analyze <rust_source_folder>`.
*   **Expected Behavior**: The parser ignores macro lines and extracts `admin: Pubkey`.
*   **Actual Behavior**: The field sanitizer split-logic (`!line.trimStart().startsWith("#[")`) only discards lines literally starting with `#[`. The inner lines (`mut,` and `has_one = authority`) are parsed as actual fields, causing regex matcher failures or resolving to null sizes, throwing an `AnalysisError` and crashing.
*   **Impact & Blockers**:
    *   **Blocks Public Beta**: Yes. Clean workspaces using standard Anchor configurations will fail to compile.

---

## 2. Diff-Engine Vulnerabilities & False Negatives

### Issue 2.1: Reordering Ignored if Fields are Added/Removed Simultaneously
*   **Severity**: 🔴 **CRITICAL** (False Negative)
*   **Reproduction Steps**:
    1. Start with an account:
       ```rust
       pub struct User { pub x: u64, pub y: u64 }
       ```
    2. Upgrade to:
       ```rust
       pub struct User { pub y: u64, pub x: u64, pub z: u64 } // Swapped x/y AND added z
       ```
    3. Run `epic check <old_path> <new_path>`.
*   **Expected Behavior**: Report `FIELD_REORDERED` (Critical) and `FIELD_ADDED` (Major).
*   **Actual Behavior**: Because the old and new field lengths differ (`2 !== 3`), `hasSameFieldNames` returns `false`. This completely mutes `hasFieldReordering`, meaning the engine **fails to register a `FIELD_REORDERED` finding**. It only reports `FIELD_ADDED` (Major).
*   **Impact & Blockers**:
    *   **Blocks Public Beta**: Yes. If a project sets its threshold to fail on `CRITICAL` findings, this destructive reordering change bypasses the gate and crashes serialization on mainnet.
    *   **Blocks External Testing**: Yes.

### Issue 2.2: Middle-Inserted Fields Misclassified as MAJOR (Should be CRITICAL)
*   **Severity**: 🔴 **CRITICAL** (False Negative)
*   **Reproduction Steps**:
    1. Start with an account:
       ```rust
       pub struct Data { pub active: bool, pub count: u64 }
       ```
    2. Upgrade to:
       ```rust
       pub struct Data { pub active: bool, pub val: u8, pub count: u64 } // Added val in middle
       ```
    3. Run `epic check <old_path> <new_path>`.
*   **Expected Behavior**: Report `FIELD_ADDED` at index 1 shifting subsequent fields as `CRITICAL`.
*   **Actual Behavior**: The comparison engine maps all `FIELD_ADDED` findings to `MAJOR` severity, irrespective of their index.
*   **Impact & Blockers**:
    *   **Blocks Public Beta**: Yes. Adding a field in the middle shifts trailing byte offsets, instantly bricking deserialization. Flagging this only as `MAJOR` permits deployments that break live programs.

### Issue 2.3: Dynamic Enum Variant Shift Hidden (False Negative)
*   **Severity**: 🟠 **MAJOR**
*   **Reproduction Steps**:
    1. Define an enum with variants of different sizes and save in IDL:
       ```rust
       pub enum State { Uninitialized, Active { owner: Pubkey } } // Variant 0 is 0B, Variant 1 is 32B
       ```
    2. Place inside an account struct followed by another field:
       ```rust
       pub struct Account { pub state: State, pub total: u64 }
       ```
    3. Run `epic analyze <idl_path>`.
*   **Expected Behavior**: Warn the developer that `State` causes dynamic layout shifts based on the runtime tag, making the offset of `total` variable.
*   **Actual Behavior**: The IDL parser computes `State` size as `1 + 32 = 33` and maps `dynamic: false` (since no variant field itself is a dynamic Vector/String). No layout warning is issued.
*   **Impact & Blockers**:
    *   **Blocks External Testing**: No.
    *   **Blocks Public Beta**: Yes (in terms of safety guarantees). The developer is led to believe the offset of `total` is fixed at 33 bytes, whereas it actually shifts between 1 byte and 33 bytes dynamically, crashing Borsh deserialization.

---

## 3. Product & Integration Gaps

### Issue 3.1: Misleading "Compile-Free" Claims in README
*   **Severity**: 🟡 **MINOR**
*   **Claim**: *"EPIC solves this by providing deterministic, compile-free verification of these layout changes by statically evaluating Rust ASTs"*
*   **Actual Limitation**: Since source-based analysis crashes on custom types (Issue 1.1) and skips lifetimes (Issue 1.2), developers are forced to run `anchor build` first to compile their IDL JSONs. Thus, the workflow is not compile-free in practice for production programs.
*   **Impact & Blockers**:
    *   **Blocks Superteam Grant**: Yes. Technical reviewers will spot this claim mismatch.

### Issue 3.2: EBADPLATFORM during local workspace installation
*   **Severity**: 🟡 **MINOR**
*   **Reproduction Steps**:
    1. Run `npm install` in a clean directory linking the 4 local platform wrappers.
*   **Actual Behavior**: npm throws `EBADPLATFORM` for the three non-host platform wrappers because their `os` and `cpu` constraints in `package.json` do not match the current machine.
*   **Resolution**: Developers must use `npm install --force` to link local workspace tarballs, which skips standard platform check guards. This needs clear documentation in the onboarding guide.
*   **Impact & Blockers**:
    *   **Blocks External Testing**: No (if documented).

### Issue 3.3: GitHub Action Fails on Invalid/Empty Context
*   **Severity**: 🟡 **MINOR**
*   **Reproduction Steps**:
    1. Configure the action with invalid paths or a folder that contains no parsable accounts.
*   **Actual Behavior**: The CLI exits with code 1, which blocks the pull request workflow.
*   **Impact & Blockers**:
    *   **Blocks Public Beta**: No.

---

## 4. Release Checklist Summary

| Issue ID | Description | Severity | Blocks Beta? | Blocks Tester? | Blocks Grant? |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **1.1** | Parser crash on custom types in source | 🔴 CRITICAL | **YES** | **YES** | **YES** |
| **1.2** | Generics/Lifetimes structs ignored | 🔴 CRITICAL | **YES** | **YES** | No |
| **1.3** | Multiline attributes crash | 🟠 MAJOR | **YES** | No | No |
| **2.1** | Reorder ignored when field added/removed | 🔴 CRITICAL | **YES** | **YES** | No |
| **2.2** | Middle field additions marked as MAJOR | 🔴 CRITICAL | **YES** | **YES** | No |
| **2.3** | Enum dynamic tag shift ignored | 🟠 MAJOR | **YES** | No | No |
| **3.1** | Misleading "Compile-Free" claims | 🟡 MINOR | No | No | **YES** |
| **3.2** | EBADPLATFORM package installs | 🟡 MINOR | No | No | No |
| **3.3** | GitHub Action hard failures on empty | 🟡 MINOR | No | No | No |
