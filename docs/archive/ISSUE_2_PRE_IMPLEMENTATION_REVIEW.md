# Issue 2 Correctness Review: Type Inference Walker

*   **Reviewer**: Senior Compiler Architect, Solana Protocol Security Lead
*   **Focus**: Semantic correctness and structural safety of Type Inference
*   **Target Document**: `ISSUE_2_IMPLEMENTATION_SPEC.md`

---

## 1. Type Representation: `TypeRef` Pollution vs. `InferenceResult`

### The Issue
The implementation specification proposes representing type resolution failures as synthesized custom type strings (e.g., `TypeRef::Custom("UnresolvedField".to_string())`).

### The Risk
1.  **Type Domain Pollution**: Mixing unresolved compiler states inside the core type schema (`TypeRef`) forces downstream rules to perform string matching checks on `.to_string() == "UnresolvedField"`.
2.  **Name Collisions**: If a developer declares a structure named `UnresolvedField` in their Rust code, the compiler will confuse this valid user structure with a type inference failure, creating false positives.

### The Correction
Do not pollute the type model. Define a dedicated `InferenceResult` enum that explicitly separates resolved types from inconclusive states:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InconclusiveReason {
    UnresolvedIdentifier(String),
    UnresolvedField { base_type: String, field: String },
    UnresolvedMethod { base_type: String, method: String },
    UnsupportedConstruct,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InferenceResult {
    Ok(TypeRef),
    Inconclusive(InconclusiveReason),
}
```

---

## 2. Anchor Wrapper Extraction Vulnerabilities

### The Issue
The proposed generic extraction algorithm uses simple string slicing on commas and angle brackets:
```rust
// Fragile string slicing
if let Some(start) = raw_type.find(',') { ... }
```

### The Risk
Solana programs wrap state variables in multiple recursive layers. The proposed algorithm will fail on:
1.  `Box<Account<'info, VaultState>>` (returns `Account<'info` instead of `VaultState`).
2.  `Option<Account<'info, VaultState>>` (returns `Account<'info` or fails).
3.  `InterfaceAccount<'info, TokenAccount>` (fails to match the hardcoded `"Account"` or `"AccountLoader"` string check).

### The Correction
Implement a recursive generic unpacking walker inside `inference.rs` that strips wrapper structures until it reaches the inner user-defined state type:

```rust
fn unpack_nested_generics(raw_type: &str) -> String {
    let mut current = raw_type.trim().to_string();
    loop {
        // Strip common wrapper prefixes
        if current.starts_with("Box<") && current.ends_with('>') {
            current = current[4..current.len() - 1].trim().to_string();
        } else if current.starts_with("Option<") && current.ends_with('>') {
            current = current[7..current.len() - 1].trim().to_string();
        } else if (current.starts_with("Account<") || 
                   current.starts_with("AccountLoader<") || 
                   current.starts_with("InterfaceAccount<")) && current.ends_with('>') {
            // Find the comma separating the lifetime ('info) and the actual type
            if let Some(comma_idx) = current.find(',') {
                current = current[comma_idx + 1..current.len() - 1].trim().to_string();
            } else {
                break;
            }
        } else {
            break;
        }
    }
    current
}
```

---

## 3. Unresolved Identifiers: Synthesizing vs. Inconclusive

### The Issue
The specification states that if an identifier is not found in the local scope, the walker synthesizes a type reference: `TypeRef::Custom(name.clone())`.

### The Risk
This silently hides scope resolution failures. If an identifier (e.g., a constant or custom import) cannot be resolved, synthesizing it as a valid custom type will lead downstream security engines to assume the variable is a valid state account, skipping ownership checks and creating critical **false negatives**.

### The Correction
Unresolved variables must immediately yield `InferenceResult::Inconclusive(InconclusiveReason::UnresolvedIdentifier)`. The engine must fail closed.

---

## 4. Future Compatibility with CFG (Issue 3) and SSA-lite (Issue 4)

### CFG Integration
When walking branches in the CFG, variables are declared or shadowed inside nested paths. The `InferenceScope` parent-pointer structure must align with CFG block scopes. The `TypeInferenceEngine` must accept a target CFG block ID parameter to look up active variables matching that specific block path context.

### SSA-lite Integration
Under SSA-lite, variable keys are versioned (e.g., `authority` is checked as `authority_v1` or `authority_v2`). The `InferenceScope` lookups must resolve versioned identifiers, ensuring that type queries during security analysis match the active version index at that step of the control flow.
