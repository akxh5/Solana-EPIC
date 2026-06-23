# Hostile Validation Audit: GuardFact Core Model Implementation (Issue #5A)

This document provides a hostile static analysis validation audit of the newly implemented GuardFact Core Model and Anchor constraint parsing engine.

---

## 1. Executive Summary & Defect Log

### Critical Issues
*   **None.** There are no blocking compiler crashes or logical soundness defects in the core representation or translation engine.

### High Risk Issues
*   **Field Access Alias Mapping (Context Resolution)**:
    *   *Why it matters*: In the AST of instruction bodies, accounts are accessed via `ctx.accounts.vault`. However, declarative struct attributes bind guards to the structural field name `vault` (associated with the `MyAccounts` type registry). If the rule engine does not map accesses of the shape `ctx.accounts.field` back to the structural `SymbolId` representing `field`, a rule checking `ctx.accounts.vault` will fail to find its associated `Signer` or `Owner` fact, creating a **False Positive** (falsely reporting a missing check).
    *   *Real-world failure*: A rule searching for owner check of `vault` queries `guard_facts` for `SymbolId` of variable `vault#1`. But the code accesses it as `ctx.accounts.vault#1`. If the alias mapping fails to associate `ctx.accounts.vault` with the symbol of parameter `vault`, the validation is missed.
    *   *Required Fix*: Implement a path-sensitive field access resolver in the rules engine that maps `ctx.accounts.field` field accesses to the primary `SymbolId` of the accounts struct parameter `field`.

### Medium Risk Issues
*   **Wildcard Stringified Literals (Unknown Expressions)**:
    *   *Why it matters*: For highly complex nested expressions in constraints (such as array seeds or custom calculations containing method calls), `convert_syn_expr` falls back to a stringified `FactExpression::Literal`. While this avoids crashes, a downstream rule performing strict AST-level matching on `FactExpression` will fail to recognize algebraic equivalents (e.g. `8 + 64` vs `72` or `64 + 8`), leading to a **False Positive** if the string representation differs by whitespace or formatting.
    *   *Required Fix*: Implement a normalization step in `convert_syn_expr` to strip all whitespace and order binary operators deterministically before storing them as literal expressions.

### Low Risk Issues
*   **Keyword Replacement in String Literals**:
    *   *Why it matters*: Replacing standalone `"mut"` strings with `"writable"` is split-by-comma safe but could theoretically fail if a macro contains complex non-Rust DSL syntax where `mut` is used in a different context.
    *   *Required Fix*: Ensure that only macro attributes matching `derive(Accounts)` structs are processed by this attribute translator.

---

## 2. GuardFact & Invariant Neutrality Mapping

An audit of the implementation in [guards.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/cfg/guards.rs) confirms that **no Anchor semantics leak into the Security IR**.
*   `has_one = x` $\rightarrow$ correctly translated to `GuardFact::KeyRelation` comparing address values.
*   `mut` $\rightarrow$ correctly translated to `SolanaProperty::IsWritable` validation checks.
*   `signer` $\rightarrow$ correctly translated to `GuardFact::Signer` (explicit SVM-level constraint).
*   `close = x` $\rightarrow$ correctly translated to `GuardFact::Deallocated` (explicit SVM-level constraint).
*   `realloc = x` $\rightarrow$ correctly translated to `GuardFact::Resized` (explicit SVM-level constraint).

This ensures the IR remains completely clean and compatible with future non-Anchor frameworks (Shank, Codama, Pinocchio).

---

## 3. SSA Identity & Scoping Evaluation

Under the current topological CFG node evaluation pass:
1.  **Reassignments**: Correctly increment the version counter per variable name, ensuring that versioned targets `authority#1` and `authority#2` remain distinct.
2.  **Shadowing**: Structurally resolved by generating unique `SymbolId` entries when entering sub-blocks.
3.  **Dominance**: `GuardFactLocation` carries `DominanceInterval` (DFS entry/exit indices), allowing $O(1)$ dominance checks for rule queries.

---

## 4. Sign-off Recommendation

### **IS ISSUE #5A SAFE TO BUILD EPIC-SEC-001 AND EPIC-SEC-002 ON TOP OF?**

**YES.**

The core representation is solid, deterministic, and successfully translates complex macro attributes into normalized SVM invariants. Downstream rules for Signer Validation (`EPIC-SEC-002`) and Owner Validation (`EPIC-SEC-001`) can be written safely on top of this engine. 

Before writing the rules, the alias resolution mapping (High Risk Issue 1) must be implemented in the rules engine wrapper to correctly translate `ctx.accounts.account_name` references into their primary parameter symbols.
