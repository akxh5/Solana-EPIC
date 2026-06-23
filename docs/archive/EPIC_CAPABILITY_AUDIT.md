# EPIC Subsystem Capability Audit

This document lists the actual status, file locations, verification evidence, limitations, and confidence scores for every subsystem in the EPIC platform, verified directly from the codebase.

---

## Subsystem Audits

### 1. Layout Diff Engine
* **Purpose**: Compares state account layouts between workspace commits to detect additions, removals, size changes, and type modifications.
* **Code Location**: [abi.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/abi.rs) and [layout.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/layout.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: `compare_workspaces` and `LayoutEngine` structures exist.
* **Tests**: Cover field additions, removals, layout drift, and client warnings in `abi_tests.rs` and `diff_tests.rs`.
* **Limitations**: Dynamic-sized enums default to a conservative fallback.
* **Confidence Score**: 10/10

### 2. Parser v2
* **Purpose**: Base workspace file loading and type resolution pipeline.
* **Code Location**: [packages/parser-v2/](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: Implemented structures compile and execute layout/ABI hashing routines cleanly.
* **Tests**: Verified across `abi_tests.rs`, `diff_tests.rs`, and the upgrades validation suite.
* **Confidence Score**: 10/10

### 3. Parser v3 Extensions
* **Purpose**: Extends parsing to lifetimes, where-clauses, and multiline attribute arrays.
* **Code Location**: [ast/generics.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/ast/generics.rs) and [ast/nodes.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/ast/nodes.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: Struct declarations with lifetimes and where-clauses are successfully parsed.
* **Tests**: Verified in `ast_tests.rs`.
* **Confidence Score**: 9/10

### 4. AST Engine
* **Purpose**: Models Rust functions, statements, and expressions.
* **Code Location**: [ast/nodes.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/ast/nodes.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: Models `StatementKind` and `ExpressionKind` using Rust enum definitions.
* **Tests**: Tested in `ast_tests.rs`.
* **Confidence Score**: 10/10

### 5. Type Inference
* **Purpose**: Evaluates expression kinds to resolve types using the `TypeRegistry`.
* **Code Location**: [ast/inference.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/ast/inference.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: `TypeInferenceEngine` walks fields, identifiers, and namespaces.
* **Tests**: Tested in `inference_tests.rs`.
* **Limitations**: Complex nested method call type evaluations default to `Inconclusive`.
* **Confidence Score**: 8/10

### 6. Generic Unpacker
* **Purpose**: Unpacks nested generic strings (e.g. `Account<'info, T>` -> `T`).
* **Code Location**: [ast/generics.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/ast/generics.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: `unpack_nested_generics` functions.
* **Tests**: Tested in `inference_tests.rs`.
* **Confidence Score**: 9/10

### 7. CFG Builder
* **Purpose**: Compiles statements inside an AST body into branching block nodes.
* **Code Location**: [cfg/builder.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/cfg/builder.rs) and [cfg/nodes.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/cfg/nodes.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: Sequential and conditional statement flows.
* **Tests**: Tested in `cfg_tests.rs`.
* **Limitations**: Loop constructs output boundary warnings; recursive pathways are flattened.
* **Confidence Score**: 8/10

### 8. Try Expansion
* **Purpose**: Compiles Rust try (`?`) operators as early returns.
* **Code Location**: [cfg/builder.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/cfg/builder.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: Splitting logic in block compilers.
* **Tests**: Verified in `cfg_tests.rs`.
* **Confidence Score**: 9/10

### 9. SSA-lite
* **Purpose**: Tracks variable versions (`x#1`) and active type bounds per statement.
* **Code Location**: [cfg/ssa.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/cfg/ssa.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: `SSAComputer` walks predecessor nodes in topological order.
* **Tests**: Tested in `ssa_tests.rs`.
* **Confidence Score**: 9/10

### 10. Dominance Engine
* **Purpose**: Enforces dominance containment using DFS interval indexes.
* **Code Location**: [rules/dominance.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/rules/dominance.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: Iterative dominator computer with IDoms extraction and DFS indexing.
* **Tests**: Tested in `rules_tests.rs`.
* **Confidence Score**: 9/10

### 11. GuardFacts
* **Purpose**: Normalized security contracts.
* **Code Location**: [cfg/guards.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/cfg/guards.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: `GuardFact` enum models Solana invariants (Signer, Owner, PDA, etc.).
* **Tests**: Tested in `guards_tests.rs`.
* **Confidence Score**: 10/10

### 12. Anchor Constraint Parser
* **Purpose**: Parses attribute strings to extract constraint parameters.
* **Code Location**: [cfg/guards.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/cfg/guards.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: Syn parsing punctuation meta chains mapping to SVM invariants.
* **Tests**: Verified in `guards_tests.rs`.
* **Confidence Score**: 9/10

### 13. Rule Engine
* **Purpose**: Trait definition and rule checker registry.
* **Code Location**: [rules/mod.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/rules/mod.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: `Rule` trait and `RuleEngine` executor.
* **Tests**: Tested in `rules_tests.rs`.
* **Confidence Score**: 10/10

### 14. EPIC-SEC-001 Owner Validation
* **Purpose**: Detects mutable writes lacking program owner validation dominance.
* **Code Location**: [rules/epic_sec_001.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/rules/epic_sec_001.rs).
* **Status**: **IMPLEMENTED**
* **Verification Evidence**: Integrates WDG mutability chains, dominance checker, and symbol resolver.
* **Tests**: Tested in `rules_tests.rs`.
* **Limitations**: Read-only account data poisonings are ignored (no data-flow tracking).
* **Confidence Score**: 8/10

### 15. SARIF Components
* **Purpose**: Formats diagnostic findings in standard SARIF JSON layout.
* **Code Location**: None.
* **Status**: **MISSING**
* **Verification Evidence**: No Rust or JS source files contain any SARIF mapping logic.
* **Confidence Score**: 0/10

### 16. CLI Layer
* **Purpose**: Executable commander wrapper.
* **Code Location**: [packages/cli/src/index.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/cli/src/index.ts) and [loader.ts](file:///Users/aksh/Documents/Solana%20EPIC/packages/cli/src/loader.ts).
* **Status**: **PARTIAL**
* **Verification Evidence**: Commander command setups for `analyze` and `check`.
* **Tests**: Binary resolution tests inside `packages/cli/test/loader.test.mjs`.
* **Limitations**: Exposes layout diffing but lacks any commands to run the security rules engine.
* **Confidence Score**: 7/10

### 17. GitHub Action Layer
* **Purpose**: Pull Request banner checks.
* **Code Location**: [packages/github-action/src/](file:///Users/aksh/Documents/Solana%20EPIC/packages/github-action/src/).
* **Status**: **PARTIAL**
* **Verification Evidence**: Actions core runners loading config and posting comment markdowns.
* **Tests**: Covers banner rendering inside `packages/github-action/test/report.test.mjs`.
* **Limitations**: Does not run security rules; layout diff checks only.
* **Confidence Score**: 8/10
