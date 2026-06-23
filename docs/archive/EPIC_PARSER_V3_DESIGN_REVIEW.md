# EPIC Parser v3: Pre-Implementation Architecture Review

*   **Reviewer**: Senior Compiler Engineer, Solana Protocol Auditor
*   **Focus**: Correctness, Soundness, and Extensibility of Parser v3 Design
*   **Target Document**: `EPIC_PARSER_V3_IMPLEMENTATION_PLAN.md`

---

## 1. Executive Summary: The Threat of a Future Parser Rewrite

The proposed Parser v3 design attempts to build a semantic static analysis pipeline on top of a purely syntactic AST traversal. While the introduction of local symbol tables and Control Flow Graphs (CFGs) is a significant improvement over regular-expression heuristic scanners, the current design contains several compiler-level structural gaps.

If implemented as designed, **EPIC will face another complete parser rewrite** when attempting to validate production codebases. The primary blocker is the lack of a temporal representation of state changes (e.g., mutable variables re-assignment) and type inference constraints, which are required for high-fidelity security analysis.

Below is a detailed breakdown of the architectural flaws, edge cases, and proposed mitigations.

---

## 2. Structural & Architectural Weaknesses

### A. Syntactic AST vs. Type Inference Engine
*   **The Defect**: The current design registers type declarations in `TypeRegistry` but lacks a recursive **Type Inference Engine** for local expressions.
*   **The Vector**: In Solana instructions, accounts are accessed via nested structures:
    ```rust
    let user_key = ctx.accounts.vault.owner;
    ```
    If `ctx` is registered as type `Context<Deposit>`, the parser must:
    1. Look up `Context<Deposit>` and identify its generic argument `Deposit`.
    2. Look up the `Deposit` struct definition in the type registry.
    3. Identify that `vault` is of type `Account<'info, VaultState>`.
    4. Resolve `VaultState` to find that the field `owner` is of type `Pubkey`.
    
    Without an expression-level type propagation walker, the symbol table will only register `ctx` as `Context` and fail to infer the types of nested accessors. The parser will be forced to fallback to `INCONCLUSIVE` for almost all nested access checks, or guess based on field names, violating the **Never Guess** design principle.

### B. Cyclic and Complex Type Aliases
*   **The Defect**: The alias tracker maps `local_name -> source_path` as a simple string mapping.
*   **The Vector**: Rust supports recursive and nested types (e.g., `let account_ref = &*other_ref;`). If the alias tracker is a flat string map, resolving complex borrows, de-references, and module-qualified paths (e.g., `self::state` vs `crate::state`) will fail.

---

## 3. CFG Correctness & Control Flow Risks

### A. The Silent Early Exit: The Try Operator (`?`)
*   **The Defect**: The CFG builder defines early returns via `return`, `?`, and `require!`. However, the structural syntax representation in `syn` maps `?` as a `syn::Expr::Try` wrapper around an expression, rather than a terminal statement block.
*   **The Vector**: If a developer writes:
    ```rust
    let config = ctx.accounts.config.load()?;
    ```
    The `?` operator is functionally equivalent to:
    ```rust
    match ctx.accounts.config.load() {
        Ok(val) => val,
        Err(err) => return Err(err.into()),
    }
    ```
    If the CFG parser does not decompose `syn::Expr::Try` nodes into conditional branch splits containing early-return edges, the engine will miss exit paths. This creates **false negatives**, where security checks occurring *after* a failing `?` call are assumed to be safe because the CFG failed to register the implicit error-handling exit branch.

### B. Block Expressions as R-Values
*   **The Defect**: Rust allows code blocks to evaluate as expressions:
    ```rust
    let owner = {
        let actual_owner = ctx.accounts.state.owner;
        actual_owner
    };
    ```
    **The Vector**: A flat statement sequence assumption inside the CFG node will fail because block expressions contain their own local variables and scopes. The parser will either crash or fail to register the nested assignments inside the block scope.

### C. Panics, Assertions, and Diverging Paths
*   **The Defect**: The CFG only models early returns returning a `Result`.
*   **The Vector**: Standard Solana programs use `panic!`, `assert!`, `unwrap()`, or `expect()` to terminate execution. These compile to diverging control flow paths (yielding `!` or terminating the transaction). If the CFG does not treat these macro calls as terminal exit blocks, it will assume code execution continues post-assertion, creating false paths.

---

## 4. Symbol Table & Pattern Matching Edge Cases

### A. Pattern Destructuring in Variable Bindings
*   **The Defect**: The `StatementKind::Let` structure expects a simple string name.
*   **The Vector**: Rust supports destructuring bindings:
    ```rust
    let Signer { key, is_signer } = ctx.accounts.admin;
    // or tuple destructuring:
    let (vault_info, bump) = derive_vault_pda();
    ```
    If the parser only extracts simple identifiers, it will fail to bind `key`, `is_signer`, `vault_info`, or `bump` in the symbol table. This will cause downstream rules checking signer constraints on `key` to evaluate as `INCONCLUSIVE`.

### B. Variable Shadowing in Local Blocks
*   **The Defect**: Shadowing variables is highly common in Rust.
*   **The Vector**:
    ```rust
    let admin = ctx.accounts.admin; // Type: AccountInfo
    if cond {
        let admin = ctx.accounts.new_admin; // Shadowed local
        // Checks executed on shadowed variable
    }
    // Original variable remains unmodified
    ```
    If the symbol table does not maintain parent-pointer scope resolution dynamically during traversal, checks applied to the shadowed variable will leak into the outer scope, creating false validation mappings.

---

## 5. Temporal Alias Tracking: The Mutable Re-assignment Defect

### A. The Need for Variable Versioning (SSA Form)
*   **The Defect**: The alias tracker maps `local_var -> source_path` statically.
*   **The Vector**: If a variable is mutable and re-assigned:
    ```rust
    let mut authority = ctx.accounts.user.key();
    if condition {
        authority = ctx.accounts.admin.key();
    }
    // Operation checked against authority
    ```
    A static symbol table alias map cannot resolve which key `authority` represents at the point of evaluation. Without **Static Single Assignment (SSA)** form (or variable versioning, e.g., `authority_0`, `authority_1`), the parser will evaluate checks using stale alias mappings, leading to critical false negatives.

---

## 6. Anchor Macro Handling Gaps

### A. Arbitrary Expressions Inside Attributes
*   **The Defect**: The hybrid model maps known Anchor macros to CFG constraints by extracting attribute expressions.
*   **The Vector**: Anchor constraints can contain arbitrary Rust calls, logical operators, or helpers:
    ```rust
    #[account(constraint = user.key() == target.key() && state.is_active())]
    ```
    Statically parsing this requires parsing the raw Rust expression *inside* the attribute string. Since `syn` parses attributes as raw tokens, the parser must execute an inner parser pass on the constraint strings to build expression trees. If omitted, EPIC will fail to understand constraint gates, flagging false security alerts on safely guarded paths.

---

## 7. Bridge & Serialization Bottlenecks

### A. JSON AST Bloat
*   **The Defect**: Exposing the entire parsed CFG and statement AST via JSON serialization to the TypeScript layer.
*   **The Vector**: For a medium-sized Solana program with 20 instructions, the generated CFG and AST expression tree JSON will span several megabytes. Serialization and deserialization in TypeScript will cause massive CI runtime bottlenecks.
*   **Mitigation**: **Do not serialize the AST**. The Rust binary must execute the security rules internally. The JSON output exported to the TS wrapper should only contain a flat list of vulnerability results and override states, keeping payloads minimal and executions sub-second.

---

## 8. Specific Future Rules Compatibility Analysis

| Rule | Parser v3 Requirement | Gap in Current Design | Impact |
| :--- | :--- | :--- | :--- |
| **`EPIC-SEC-001` (Owner)** | Type resolution of fields on custom types. | Lack of recursive type inference. | **Fail**: Can't resolve type fields. |
| **`EPIC-SEC-002` (Signer)** | CFG path validation of checks. | Lack of `syn::Expr::Try` (`?`) branch splits. | **Fail**: Misses early exits, false negatives. |
| **`EPIC-SEC-003` (Reinit)** | Extraction of initialization attributes. | Missing inner parser for string attributes. | **Fail**: Misses Anchor constraints. |
| **`EPIC-SEC-004` (Close)** | CFG variable mutation analysis. | Missing SSA tracking for mutable state. | **Fail**: Misses reassigned balance edits. |

---

## 9. Architectural Redesign Recommendations

To prevent a future rewrite, we must modify the Parser v3 design prior to implementation:

1.  **Introduce an Expression Type Inference Walker**:
    Add a compiler pass that maps variable references to their underlying types by recursively walking structural fields using the `TypeRegistry`.
2.  **Model implicit exits in `syn::Expr::Try`**:
    Ensure the CFG builder splits execution blocks on every occurrence of the `?` operator, generating an implicit early-return edge.
3.  **Implement Single-Assignment Versioning (SSA-lite)**:
    Track mutable variable re-assignments by suffixing variable versions (e.g., tracking `var` as `var_v1`, `var_v2` inside the symbol table on write updates).
4.  **Parse Constraint Strings as AST Nodes**:
    Run `syn::parse_str::<syn::Expr>` on the content of Anchor constraint strings (e.g., `constraint = ...`) to extract logical expression trees.
5.  **Execute Logic Internally in Rust**:
    Keep AST, CFG, and rule execution scopes inside the Rust `parser-v2` crate. Limit JSON serialization to outputting terminal vulnerability reports to the CLI and Action layers.
