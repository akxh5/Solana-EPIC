# Issue 1 Implementation Specification: Core AST Node Data Structures

This document defines the exact file layouts, module exports, and Rust structures required to implement **Issue 1**: *“Implement core AST node data structures for Function, Statement, and Expression.”*

---

## 1. Complete File Layout

The files impacted by this implementation are isolated to the `parser-v2` crate:

```
packages/parser-v2/
└── src/
    ├── lib.rs            (Modify: Expose ast module)
    └── ast/
        ├── mod.rs        (Create: Export nodes)
        └── nodes.rs      (Create: Core AST structures)
```

---

## 2. Rust AST Structures (`src/ast/nodes.rs`)

Write the following definitions to `packages/parser-v2/src/ast/nodes.rs`. These nodes use Serde traits to support JSON serialization and standard traits for equivalence testing in test suites.

```rust
use serde::{Deserialize, Serialize};
use crate::types::TypeRef;

/// Represents a single analyzed Rust function (e.g. an instruction handler).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FunctionNode {
    pub name: String,
    pub signature: Vec<ParameterNode>,
    pub body: Vec<StatementNode>,
}

/// Represents an input parameter of a function signature.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParameterNode {
    pub name: String,
    pub type_ref: TypeRef,
}

/// Represents a single code statement inside a function body.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StatementNode {
    pub kind: StatementKind,
    pub line_number: usize,
}

/// Defines the supported categories of statements.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StatementKind {
    /// Variable binding (e.g. `let mut auth = admin;`)
    Let {
        name: String,
        initializer: ExpressionNode,
        type_annotation: Option<TypeRef>,
        is_mutable: bool,
    },
    /// Expression without trailing semicolon
    Expr(ExpressionNode),
    /// Expression with trailing semicolon
    Semi(ExpressionNode),
    /// Marco calls (e.g. `require!`, `msg!`)
    MacroCall {
        name: String,
        raw_args: String,
    },
}

/// Represents an expression evaluating to a value.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExpressionNode {
    pub kind: ExpressionKind,
}

/// Defines the supported categories of expressions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExpressionKind {
    /// Scalar identifiers (e.g. `user`)
    Identifier(String),
    /// Direct literal values (e.g. `100`, `true`)
    Literal(String),
    /// Field accesses (e.g. `ctx.accounts`)
    FieldAccess {
        object: Box<ExpressionNode>,
        field: String,
    },
    /// Method call invocations (e.g. `token.borrow_mut()`)
    MethodCall {
        object: Box<ExpressionNode>,
        method: String,
        arguments: Vec<ExpressionNode>,
    },
    /// Logical or mathematical operations (e.g. `x == y`)
    BinaryOp {
        op: String,
        lhs: Box<ExpressionNode>,
        rhs: Box<ExpressionNode>,
    },
    /// Address-of borrow operations (e.g. `&mut user`)
    Reference {
        expression: Box<ExpressionNode>,
        is_mutable: bool,
    },
    /// De-referencing values (e.g. `*ptr`)
    Dereference(Box<ExpressionNode>),
    /// Implicit error return expression mapping (`?`)
    Try(Box<ExpressionNode>),
    /// Fallback for unsupported or complex expression constructs
    Unresolved,
}
```

---

## 3. Module Exports

### `packages/parser-v2/src/ast/mod.rs`
Create this file and add the following lines to expose the newly defined structures:
```rust
pub mod nodes;

pub use nodes::{
    FunctionNode, ParameterNode, StatementNode, StatementKind,
    ExpressionNode, ExpressionKind
};
```

### `packages/parser-v2/src/lib.rs`
Append these lines to the bottom of `packages/parser-v2/src/lib.rs` to expose the module to external TypeScript packages:
```rust
pub mod ast;

pub use ast::{
    FunctionNode, ParameterNode, StatementNode, StatementKind,
    ExpressionNode, ExpressionKind
};
```

---

## 4. Architectural Integrations

### Support for Future CFG Generation
*   The `StatementKind` separates binding operations (`Let`) and call boundaries (`MacroCall`, `Semi`, `Expr`).
*   The `ExpressionKind::Try` maps early return blocks statically. During CFG traversal, parsing an expression containing `Try` enables the compiler to automatically branch into failure/success edge targets.

### Support for SSA-lite Versioning
*   The `StatementKind::Let` carries the `name` and `is_mutable` tag.
*   When executing data-flow updates, encountering a `Let` with `is_mutable: true` alerts the versioner to register version indexes inside the scope's `SymbolTable`.

---

## 5. Potential Mistakes & Mitigations

1.  **Direct Struct Recursion**:
    *   *Mistake*: Attempting to declare `ExpressionKind::FieldAccess` with a flat `ExpressionNode` value rather than `Box<ExpressionNode>` will trigger a compiler error on infinite type sizes.
    *   *Mitigation*: Ensure all recursive variants (`FieldAccess`, `MethodCall`, `BinaryOp`, `Reference`, `Dereference`, `Try`) utilize `Box` storage.
2.  **Missing Serde Traits**:
    *   *Mistake*: Forgetting `Serialize` or `Deserialize` on any struct inside `nodes.rs` will fail cargo builds when hooked to `main.rs` formats.
    *   *Mitigation*: Apply `#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]` systematically across all structures.

---

## 6. Pre-Merge Verification Tests

Write a validation test inside `packages/parser-v2/tests/ast_tests.rs` to verify instantiation and equivalence correctness:

```rust
use parser_v2::ast::*;
use parser_v2::types::TypeRef;

#[test]
fn test_ast_node_structural_equivalence() {
    let param = ParameterNode {
        name: "ctx".to_string(),
        type_ref: TypeRef::Custom("Context".to_string()),
    };

    let initializer = ExpressionNode {
        kind: ExpressionKind::FieldAccess {
            object: Box::new(ExpressionNode {
                kind: ExpressionKind::Identifier("ctx".to_string()),
            }),
            field: "accounts".to_string(),
        },
    };

    let stmt = StatementNode {
        kind: StatementKind::Let {
            name: "auth".to_string(),
            initializer,
            type_annotation: None,
            is_mutable: false,
        },
        line_number: 12,
    };

    let func = FunctionNode {
        name: "update_state".to_string(),
        signature: vec![param],
        body: vec![stmt],
    };

    assert_eq!(func.name, "update_state");
    assert_eq!(func.signature.len(), 1);
    assert_eq!(func.body.len(), 1);
}
```
