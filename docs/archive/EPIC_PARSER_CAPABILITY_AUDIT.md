# EPIC Parser Capability Audit: Phase 1A Security Readiness

This capability audit evaluates the current EPIC codebase and estimates the feasibility of implementing **Phase 1A Security Guards** (Missing Signer and Ownership Validation rules) on top of the existing static analysis architecture.

---

## 1. Existing Assets & Reuse Potential

We audited EPIC's current subsystems to determine which components can be reused for Phase 1A security scanning:

### A. Rust Source Parser (`parser-v2` crate)
*   **Current Capability**: Uses `syn` to parse Rust structures (`ItemStruct`, `ItemEnum`, `ItemType`, and `ItemMod` for Anchor instruction definitions).
*   **Reuse Potential**: High. Provides the baseline files walk and AST structure generation.
*   **Missing Functionality**: Currently discards function bodies. The parser only inspects function signatures inside `visit_item_mod` to map instruction arguments. It has no capability to walk statements (`Stmt`) or expressions (`Expr`) inside instruction logic.

### B. Type Registry (`TypeRegistry` inside `types.rs`)
*   **Current Capability**: Maintains a `HashMap` mapping absolute module paths to global type definitions (`StructDef`, `EnumDef`, `AliasDef`, `InstructionDef`).
*   **Reuse Potential**: High. Serves as the core registry to resolve account structs.
*   **Missing Functionality**: Lacks local scope variable type mapping. It cannot resolve types for variables declared locally within function scopes (e.g., block-scoped variable bindings).

### C. Struct Resolver (`packages/parser/src/project.ts` and `rust.ts`)
*   **Current Capability**: Orchestrates the analysis of source files and parses account layout structs.
*   **Reuse Potential**: High for coordinating checks.
*   **Missing Functionality**: Cannot extract or represent execution expressions from instruction bodies.

### D. AST Walker (High-level only)
*   **Current Capability**: Walks structural module declarations using the `syn::visit::Visit` visitor interface.
*   **Reuse Potential**: The visitor pattern can be expanded.
*   **Missing Functionality**: Lacks visitors for tracking expressions (`Expr`), assignments, branches, and variable references.

### E. IDL Parser (`packages/parser/src/project.ts`)
*   **Current Capability**: Loads and parses JSON IDL files recursively to calculate struct layout sizes.
*   **Reuse Potential**: Low. Security scanning requires verification of instruction execution logic (checks, transfers, signers), which is missing from standard IDL structures.
*   **Missing Functionality**: Cannot perform security analysis on instruction execution blocks.

### F. Diff Engine (`packages/diff-engine`)
*   **Current Capability**: Compares layout states across program versions to check upgrade safety.
*   **Reuse Potential**: Low-Medium. Can be reused to aggregate security warnings alongside upgrade alerts in the final report output.
*   **Missing Functionality**: Lacks any logic to process security findings or run static-analysis rule pipelines.

---

## 2. Phase 1A Dependency Map

The table below outlines the core features required to implement the two Phase 1A security rules:

| Rule | Needs CFG? | Needs Type Resolution? | Needs Alias Tracking? | Needs Macro Support? | Needs Interprocedural Support? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`EPIC-SEC-001` (Ownership Check)** | **YES** | **YES** | **YES** | **YES** | **NO** (Can default to `INCONCLUSIVE` on call depth) |
| **`EPIC-SEC-002` (Missing Signer)** | **YES** | **YES** | **YES** | **YES** | **NO** (Can default to `INCONCLUSIVE` on call depth) |

*   *CFG Requirement*: Needed to trace if an assertion guard (e.g. `account.is_signer` or `account.owner == program_id`) precedes a state write or CPI operation in all execution paths.
*   *Type Resolution*: Needed to differentiate raw `AccountInfo` variables from safe `Account<'info, T>` wrappers.
*   *Alias Tracking*: Needed to follow variables bound to account attributes (e.g., `let authority = &ctx.accounts.signer;`).
*   *Macro Support*: Needed to extract constraint checks from Anchor `#[derive(Accounts)]` structures and `require!` macros.

---

## 3. Architectural Gaps

We identified the following gaps between the current codebase and the requirements of Phase 1A, ranked by implementation priority:

### 1. Function Body & Statement Parser (Rank: CRITICAL)
*   *Why*: The current parser ignores the statements and expressions inside function bodies. Without this, the engine cannot scan variable mutations or instruction checks.
*   *Gap*: Must implement `syn::visit::visit_item_fn` to walk function statements (`syn::Stmt`) and parse variables.

### 2. Control Flow Graph (CFG) Generator (Rank: CRITICAL)
*   *Why*: Required to trace execution paths and verify that validation assertions are executed before any state mutations or CPI calls.
*   *Gap*: No CFG engine currently exists in the codebase.

### 3. Local Variable Symbol & Scope Table (Rank: HIGH)
*   *Why*: Required to track type signatures of local variable bindings and resolve alias references inside instructions.
*   *Gap*: The current `TypeRegistry` only maps global/module type definitions.

### 4. Anchor Macro Attribute Mapper (Rank: HIGH)
*   *Why*: Anchor wraps constraints inside struct macro attributes (e.g., `#[account(signer)]`). If these are not parsed and mapped, the engine will trigger high false-positive rates.
*   *Gap*: Current parser strips field macros instead of evaluating them.

---

## 4. Refactor Requirements

### Verdict: B) EPIC requires a parser refactor first.

The current parser implementation is structurally limited to scanning global type declarations. Building Phase 1A security analysis directly on top of the current parser without a refactor is impossible, as the parser completely discards function execution scopes.

### Smallest Required Refactor
We can avoid rewriting the entire project by executing a highly targeted refactor inside the Rust `parser-v2` crate:

1.  **Extend `FileVisitor`**:
    Refactor `packages/parser-v2/src/workspace.rs` to visit functions:
    ```rust
    impl<'a, 'ast> Visit<'ast> for FileVisitor<'a> {
        fn visit_item_fn(&mut self, i: &'ast syn::ItemFn) {
            // Walk the statements (i.block.stmts) and build the local instruction CFG
        }
    }
    ```
2.  **In-Engine Security Analysis (Rust-native execution)**:
    Rather than exporting the entire Rust AST to TypeScript via JSON (which would be slow and introduce parsing overhead), the security analysis should execute directly in Rust using the parsed `syn` structures. The Rust binary will then output a clean list of structural `SecurityFinding` blocks:
    ```json
    [
      { "ruleId": "EPIC-SEC-001", "filePath": "src/lib.rs", "line": 42, "severity": "CRITICAL" }
    ]
    ```
    This refactor preserves the TypeScript CLI and Action runners while keeping the complex AST logic within Rust.

---

## 5. Technical Risk Assessment

| Subsystem | Complexity | Implementation Risk | False Positive Risk | False Negative Risk |
| :--- | :---: | :---: | :---: | :---: |
| **CFG Engine** | High | High | Medium | Medium |
| **Type Resolution** | Medium-High | Medium | Low | Medium |
| **Macro Resolver** | Medium | Low | Medium | Low |
| **Interprocedural Limits**| High | High | High | High |
| **SARIF Output** | Low | Low | None | None |

*   *CFG Engine Risk*: Mapping nested conditionals and early returns correctly is complex. Errors here will cause false negatives (missing actual vulnerabilities).
*   *Interprocedural Risk*: Resolving cross-file logic is highly complex. If not bounded, it causes timeouts and parsing crashes. Tracking this up to depth `2` and falling back to `INCONCLUSIVE` is the only way to manage this risk.

---

## 6. Solo Founder Feasibility & Timeline

Assuming one experienced software engineer, a realistic, high-quality implementation timeline is **11 weeks**:

*   **Weeks 1 - 3**: Refactor `parser-v2` in Rust to visit function bodies, parse statements, and map variable declarations.
*   **Weeks 4 - 6**: Develop the single-function CFG engine and scope/symbol resolver for type alias tracking.
*   **Weeks 7 - 8**: Implement the macro mapping engine for Anchor annotations (`#[account(signer)]`, `require!`).
*   **Weeks 9 - 10**: Implement the rules analyzer, execute findings, format to SARIF, and integrate with `epic.toml`.
*   **Week 11**: Validate against the historical exploit benchmark suites (Cashio & Crema) and harden error boundaries.

---

## 7. Final Verdict

### Verdict: NO (Under a 4-6 week timeline) / YES WITH REFACTOR (On an 8-11 week timeline)

### Justification
If EPIC attempts to ship Phase 1A within **4 to 6 weeks**, it will fail to deliver production-grade quality. 

A 4-6 week solo roadmap would force the developer to bypass proper CFG data-flow tracking, reverting to simple string-matching heuristics (e.g., searching for `owner` or `is_signer` checks via regular expressions). This would result in an architectural clone of Anchor Sentinel—vulnerable to the same high false-positive rates and security blindspots.

To build a high-fidelity system that protocol teams can trust:
1.  The Rust `parser-v2` must be refactored to parse function statements.
2.  A robust, local CFG data-flow pipeline must be implemented.
3.  The rules must be validated against production git histories.

This requires a minimum of **8 to 11 weeks** for a solo founder. Attempting to rush this delivery will compromise correctness and damage EPIC's credibility as a deterministic safety platform.
