# Architectural Specification: Anchor Constraint & Attribute Analysis Engine (Issue #5)

## 1. Executive Summary & Core Paradigm
Declarative constraints in Solana frameworks (e.g., `#[account(signer)]` in Anchor, or Shank metadata) represent structural security properties of instructions, while instruction handlers represent procedural logic. Mutating the Control Flow Graph (CFG) to inject synthetic assertion nodes (like `assert!(vault.is_signer)`) to represent macro checks forces the analysis engine to lower high-level declarative logic into low-level statement patterns. This pollutes the CFG, compromises source locations, and couples attribute parsing to the CFG Builder.

**The Core Paradigm of this Design:**
We introduce **Immutable GuardFacts**. The parser analyzes declarative structs and types (e.g., `derive(Accounts)` structs) and emits a structured, immutable list of facts associated with the instruction execution context. Downstream security rules query this structured fact-list directly (e.g., `ctx.has_fact(GuardFact::Signer("vault"))`) rather than searching the CFG for synthetic assertions.

Additionally, procedural checks found in code (like `assert_keys_eq!(a, b)`) can be promoted to `GuardFacts` during AST traversal, normalizing both declarative macro constraints and procedural explicit validations into the same queryable semantic layer.

---

## 2. GuardFacts Data Structures (`ast/guards.rs`)
We define `GuardFact` as a strongly typed enum representing first-class security facts:

```rust
use serde::{Deserialize, Serialize};
use crate::types::TypeRef;
use crate::ast::ExpressionNode;

/// Represents structured security metadata derived from declarations or explicit checks.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GuardFact {
    /// The account name must be a transaction signer.
    Signer(String),
    /// The account name must be mutable (writable).
    Mut(String),
    /// The account owner must match the specified program target type.
    Owner {
        account: String,
        expected_owner: TypeRef,
    },
    /// The account's designated relation field must match the target variable.
    HasOne {
        account: String,
        relation_field: String,
        target_variable: String,
    },
    /// Custom constraint expression assertion.
    Constraint {
        account: String,
        expression: ExpressionNode,
    },
    /// The account rent-collector/recipient upon closure.
    Close {
        account: String,
        destination: String,
    },
    /// The account is initialized in this transaction.
    Initialized {
        account: String,
        payer: String,
        space: Option<ExpressionNode>,
    },
    /// The account is derived from specific seeds.
    SeedDerived {
        account: String,
        seeds: Vec<ExpressionNode>,
        bump: Option<ExpressionNode>,
    },
}

/// The analysis context for a single instruction handler, combining GuardFacts with CFG and SSA info.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstructionAnalysisContext {
    pub name: String,
    pub guard_facts: Vec<GuardFact>,
    pub cfg: crate::cfg::ControlFlowGraph,
}
```

---

## 3. Analysis Integration Flow

1.  **Declaration Parsing**:
    The parser processes instruction parameter declarations and `derive(Accounts)` struct fields.
    *   Explicit `#[account(...)]` attributes are parsed into `GuardFacts`.
    *   Implicit type-based guarantees are automatically generated (e.g. `Account<'info, T>` generates both `GuardFact::Owner` and `GuardFact::Initialized`).
2.  **CFG Processing**:
    The CFG Builder maps only *actual* user code statements, keeping line numbers and SSA version tracking perfectly clean.
3.  **Procedural Promotion**:
    The AST/CFG traversal engine scans statements for explicit assertions (e.g. `require_keys_eq!`, `solana_program::program_pack::Pack`). When a deterministic check is found, it is **promoted** into the `guard_facts` list.
4.  **Rule Execution**:
    Rules (e.g., `EPIC-SEC-001`) consume `InstructionAnalysisContext` to perform queries:
    ```rust
    fn check_signer_validation(ctx: &InstructionAnalysisContext, account_name: &str) -> bool {
        ctx.guard_facts.iter().any(|fact| match fact {
            GuardFact::Signer(name) => name == account_name,
            _ => false,
        })
    }
    ```

---

## 4. Support and Boundaries

### Supported in v1 (Deterministic Constraints)
*   **Signer/Mut attributes**: Directly converted to `GuardFact::Signer` and `GuardFact::Mut`.
*   **HasOne constraints**: Parsed and resolved to target parameters via namespace lookup.
*   **Implicit Type Guards**: Automatic owner checking for `Account`, `AccountLoader`, and `InterfaceAccount`.
*   **Seeds & Bump parsing**: Extracting seed array expressions and bump values.

### INCONCLUSIVE Boundary Conditions (Fail-Closed)
*   **Indeterminate Seeds**: Seeds derived from dynamic external CPI results or unresolvable global variables.
*   **Method-based constraints with unresolved types**: Custom constraints calling methods whose signatures cannot be resolved in the `TypeRegistry`.

---

## 5. Threat Model & Analysis Capabilities

| Security Rule | GuardFact Integration | Query Strategy |
| :--- | :--- | :--- |
| **EPIC-SEC-001 Owner Validation** | `GuardFact::Owner` | Query if the target account has an active `Owner` fact matching the expected program structure before any deserialization call. |
| **EPIC-SEC-002 Signer Validation** | `GuardFact::Signer` | Query if the target account has an active `Signer` fact before mutable data updates. |
| **EPIC-SEC-003 Reinitialization** | `GuardFact::Initialized` | Verify that the target account is either not initialized again, or the init flow has a matching payer constraint and rent check. |
| **EPIC-SEC-004 Close Authority** | `GuardFact::Close` | Confirm the destination collector parameter matches the expected administrative auth. |

---

## 6. Hostile Design Review: "Why This Design Could Fail"

### 1. The Temporal Ordering Erasure (Signer Check Location)
*   **Failure Scenario**: In Anchor, constraints are executed *before* the handler. However, in Pinocchio/native programs, procedural assertions are in the handler. If a procedural signer check is at the *end* of the function body but we promote it to `GuardFact::Signer` globally, the rule might falsely report that the signer was checked, even though a critical operation was executed *before* the check!
*   **Mitigation**: Promoted `GuardFacts` must preserve the **CFG node ID and statement index** where they were checked. The query engine must check that the guard dominates the statement containing the critical operation in the CFG.

### 2. Multi-framework Schema Drift
*   **Failure Scenario**: If Codama, Shank, and Anchor use different names for constraints, a rule looking for `GuardFact::Signer` might miss validations if the translation layer maps Codama attributes incorrectly.
*   **Mitigation**: Implement strict translation test suites for each supported compiler backend to verify fact schema normalization parity.

---

## 7. Historical Validation Plan
1.  **Parity Tests**: Select 10 Anchor projects and 10 Shank/native projects.
2.  **Manual Fact Mapping**: Hand-code the expected `GuardFacts` for each program context.
3.  **Assertion Engine Validation**: Run the constraint parser over the source files, and assert 100% match against the manually mapped facts list.
