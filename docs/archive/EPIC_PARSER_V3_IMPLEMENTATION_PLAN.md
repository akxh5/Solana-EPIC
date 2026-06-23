# EPIC Parser v3: Semantic Security Foundation Plan

This document defines the architectural design and implementation plan for **EPIC Parser v3**. The goal of this release is to refactor the Rust-native AST parsing crate (`parser-v2`) to capture function bodies, track local type scopes, and build basic Control Flow Graphs (CFGs). 

This is the smallest possible parser refactor that unlocks future semantic verification (Missing Signer, Ownership Checks, Reinitialization, and Close Authority rules) without requiring another parser rewrite.

---

## 1. Function Body & Expression Parsing

Parser v2 currently visits global struct declarations and ignores instruction logic. Parser v3 refactors the AST traversal to evaluate block expressions and statements using `syn::visit::Visit`.

```
               Rust Source Code (.rs)
                         │
                         ▼
                   syn::File AST
                         │
                         ▼
              FileVisitor (AST Walk)
        ┌────────────────────────────────┐
        │ - visit_item_struct (Layouts)  │
        │ - visit_item_fn (Function Body)│◄── Refactor Target
        └────────────────────────────────┘
                         │
                         ▼
             AST Statement/Expr Walk
        ┌────────────────────────────────┐
        │ - parse_stmt (Let, Expr, Semi) │
        │ - parse_expr (Access, Call, Op)│
        └────────────────────────────────┘
```

### Statement Extraction (`syn::Stmt`)
The parser maps Rust statements to an internal `StatementNode` enum:
1.  **Variable Bindings (`syn::Local`)**: Extracts the identifier, the initializer expression, and any explicit type annotations.
2.  **Expression Statements (`syn::Stmt::Expr`)**: Parses expressions that evaluate to a value (e.g., block returns).
3.  **Semicolon Statements (`syn::Stmt::Semi`)**: Parses terminal expressions (e.g., standard logic statements or validation helpers).
4.  **Macros (`syn::Stmt::Macro`)**: Identifies framework macros (`require!`, `err!`) to preserve validation boundaries.

### Expression Extraction (`syn::Expr`)
The expression walker recursively processes target subtrees:
*   **Field Access (`syn::ExprField`)**: Resolves structural dot-notation paths (e.g., `ctx.accounts.user.key`).
*   **Method Call (`syn::ExprMethodCall`)**: Resolves method invocations (e.g., `data.borrow_mut()`).
*   **Binary Operations (`syn::ExprBinary`)**: Resolves logical checks (e.g., `owner == program_id`).
*   **Unary Reference/Dereference (`syn::ExprUnary`)**: Tracks borrowing state modifications.

---

## 2. Local Symbol Resolution

To track validation states across aliases without relying on string patterns, the engine implements block-level scope symbol mapping.

### Scope Awareness & Shadows
*   The `SymbolTable` maintains a parent pointer reference, forming a scoped tree hierarchy.
*   Resolving an identifier walks up the scope parent chain to find the nearest declaration, supporting shadowing within inner scopes (e.g., nested `if let` variables).

### Variable Bindings & Alias Tracking
When the parser encounters a binding statement:
1.  If the expression maps directly to another symbol (e.g., `let auth = &ctx.accounts.authority;`), create an alias entry linking the local name `auth` to the base path `ctx.accounts.authority`.
2.  Any subsequent lookup of `auth` resolves to the base type, ensuring that security audits on `auth` evaluate constraints on the underlying account.

---

## 3. Minimal Control Flow Graph (CFG) Engine

The CFG represents the program's execution pathways. The v3 engine supports a simplified, single-function graph mapping.

```
                         [ Entry Node ]
                               │
                               ▼
                        [ Let Bindings ]
                               │
                               ▼
                       [ Branch Guard ]
                         /          \
                       /              \
            Condition True         Condition False
                 /                      \
                ▼                        ▼
       [ Early Return ]            [ State Mutation ]
               │                         │
               ▼                         ▼
         [ Exit Node 1 ]           [ Exit Node 2 ]
```

### CFG Execution Nodes
*   **Sequential Blocks**: Group consecutive statements that execute together without branching (e.g., alias lists, initialization checks).
*   **Conditional Branches (`if` / `else`)**: Splits the execution pathway into two edges based on a conditional expression.
*   **Early Returns (`return`, `?`, `require!`)**: Generates an edge directed to a terminal exit node, marking the current path as terminated with an exit state.
*   **`require!` Macro Semantics**: Treated as a virtual branch node that exits early if the condition is false.

---

## 4. Internal Data Structures (Rust Specification)

The following Rust structures define the core AST and CFG entities implemented in `packages/parser-v2/src/ast.rs`:

```rust
use std::collections::HashMap;
use crate::types::TypeRef;

// === AST Structs ===

#[derive(Debug, Clone)]
pub struct FunctionNode {
    pub name: String,
    pub signature: Vec<FieldDef>,
    pub cfg: ControlFlowGraph,
}

#[derive(Debug, Clone)]
pub struct FieldDef {
    pub name: String,
    pub type_ref: TypeRef,
}

#[derive(Debug, Clone)]
pub enum StatementKind {
    Let {
        name: String,
        initializer: ExpressionNode,
        type_annotation: Option<TypeRef>,
    },
    Expr(ExpressionNode),
    Semi(ExpressionNode),
    MacroCall {
        macro_name: String,
        args: String,
    },
}

#[derive(Debug, Clone)]
pub struct StatementNode {
    pub kind: StatementKind,
    pub line_number: usize,
}

#[derive(Debug, Clone)]
pub enum ExpressionKind {
    Identifier(String),
    Literal(String),
    FieldAccess {
        object: Box<ExpressionNode>,
        field: String,
    },
    MethodCall {
        object: Box<ExpressionNode>,
        method: String,
        args: Vec<ExpressionNode>,
    },
    BinaryOp {
        op: String,
        lhs: Box<ExpressionNode>,
        rhs: Box<ExpressionNode>,
    },
    Reference(Box<ExpressionNode>),
    Dereference(Box<ExpressionNode>),
    Unresolved,
}

#[derive(Debug, Clone)]
pub struct ExpressionNode {
    pub kind: ExpressionKind,
}

// === Scope & Symbol Table ===

#[derive(Debug, Clone, Default)]
pub struct SymbolTable {
    pub bindings: HashMap<String, TypeRef>,
    pub aliases: HashMap<String, String>, // local_var -> source_path
}

// === CFG Graph ===

#[derive(Debug, Clone)]
pub struct CFGNode {
    pub id: usize,
    pub statements: Vec<StatementNode>,
    pub symbols: SymbolTable,
}

#[derive(Debug, Clone)]
pub struct CFGEdge {
    pub from: usize,
    pub to: usize,
    pub condition: Option<ExpressionNode>,
    pub is_early_return: bool,
}

#[derive(Debug, Clone, Default)]
pub struct ControlFlowGraph {
    pub nodes: HashMap<usize, CFGNode>,
    pub edges: Vec<CFGEdge>,
    pub entry_node: usize,
    pub exit_nodes: Vec<usize>,
}
```

---

## 5. Output Model (JSON Serialization)

To keep TypeScript CLI bindings clean, the parser serializes the compiled workspace including instruction CFGs to standard JSON, exposing it under `WorkspaceReport`:

```json
{
  "instructions": [
    {
      "name": "update_state",
      "args": [
        { "name": "ctx", "type_ref": "Context" }
      ],
      "cfg": {
        "nodes": {
          "0": {
            "id": 0,
            "statements": [
              {
                "kind": {
                  "Let": {
                    "name": "auth",
                    "initializer": { "kind": { "FieldAccess": { "object": { "kind": { "Identifier": "ctx" } }, "field": "accounts" } } }
                  }
                },
                "line_number": 12
              }
            ]
          }
        },
        "edges": []
      }
    }
  ]
}
```

---

## 6. Refactor Scope

To implement Parser v3, modifications are isolated to the `parser-v2` crate to avoid side effects on the diff engine:

```
packages/parser-v2/
├── Cargo.toml
└── src/
    ├── lib.rs            (Export AST classes) [Modified]
    ├── types.rs          (Maintain types definitions) [Unchanged]
    ├── workspace.rs      (Integrate visit_item_fn loops) [Modified]
    ├── ast.rs            (New Module: AST nodes definitions) [New]
    └── cfg.rs            (New Module: CFG graph compiler) [New]
```

### Impact Metrics

| Module | Change Type | Estimated LOC | Risk Profile | Mitigation |
| :--- | :---: | :---: | :---: | :--- |
| `src/ast.rs` | **New** | ~250 LOC | Low | Isolated node definitions only. |
| `src/cfg.rs` | **New** | ~400 LOC | High | Bounded to single-level branches; loops default to `Unresolved`. |
| `src/workspace.rs` | **Modified** | ~150 LOC | Medium | Extends existing visitor loops without breaking struct maps. |
| `src/lib.rs` | **Modified** | ~20 LOC | Low | Simple module export declarations. |

---

## 7. Success Criteria & Extensibility Proof

Upon completion of Parser v3, the engine must support the following rule integrations without another core parser refactor:

1.  **Missing Signer (`EPIC-SEC-002`) Integration Proof**:
    *   *Analysis Path*: Search CFG nodes for instructions with a state modification. Scan parent condition edges. Verify that the check variables resolve to a type `Signer` or have a mapping to an `is_signer` expression in the `SymbolTable`.
2.  **Ownership Check (`EPIC-SEC-001`) Integration Proof**:
    *   *Analysis Path*: Locate write statements. Verify that the matching account's type is `Account<'info, T>` or that a CFG path edge evaluates `owner == program_id` before the write operation.
3.  **Reinitialization Check (`EPIC-SEC-003`) Integration Proof**:
    *   *Analysis Path*: Parse struct macros matching `#[account(init, ...)]` or trace the CFG to check if writing is guarded by an initialized variable.
4.  **Close Authority (`EPIC-SEC-004`) Integration Proof**:
    *   *Analysis Path*: Locate lamport transfer references inside statements. Track if a key comparison exists on the close authorization path inside the CFG.
