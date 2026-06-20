use parser_v2::ast::{
    unpack_nested_generics, ExpressionKind, ExpressionNode, InconclusiveReason, InferenceResult,
    InferenceScope, TypeInferenceEngine,
};
use parser_v2::types::{FieldDef, StructDef, TypeDef, TypeRef, TypeRegistry};

#[test]
fn test_unpack_nested_generics() {
    assert_eq!(
        unpack_nested_generics("Account<'info, VaultState>"),
        "VaultState"
    );
    assert_eq!(
        unpack_nested_generics("Box<Account<'info, VaultState>>"),
        "VaultState"
    );
    assert_eq!(
        unpack_nested_generics("Option<Account<'info, VaultState>>"),
        "VaultState"
    );
    assert_eq!(
        unpack_nested_generics("AccountLoader<'info, VaultState>"),
        "VaultState"
    );
    assert_eq!(
        unpack_nested_generics("InterfaceAccount<'info, TokenAccount>"),
        "TokenAccount"
    );
}

#[test]
fn test_unresolved_identifiers_fail_closed() {
    let registry = TypeRegistry::new();
    let scope = InferenceScope::new();
    let engine = TypeInferenceEngine::new(&registry, &scope);

    let expr = ExpressionNode {
        kind: ExpressionKind::Identifier("untracked_variable".to_string()),
    };

    let result = engine.infer(&expr);
    assert_eq!(
        result,
        InferenceResult::Inconclusive(InconclusiveReason::UnresolvedIdentifier(
            "untracked_variable".to_string()
        ))
    );
}

#[test]
fn test_nested_field_access_inference() {
    let mut registry = TypeRegistry::new();

    // Register custom VaultState struct
    registry.insert(
        "VaultState".to_string(),
        TypeDef::Struct(StructDef {
            name: "VaultState".to_string(),
            is_account: true,
            fields: vec![FieldDef {
                name: "owner".to_string(),
                type_ref: TypeRef::Pubkey,
                attrs: vec![],
            }],
            attrs: vec![],
        }),
    );

    let mut scope = InferenceScope::new();
    // Bind "vault" as Account<'info, VaultState>
    scope.insert(
        "vault".to_string(),
        TypeRef::Custom("Account<'info, VaultState>".to_string()),
    );

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

    let result = engine.infer(&expr);
    assert_eq!(result, InferenceResult::Ok(TypeRef::Pubkey));
}

#[test]
fn test_try_operator_result_unpacking() {
    let registry = TypeRegistry::new();
    let mut scope = InferenceScope::new();

    // Bind variable resolving to a Result
    scope.insert(
        "res".to_string(),
        TypeRef::Result(
            Box::new(TypeRef::Pubkey),
            Box::new(TypeRef::Custom("ProgramError".to_string())),
        ),
    );

    let engine = TypeInferenceEngine::new(&registry, &scope);

    // Let's evaluate "res?"
    let expr = ExpressionNode {
        kind: ExpressionKind::Try(Box::new(ExpressionNode {
            kind: ExpressionKind::Identifier("res".to_string()),
        })),
    };

    let result = engine.infer(&expr);
    assert_eq!(result, InferenceResult::Ok(TypeRef::Pubkey));
}

#[test]
fn test_namespace_type_resolution() {
    let mut registry = TypeRegistry::new();

    // Register fully qualified type name
    registry.insert(
        "program::lib::VaultState".to_string(),
        TypeDef::Struct(StructDef {
            name: "VaultState".to_string(),
            is_account: true,
            fields: vec![FieldDef {
                name: "owner".to_string(),
                type_ref: TypeRef::Pubkey,
                attrs: vec![],
            }],
            attrs: vec![],
        }),
    );

    let mut scope = InferenceScope::new();
    // Bind "vault" as Account<'info, VaultState>
    scope.insert(
        "vault".to_string(),
        TypeRef::Custom("Account<'info, VaultState>".to_string()),
    );

    let engine = TypeInferenceEngine::new(&registry, &scope);

    let expr = ExpressionNode {
        kind: ExpressionKind::FieldAccess {
            object: Box::new(ExpressionNode {
                kind: ExpressionKind::Identifier("vault".to_string()),
            }),
            field: "owner".to_string(),
        },
    };

    let result = engine.infer(&expr);
    assert_eq!(result, InferenceResult::Ok(TypeRef::Pubkey));
}

#[test]
fn test_ambiguous_type_resolution() {
    let mut registry = TypeRegistry::new();

    // Insert two structs with the same local name
    let struct_val = TypeDef::Struct(StructDef {
        name: "VaultState".to_string(),
        is_account: true,
        fields: vec![],
        attrs: vec![],
    });

    registry.insert("program::lib1::VaultState".to_string(), struct_val.clone());
    registry.insert("program::lib2::VaultState".to_string(), struct_val);

    let mut scope = InferenceScope::new();
    scope.insert(
        "vault".to_string(),
        TypeRef::Custom("Account<'info, VaultState>".to_string()),
    );

    let engine = TypeInferenceEngine::new(&registry, &scope);

    let expr = ExpressionNode {
        kind: ExpressionKind::FieldAccess {
            object: Box::new(ExpressionNode {
                kind: ExpressionKind::Identifier("vault".to_string()),
            }),
            field: "owner".to_string(),
        },
    };

    let result = engine.infer(&expr);
    assert_eq!(
        result,
        InferenceResult::Inconclusive(InconclusiveReason::AmbiguousType("VaultState".to_string()))
    );
}
