# EPIC Parser v3: Backlog & Task List

This document represents the executable engineering backlog for **EPIC Parser v3**, structured as GitHub-sized issues ready for assignment.

---

## 1. Backlog Summary & Flow

### Target Order of Execution
1.  **Issue 1**: Core AST Node Data Structures (Start Today)
2.  **Issue 2**: Type Inference Walker
3.  **Issue 3**: Core CFG Compiler
4.  **Issue 4**: Try Operator (`?`) branch expansion
5.  **Issue 5**: SSA-lite variable versioner and symbol table
6.  **Issue 6**: Anchor constraint parser
7.  **Issue 7**: Rust rule executor integration and TypeScript CLI bridge

### Core Blockers
*   *None (Foundational issues 1 & 2 are unblocked)*. 
*   *Downstream Blockers*: Issue 3 depends on Issues 1 & 2. Issue 5 depends on Issue 3. Issue 7 depends on all prior parser implementations.

---

## 2. Issues Backlog

### Issue 1: Implement core AST node data structures for Function, Statement, and Expression
*   **Track**: Critical Path
*   **Description**: Define the core internal AST structures in Rust to represent code elements extracted from instruction functions.
*   **Files Touched**:
    *   `packages/parser-v2/src/ast/nodes.rs` (Create)
    *   `packages/parser-v2/src/ast/mod.rs` (Create)
    *   `packages/parser-v2/src/lib.rs` (Modify)
*   **Acceptance Criteria**:
    1.  Crate compiles successfully with new types: `FunctionNode`, `StatementNode`, `StatementKind`, `ExpressionNode`, `ExpressionKind`.
    2.  `StatementKind` and `ExpressionKind` must support nested blocks and standard operators.
*   **Estimated Effort**: 6 hours

---

### Issue 2: Implement TypeInferenceWalker for AST expressions
*   **Track**: Critical Path
*   **Description**: Build the recursive type walker to resolve types of nested expressions (e.g. `ctx.accounts.vault.owner`) by matching them against the global `TypeRegistry`.
*   **Files Touched**:
    *   `packages/parser-v2/src/ast/inference.rs` (Create)
    *   `packages/parser-v2/src/ast/mod.rs` (Modify)
*   **Acceptance Criteria**:
    1.  Recursively walks field accesses (`syn::ExprField`).
    2.  Successfully resolves primitive and custom types from the registry.
    3.  Fails closed to `TypeRef::Unknown` instead of panicking on unresolved type pathways.
*   **Estimated Effort**: 16 hours

---

### Issue 3: Implement CFG Node and Edge compilation framework
*   **Track**: Critical Path
*   **Description**: Compile sequential statement blocks, conditional branches (`if`/`else`), and direct early returns (`return`, `require!`) into a single-function Control Flow Graph.
*   **Files Touched**:
    *   `packages/parser-v2/src/cfg/builder.rs` (Create)
    *   `packages/parser-v2/src/cfg/mod.rs` (Create)
*   **Acceptance Criteria**:
    1.  Computes sequential basic blocks.
    2.  Conditional statements produce two separate graph edges (True and False paths) rejoining correctly.
    3.  Asserts and panic calls generate diverging edges terminating at exit nodes.
*   **Estimated Effort**: 12 hours

---

### Issue 4: Implement Try Operator ('?') CFG branch expansion
*   **Track**: Critical Path
*   **Description**: Identify statements wrapping `syn::Expr::Try` and split the execution path, mapping error cases to early exit routes.
*   **Files Touched**:
    *   `packages/parser-v2/src/cfg/builder.rs` (Modify)
*   **Acceptance Criteria**:
    1.  Identifies the `?` try operator inside assignments.
    2.  Splits execution: `Err` path terminates at early exit; `Ok` path continues to subsequent statements.
*   **Estimated Effort**: 10 hours

---

### Issue 5: Implement SSA-lite local variable versioning and alias tracking
*   **Track**: Critical Path
*   **Description**: Build a scoped symbol table that tracks local mutable variable assignments and increments active version suffixes to support temporal lookup checks.
*   **Files Touched**:
    *   `packages/parser-v2/src/cfg/ssa.rs` (Create)
    *   `packages/parser-v2/src/cfg/mod.rs` (Modify)
    *   `packages/parser-v2/src/cfg/builder.rs` (Modify)
*   **Acceptance Criteria**:
    1.  Re-assigning a variable increments its version index (e.g. `auth` maps to `auth_v1` then `auth_v2`).
    2.  Variables declared in nested blocks map parent-pointer scopes correctly, restoring original scope bindings upon block exit.
*   **Estimated Effort**: 12 hours

---

### Issue 6: Parse and compile #[account(constraint = "...")] attributes
*   **Track**: Critical Path
*   **Description**: Extract constraint strings from struct annotations, parse them via `syn::parse_str`, and inject them as virtual CFG validation blocks at instruction entry.
*   **Files Touched**:
    *   `packages/parser-v2/src/workspace.rs` (Modify)
    *   `packages/parser-v2/src/cfg/builder.rs` (Modify)
*   **Acceptance Criteria**:
    1.  Constraint attributes inside account macros parse correctly to expression nodes.
    2.  Expressions inject successfully as conditional branches preceding instruction function entries.
    3.  Syntax errors in constraint strings trigger `INCONCLUSIVE` execution state.
*   **Estimated Effort**: 14 hours

---

### Issue 7: Build security validation runner and CLI integration
*   **Track**: Critical Path
*   **Description**: Implement the security rules evaluator execution harness inside Rust, add the `--security` command flag to CLI parameters, and hook the results array to the TypeScript reporting layer.
*   **Files Touched**:
    *   `packages/parser-v2/src/security/mod.rs` (Create)
    *   `packages/parser-v2/src/security/engine.rs` (Create)
    *   `packages/parser-v2/src/main.rs` (Modify)
    *   `packages/parser/src/project.ts` (Modify)
*   **Acceptance Criteria**:
    1.  The security pipeline runs rules natively inside Rust and returns a serialized list of `SecurityFinding` objects to TS.
    2.  `epic.toml` parses and applies configuration overrides.
    3.  The TypeScript CLI executes the updated parser and terminates with the correct exit status codes.
*   **Estimated Effort**: 10 hours
