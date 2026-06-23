# EPIC Parser v3: Implementation & Build Sequence

This document outlines the concrete, step-by-step engineering tasks required to build **EPIC Parser v3**. The plan is optimized for a solo founder, focusing on incremental delivery and verification to prevent regression of the core layout-diff logic.

---

## 1. Minimal Mergeable Milestone (Milestone 1)

*   **Definition**: Sprint 1 & Sprint 2 (AST nodes definition and CFG builder compilation framework).
*   **Merge Safety**: The new AST and CFG data structures compile inside their own isolated modules (`src/ast/` and `src/cfg/`). They are entirely decoupled from the active layout check files (`src/layout.rs`, `src/abi.rs`, `src/report.rs`).
*   **Verification**: All 48 existing layout and upgrade tests run on CI without any structural changes or behavior updates.

---

## 2. Sprint Task Breakdown

### Sprint 1: Type Inference & AST Structures (`src/ast/`)

#### Task 1.1: Create AST Node Models
*   **Files to Create**: `packages/parser-v2/src/ast/nodes.rs`
*   **Files to Modify**: `packages/parser-v2/src/ast/mod.rs`, `packages/parser-v2/src/lib.rs`
*   **Description**: Define Rust structs for `FunctionNode`, `StatementNode`, `StatementKind`, `ExpressionNode`, `ExpressionKind`, and versioned symbol maps. Expose modules in crate root.
*   **Dependencies**: None.

#### Task 1.2: Implement Type Inference Walker
*   **Files to Create**: `packages/parser-v2/src/ast/inference.rs`
*   **Description**: Implement the recursive type walker. It traverses field accesses (`syn::ExprField`), references, and dereferences. It resolves variable types by recursively matching properties against the global `TypeRegistry`.
*   **Dependencies**: Task 1.1.

---

### Sprint 2: CFG Builder & Try Expander (`src/cfg/`)

#### Task 2.1: Implement CFG Graph Compiler
*   **Files to Create**: `packages/parser-v2/src/cfg/builder.rs`
*   **Files to Modify**: `packages/parser-v2/src/cfg/mod.rs`
*   **Description**: Implement statement block sequential groupings, processing simple statements, conditional branches (`if`/`else`), and return statements (`return`).
*   **Dependencies**: Task 1.2.

#### Task 2.2: Implement Try Operator (`?`) Expander
*   **Files to Modify**: `packages/parser-v2/src/cfg/builder.rs`
*   **Description**: Traverse statements for `syn::Expr::Try`. Deconstruct the expressions and insert a conditional branch node split (generating an exit edge on `Err(err)` and a sequential edge on `Ok(val)`).
*   **Dependencies**: Task 2.1.

---

### Sprint 3: SSA-lite Variable Versioner (`src/cfg/ssa.rs`)

#### Task 3.1: Implement SSA Variable Table
*   **Files to Create**: `packages/parser-v2/src/cfg/ssa.rs`
*   **Description**: Build a symbol table tracking variable assignments: `HashMap<String, Vec<VariableVersion>>`. Increments the index on assignment statements and binds the corresponding expression type.
*   **Dependencies**: Task 2.2.

#### Task 3.2: Integrate SSA Versioning inside CFG Loop
*   **Files to Modify**: `packages/parser-v2/src/cfg/builder.rs`
*   **Description**: Connect the CFG statement compiler loop with the versioner table, ensuring each statement resolves aliases to the latest active version.
*   **Dependencies**: Task 3.1.

---

### Sprint 4: Anchor Constraint AST Parser

#### Task 4.1: Extract Constraint Attribute Strings
*   **Files to Modify**: `packages/parser-v2/src/workspace.rs`
*   **Description**: Parse `#[account(constraint = "...")]` values and associate them as raw text metadata within the instruction structs.
*   **Dependencies**: Task 3.2.

#### Task 4.2: Compile Constraint Attribute ASTs
*   **Files to Modify**: `packages/parser-v2/src/workspace.rs`, `packages/parser-v2/src/cfg/builder.rs`
*   **Description**: Run `syn::parse_str::<syn::Expr>()` on constraint strings, parse them to logical trees, and inject them as virtual condition nodes executing in the instruction CFG entry node.
*   **Dependencies**: Task 4.1.

---

### Sprint 5: Rule Execution Engine & TS Integration

#### Task 5.1: Create Security Pipeline Runner
*   **Files to Create**: `packages/parser-v2/src/security/mod.rs`, `packages/parser-v2/src/security/engine.rs`
*   **Description**: Define the rule engine trait and execute the runner pipeline.
*   **Dependencies**: Task 4.2.

#### Task 5.2: Expose Security Reports via CLI
*   **Files to Modify**: `packages/parser-v2/src/main.rs`, `packages/parser/src/project.ts`
*   **Description**: Expose the `--security` flag in the Rust binary CLI. Modify the TypeScript parser to execute the binary and format reports.
*   **Dependencies**: Task 5.1.

---

## 3. Subsystem Test Cases

### Subsystem: Type Inference
*   **Test Case 1 (Nested Fields)**:
    *   *Input Code*: `let owner = ctx.accounts.vault.owner;`
    *   *Given types*: `ctx: Context`, `vault: Account<'info, VaultState>`, `VaultState: struct { owner: Pubkey }`.
    *   *Verify*: Symbol `owner` is inferred as type `Pubkey`.
*   **Test Case 2 (Circular/Unknown Fallback)**:
    *   *Input Code*: `let value = ctx.accounts.unresolved_dependency.data;`
    *   *Verify*: Unresolved path falls back to `TypeRef::Unknown` and does not panic.

### Subsystem: SSA-lite Versioner
*   **Test Case 1 (Temporal Re-assignment)**:
    *   *Input Code*:
        ```rust
        let mut auth = user.key(); // version 0
        auth = admin.key(); // version 1
        ```
    *   *Verify*: Checking statements at line 1 resolves `auth` to `user`; statements at line 2 and after resolve `auth` to `admin`.

### Subsystem: Try Expander
*   **Test Case 1 (Branch Split)**:
    *   *Input Code*: `let token = unpack_token(info)?;`
    *   *Verify*: CFG contains two edges exiting this statement: one leading to the early-return block, one leading to the subsequent statement block.

### Subsystem: Constraint Parser
*   **Test Case 1 (Constraint Expression)**:
    *   *Input Code*: `#[account(constraint = pool.owner == user.key())]`
    *   *Verify*: CFG entry node has an edge representing the conditional verification `pool.owner == user.key()`.

---

## 4. Subsystem Acceptance Criteria

### Type Inference Walker
1.  Must successfully resolve nested paths up to depth 5 in the `TypeRegistry`.
2.  Must not trigger compilation panics on unresolved, recursive, or circular type maps.
3.  Must resolve references (`&`) and dereferences (`*`) back to their concrete underlying type definition.

### SSA-lite Versioner
1.  Must correctly increment variable indices on every local scope variable assignment.
2.  Must trace scope variables, ensuring shadowed variables inside nested `if` blocks do not overwrite the outer variable scope state upon block exit.

### Try Expander
1.  Must parse `syn::Expr::Try` operator structures (`?`) nested inside variable let bindings.
2.  Must register the error output branch as leading to a terminal early-return exit state, terminating execution trace.

### Constraint Parser
1.  Must parse valid Rust expression syntax contained inside string attributes.
2.  Invalid syntax inside attributes must fail closed, marking the function as `INCONCLUSIVE` instead of silently ignoring the check constraint.
