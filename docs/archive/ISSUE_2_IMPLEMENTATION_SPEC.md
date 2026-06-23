# Issue 2 Implementation Specification: Type Inference Walker

This document defines the technical design, type resolution algorithms, and implementation details for **Issue 2**: *“Implement TypeInferenceWalker for AST expressions.”*

---

## 1. Module Layout

The Type Inference Walker will reside within the `ast` directory:

```
packages/parser-v2/
└── src/
    └── ast/
        ├── mod.rs        (Modify: Expose inference)
        └── inference.rs  (Create: Type resolution engine)
```

---

## 2. Data Structures (`src/ast/inference.rs`)

Write the following definitions to `packages/parser-v2/src/ast/inference.rs`. These define the resolution engine and its local scoping parameters:

```rust
use std::collections::HashMap;
use crate::types::{TypeRegistry, TypeRef, TypeDef};
use crate::ast::nodes::{ExpressionNode, ExpressionKind};

/// Scoped variable bindings used during the inference pass.
#[derive(Debug, Clone, Default)]
pub struct InferenceScope {
    pub parent: Option<Box<InferenceScope>>,
    pub bindings: HashMap<String, TypeRef>,
}

impl InferenceScope {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn child(parent: InferenceScope) -> Self {
        Self {
            parent: Some(Box::new(parent)),
            bindings: HashMap::new(),
        }
    }

    pub fn insert(&mut self, name: String, type_ref: TypeRef) {
        self.bindings.insert(name, type_ref);
    }

    pub fn get(&self, name: &str) -> Option<TypeRef> {
        if let Some(type_ref) = self.bindings.get(name) {
            return Some(type_ref.clone());
        }
        if let Some(parent) = &self.parent {
            return parent.get(name);
        }
        None
    }
}

/// The type inference engine executing over parsed AST nodes.
pub struct TypeInferenceEngine<'a> {
    pub registry: &'a TypeRegistry,
    pub scope: &'a InferenceScope,
}

impl<'a> TypeInferenceEngine<'a> {
    pub fn new(registry: &'a TypeRegistry, scope: &'a InferenceScope) -> Self {
        Self { registry, scope }
    }
}
```

---

## 3. Type Resolution Algorithm

The `TypeInferenceEngine` resolves expression types using the following recursive algorithm:

```rust
impl<'a> TypeInferenceEngine<'a> {
    pub fn infer(&self, expr: &ExpressionNode) -> TypeRef {
        match &expr.kind {
            ExpressionKind::Identifier(name) => {
                if let Some(type_ref) = self.scope.get(name) {
                    type_ref
                } else {
                    // Fallback to custom type identifier if not in scope
                    TypeRef::Custom(name.clone())
                }
            }
            ExpressionKind::Literal(val) => {
                if val == "true" || val == "false" {
                    TypeRef::Primitive("bool".to_string())
                } else if val.chars().all(|c| c.is_ascii_digit()) {
                    TypeRef::Primitive("u64".to_string()) // Default numeric inference
                } else {
                    TypeRef::Custom("Literal".to_string())
                }
            }
            ExpressionKind::FieldAccess { object, field } => {
                self.resolve_field_access(object, field)
            }
            ExpressionKind::MethodCall { object, method, .. } => {
                self.resolve_method_call(object, method)
            }
            ExpressionKind::BinaryOp { op, .. } => {
                if op == "==" || op == "!=" || op == "<" || op == ">" {
                    TypeRef::Primitive("bool".to_string())
                } else {
                    TypeRef::Custom("BinaryOpResult".to_string())
                }
            }
            ExpressionKind::Reference { expression, .. } => {
                self.infer(expression)
            }
            ExpressionKind::Dereference(expression) => {
                self.infer(expression)
            }
            ExpressionKind::Try(expression) => {
                // Try operator unpacks Result<T, E> -> T
                match self.infer(expression) {
                    TypeRef::Result(ok_type, _) => *ok_type,
                    other => other,
                }
            }
            ExpressionKind::Unresolved => TypeRef::Custom("Unresolved".to_string()),
        }
    }
}
```

---

## 4. Nested Field Access Resolution

Nested field resolution tracks the nested dot access paths (e.g. `ctx.accounts.vault.owner`):

```rust
impl<'a> TypeInferenceEngine<'a> {
    fn resolve_field_access(&self, object: &ExpressionNode, field: &str) -> TypeRef {
        let base_type = self.infer(object);
        self.resolve_field_of_type(&base_type, field)
    }

    fn resolve_field_of_type(&self, ty: &TypeRef, field: &str) -> TypeRef {
        match ty {
            TypeRef::Custom(struct_name) => {
                // 1. Direct registry lookup
                if let Some(TypeDef::Struct(struct_def)) = self.registry.get(struct_name) {
                    for f in &struct_def.fields {
                        if f.name == field {
                            return f.type_ref.clone();
                        }
                    }
                }
                
                // 2. Evaluate Anchor wrapper types (e.g. Account<'info, StateState>)
                // If the type is structured like "Account<'info, T>", extract the inner type
                if struct_name.starts_with("Account") || struct_name.starts_with("AccountLoader") {
                    if let Some(inner_type) = extract_generic_type(struct_name) {
                        return self.resolve_field_of_type(&TypeRef::Custom(inner_type), field);
                    }
                }

                TypeRef::Custom("UnresolvedField".to_string())
            }
            _ => TypeRef::Custom("UnresolvedField".to_string()),
        }
    }

    fn resolve_method_call(&self, object: &ExpressionNode, method: &str) -> TypeRef {
        // Special case Anchor/Solana helper method interfaces
        match method {
            "key" | "key_ref" => TypeRef::Pubkey,
            "load" => {
                // Loader method unpacks AccountLoader<'info, T> -> Result<T, Error>
                // We wrap it in a dummy Result type containing the resolved target struct
                let base = self.infer(object);
                if let TypeRef::Custom(struct_name) = base {
                    if struct_name.starts_with("AccountLoader") {
                        if let Some(inner) = extract_generic_type(&struct_name) {
                            return TypeRef::Result(
                                Box::new(TypeRef::Custom(inner)),
                                Box::new(TypeRef::Custom("ProgramError".to_string()))
                            );
                        }
                    }
                }
                TypeRef::Custom("UnresolvedMethod".to_string())
            }
            _ => TypeRef::Custom("UnresolvedMethod".to_string()),
        }
    }
}

/// Extracts "VaultState" from "Account<'info, VaultState>" or similar generics.
fn extract_generic_type(raw_type: &str) -> Option<String> {
    if let Some(start) = raw_type.find(',') {
        let generic_part = raw_type[start + 1..].trim();
        if let Some(end) = generic_part.find('>') {
            return Some(generic_part[..end].trim().to_string());
        }
    }
    None
}
```

---

## 5. Alias Tracking Requirements

*   When variable bindings occur (e.g. `let vault = ctx.accounts.vault;`), the parser maps the local alias in the symbol scope:
    *   Registers `vault` pointing to the exact type of `ctx.accounts.vault`.
*   Alias lookup resolving walks the `InferenceScope` parent pointers to trace shadowing accurately.

---

## 6. Failure Modes Producing `INCONCLUSIVE`

The engine resolves types to a specific classification placeholder on failure, ensuring that the rules engine knows that it cannot confirm safety:
1.  **`UnresolvedField`**: Triggered when a struct field name cannot be matched inside structural registry maps.
2.  **`UnresolvedMethod`**: Triggered when a method call is evaluated that doesn't have an explicit signature mapper.
3.  **`Unresolved`**: Expression nodes of type `ExpressionKind::Unresolved` resolve directly to `TypeRef::Custom("Unresolved")`.

Any rule running over these placeholder types will fail to confirm verification, yielding `INCONCLUSIVE`.

---

## 7. Pre-Merge Verification Tests

Write verification tests inside `packages/parser-v2/tests/inference_tests.rs`:

```rust
use parser_v2::ast::nodes::*;
use parser_v2::ast::inference::*;
use parser_v2::types::{TypeRegistry, TypeRef, TypeDef, StructDef, FieldDef};

#[test]
fn test_field_access_inference() {
    let mut registry = TypeRegistry::new();
    
    // Register custom VaultState struct
    registry.insert(
        "VaultState".to_string(),
        TypeDef::Struct(StructDef {
            name: "VaultState".to_string(),
            is_account: true,
            fields: vec![
                FieldDef {
                    name: "owner".to_string(),
                    type_ref: TypeRef::Pubkey,
                    attrs: vec![],
                }
            ],
            attrs: vec![],
        })
    );

    let mut scope = InferenceScope::new();
    // Bind "vault" as Account<'info, VaultState>
    scope.insert("vault".to_string(), TypeRef::Custom("Account<'info, VaultState>".to_string()));

    let engine = TypeInferenceEngine::new(&registry, &scope);

    // Let's check "vault.owner"
    let expr = ExpressionNode {
        kind: ExpressionKind::FieldAccess {
            object: Box::new(ExpressionNode {
                kind: ExpressionKind::Identifier("vault".to_string()),
            }),
            field: "owner".to_string(),
        },
    };

    let resolved_type = engine.infer(&expr);
    assert_eq!(resolved_type, TypeRef::Pubkey);
}
```

---

## 8. Acceptance Criteria

1.  Recursive field accesses on Anchor wrappers (e.g. `Account<'info, T>`) must resolve fields matching `T` in the `TypeRegistry`.
2.  Methods like `.key()` must resolve directly to `TypeRef::Pubkey`.
3.  Nested scope bindings must support parent variable lookups.
