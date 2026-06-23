# Issue #5A: GuardFact Core Model Specification

This document details the architectural specification for the **GuardFact Core Model**. It establishes the contract between declarative/procedural security facts and the static analysis rules of the EPIC engine.

---

## 1. GuardFact Philosophy

### What is a GuardFact?
A `GuardFact` is a framework-neutral, semantic assertion about the safety contract of an instruction handler or account struct. It represents a concrete security guarantee that must hold true at a given point in execution. 

Unlike AST expressions or CFG nodes, which represent *how* code runs, a `GuardFact` represents *what* has been validated (e.g., "Account X has been verified as a transaction signer").

### Why is it superior to synthetic CFG nodes?
1.  **Semantic Preservation**: Synthesizing CFG nodes forces structural attributes (such as `#[account(init)]` or `seeds = [...]`) to be translated into fake procedural statements. This erases the semantic intent of the framework. A `GuardFact` preserves the exact security semantics (e.g., initialization boundaries, PDA derivation logic) directly as metadata.
2.  **Pristine Source Map**: Synthetic CFG nodes pollute the instruction's execution graph, introducing nodes that do not exist in the actual Rust code. This degrades diagnostic reporting, complicates debugging, and conflicts with SSA-lite versioning. GuardFacts keep the CFG 100% faithful to the actual compiled source code.
3.  **Cross-Compilation Uniformity**: CFGs represent procedural control-flow. Declarative traits, struct fields, and IDL configurations do not have control-flow graphs. GuardFacts unify procedural checks and declarative structs under a single semantic model.

### Why is it superior to framework-specific rule logic?
Without GuardFacts, every security rule (e.g., `EPIC-SEC-001 Owner Validation`) must implement specific logic to handle Anchor macros, Shank annotations, Codama profiles, and native Rust checks separately. This leads to code duplication, logic leakage, and high maintenance debt. 

With GuardFacts, the analysis is split into two clean stages:
*   **Producers**: Framework-specific frontends parse code/metadata and emit standard, canonical `GuardFacts`.
*   **Consumers**: Security rules query the list of `GuardFacts` in a framework-agnostic manner.

---

## 2. GuardFact Enum Design

Below is the design of the canonical `GuardFact` enum:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GuardFact {
    /// Enforces that an account is a signer.
    /// * **Fields**: `account_name: String`
    /// * **Purpose**: Protect against missing signer checks (EPIC-SEC-002).
    /// * **Producer**: Anchor `Signer<'info>` / `#[account(signer)]`, native `account.is_signer` checks.
    /// * **Consumer**: Signer validation rules.
    Signer(String),

    /// Enforces that an account owner matches a specific program ID or type.
    /// * **Fields**: `account_name: String`, `expected_owner: FactExpression`
    /// * **Purpose**: Protect against missing owner checks (EPIC-SEC-001).
    /// * **Producer**: Anchor `Account<'info, T>` (implicit owner check), custom constraints.
    /// * **Consumer**: Owner validation rules.
    Owner {
        account_name: String,
        expected_owner: FactExpression,
    },

    /// Enforces that a field on an account matches a local variable target.
    /// * **Fields**: `account_name: String`, `field_name: String`, `target_variable: String`
    /// * **Purpose**: Relationship checks (e.g. `vault.owner == authority`).
    /// * **Producer**: Anchor `#[account(has_one = ...)]`, explicit key comparison assertions.
    /// * **Consumer**: Authority validation and relation check rules.
    HasOne {
        account_name: String,
        field_name: String,
        target_variable: String,
    },

    /// Enforces that an account is closed and its rent is swept.
    /// * **Fields**: `account_name: String`, `destination: String`
    /// * **Purpose**: Rent sweep verification and close authority validation (EPIC-SEC-004).
    /// * **Producer**: Anchor `#[account(close = destination)]`, native manual close statements.
    /// * **Consumer**: Close authority rules.
    Close {
        account_name: String,
        destination: String,
    },

    /// Enforces that an account is derived from specific PDA seeds.
    /// * **Fields**: `account_name: String`, `seeds: Vec<FactExpression>`, `bump: Option<FactExpression>`
    /// * **Purpose**: PDA derivation checks.
    /// * **Producer**: Anchor `#[account(seeds = [...])]`, native `find_program_address` calls.
    /// * **Consumer**: PDA validation rules.
    PDA {
        account_name: String,
        seeds: Vec<FactExpression>,
        bump: Option<FactExpression>,
    },

    /// Enforces that a bump value has been validated.
    /// * **Fields**: `account_name: String`, `bump_value: FactExpression`
    /// * **Purpose**: Prevent arbitrary bump vulnerabilities.
    /// * **Producer**: Anchor `#[account(bump = ...)]`, native bump comparisons.
    /// * **Consumer**: PDA verification rules.
    BumpValidation {
        account_name: String,
        bump_value: FactExpression,
    },

    /// Enforces that an account is newly initialized.
    /// * **Fields**: `account_name: String`, `payer: String`, `space: Option<FactExpression>`
    /// * **Purpose**: Reinitialization check.
    /// * **Producer**: Anchor `#[account(init)]`, native CPI systems to System Program.
    /// * **Consumer**: Reinitialization detection rules (EPIC-SEC-003).
    Initialization {
        account_name: String,
        payer: String,
        space: Option<FactExpression>,
    },

    /// Enforces initialization only if the account does not yet exist.
    /// * **Fields**: `account_name: String`, `payer: String`
    /// * **Purpose**: Safe initialization verification.
    /// * **Producer**: Anchor `#[account(init_if_needed)]`.
    /// * **Consumer**: Reinitialization rules.
    InitIfNeeded {
        account_name: String,
        payer: String,
    },

    /// Enforces reallocating space for an account.
    /// * **Fields**: `account_name: String`, `space: FactExpression`, `payer: String`, `zero: bool`
    /// * **Purpose**: Realloc safety checks.
    /// * **Producer**: Anchor `#[account(realloc = ...)]`.
    /// * **Consumer**: Realloc overrun rules.
    Reallocation {
        account_name: String,
        space: FactExpression,
        payer: String,
        zero: bool,
    },

    /// Enforces structural constraint checks.
    /// * **Fields**: `expression: FactExpression`
    /// * **Purpose**: Capture user-defined constraints.
    /// * **Producer**: Anchor `#[account(constraint = ...)]`, procedural assertions.
    /// * **Consumer**: General constraint verification rules.
    Constraint(FactExpression),

    /// Enforces required Token-2022 extensions.
    /// * **Fields**: `account_name: String`, `extension_type: String`
    /// * **Purpose**: Validate extension state compliance.
    /// * **Producer**: Token-2022 helper macros / field checks.
    /// * **Consumer**: Token-2022 compatibility rules.
    Token2022Extension {
        account_name: String,
        extension_type: String,
    },
}
```

---

## 3. Fact Provenance

Provenance tracks the origin, confidence, and target compiler framework of every security fact.

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FactProvenance {
    /// Path to the source file where the fact was derived.
    pub source_file: String,
    /// 1-indexed line number in the source file.
    pub line_number: usize,
    /// 1-indexed column number.
    pub column_number: usize,
    /// Framework from which the fact was compiled (e.g. "Anchor", "Shank", "Native").
    pub framework: String,
    /// Level of confidence in this fact's verification.
    pub confidence_level: FactConfidence,
}
```

---

## 4. FactExpression System

To decouple expressions inside constraints (e.g. `vault.owner == authority.key()`) from rustc/syn AST internals, we define a framework-neutral semantic expression layer:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FactExpression {
    /// Scalar identifiers (e.g. `authority`, `vault`)
    Identifier(String),
    /// Direct literal values (e.g. `100`, `true`)
    Literal(String),
    /// Field accesses (e.g. `vault.owner`)
    FieldAccess {
        object: Box<FactExpression>,
        field: String,
    },
    /// Method/Function invocations (e.g. `authority.key()`)
    Call {
        function: String,
        arguments: Vec<FactExpression>,
    },
    /// Binary mathematical or logical comparison operations (e.g. `==`, `>`, `!=`)
    BinaryOp {
        op: String,
        lhs: Box<FactExpression>,
        rhs: Box<FactExpression>,
    },
    /// Represents an expression that is unresolved or too complex to evaluate.
    Unknown,
}
```

---

## 5. Dominance Metadata

To evaluate if a guard is valid at a specific point in time, each fact is tagged with location and dominance metadata:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GuardFactLocation {
    /// The CFG Node ID where the fact originated or was asserted.
    pub node_id: usize,
    /// The specific statement index inside the CFG node (None if struct-level).
    pub statement_index: Option<usize>,
    /// The operational dominance boundary of this fact.
    pub dominance_scope: DominanceScope,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DominanceScope {
    /// The fact is valid for the entire instruction scope (e.g. declarative macros).
    InstructionScope,
    /// The fact is valid only for statements dominated by its origin node in the CFG.
    SubGraphScope {
        dominated_nodes: Vec<usize>,
    },
    /// The fact is valid only locally within the block.
    BlockLocal,
}
```

---

## 6. Fact Confidence Model

The confidence model classifies how a fact was discovered:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FactConfidence {
    /// Verified procedurally via compile-time assertions or explicit compiler outputs.
    Verified,
    /// Derived/inferred statically from declarative types (e.g. `Signer<'info>`).
    Derived,
    /// Implicitly assumed by the runtime architecture (e.g., standard Anchor context setups).
    Implicit,
    /// Ambiguous derivation that cannot be fully verified.
    Inconclusive,
}
```

*   **Verified**: Explicit checks in code (e.g., `assert!(a.is_signer)`).
*   **Derived**: Inferred from structural types (e.g., `Signer<'info>` implies `GuardFact::Signer`).
*   **Implicit**: Implied by program execution context (e.g., fallback programs checks).
*   **Inconclusive**: Multiple conflicting checks or dynamic logic that cannot be statically resolved.

---

## 7. INCONCLUSIVE Design (Fail-Closed)

Ambiguity must never result in a default positive assumption. A fact transitions to `Inconclusive` when:
1.  **Unresolved Method Calls**: If an expression relies on a method call (e.g., `vault.is_safe()`) whose implementation is external or cannot be statically resolved.
2.  **Cross-Crate Lookups**: Structs defined in external crates without metadata indexing available in the `TypeRegistry`.
3.  **Dynamic Seed Builders**: PDA derivation seeds computed dynamically at runtime (e.g. `seeds = [&helper_func(x)]`).
4.  **Unsupported macros**: Complex macros that modify control flow or state outside standard compiler execution behaviors.

When a fact is `Inconclusive`, its confidence level is set to `FactConfidence::Inconclusive`. Rules must treat inconclusive confidence as a failure to establish the security guarantee, thus failing closed.

---

## 8. Future Framework Compatibility

This architecture accommodates various programming models without modifying the downstream rules:

*   **Anchor**: Generates `GuardFact::Signer` and `GuardFact::Owner` directly from declarative `derive(Accounts)` structs and attributes.
*   **Pinocchio**: Native procedural macros are scanned in the AST. A statement like `assert_keys_eq!(a, b)` is promoted to `GuardFact::HasOne`.
*   **Native Solana Rust**: Explicit statements (e.g. `if !info.is_signer { return Err(...) }`) are detected in the CFG and promoted to `GuardFact::Signer`.
*   **Shank / Codama**: Layout and metadata schemas are read directly from IDL/metadata artifacts. The translator emits `GuardFacts` without parsing any Rust code or constructing a CFG.
*   **Token-2022 Extensions**: Struct fields are mapped to `GuardFact::Token2022Extension` facts based on structural layouts.

---

## 9. Hostile Design Review

### Why this GuardFact architecture could fail

1.  **Ambiguity Risks (Aliases)**:
    If a variable version is aliased (`let x = y;`), a fact bound to `y#1` might not be mapped to `x#1` by a rule. If rules query facts by string identifier names alone, we will get false negatives.
    *   *Mitigation*: The promotion engine must resolve identifiers to their active SSA version names (`y#1`). Rules must check active aliases inside `InstructionAnalysisContext`.
2.  **False-Negative Risks (Dominance scope leakage)**:
    If a rule queries `ctx.guard_facts.contains(Signer("vault"))` without evaluating `dominance_scope`, it might assume `vault` is a verified signer for a statement that runs *before* the signer check occurs.
    *   *Mitigation*: Downstream rules must intersect the query location with the `dominance_scope` of the fact.
3.  **Performance Risks (Combinatorial Merge Blowup)**:
    On complex merge paths, merging many complex `FactExpression` structures might cause exponential growth in memory or CPU usage.
    *   *Mitigation*: Enforce a strict expression complexity boundary. Any expression deeper than 5 nested operators collapses into `FactExpression::Unknown`.
4.  **Future Maintenance Risks (Schema drift)**:
    If new Solana frameworks introduce semantic checks not covered by our enum variants, developers might create ad-hoc variants or misuse existing ones (e.g. stuffing rent checks into `Constraint`).
    *   *Mitigation*: Enforce strict code-review policies for the canonical `GuardFact` enum.

---

## 10. Most Important Question

### **"Can every future Solana framework emit GuardFacts without modifying security rules?"**

**YES.**

Because the canonical `GuardFact` enum represents framework-agnostic **security invariants** (Signer check, Owner check, relationship verification) rather than framework-specific syntax, it provides a stable semantic interface. 

When a new Solana framework is introduced:
1.  We write a dedicated frontend translator (Producer) for it.
2.  This translator maps the framework's semantic checks to the existing `GuardFact` variants.
3.  The downstream rules (Consumers) execute exactly as before, with zero modifications.
