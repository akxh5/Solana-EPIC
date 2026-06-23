# EPIC Phase 1 Security Engine Redesign

This document outlines a revised, high-fidelity implementation plan for the **EPIC Phase 1 Security Engine**. It addresses the limitations of standard security linters (e.g., Anchor Sentinel) by prioritizing semantic accuracy, explicit handling of structural uncertainty, and a highly constrained, solo-founder-friendly development scope.

---

## 1. Design Principles

To ensure EPIC remains a high-trust platform for core Solana protocol teams, all security scanning modules must adhere to these four non-negotiable principles:

1.  **Never Guess**: If the engine cannot deterministically trace a data variable or account validation check, it must not make assumptions. False negatives mask real threats; false positives destroy developer trust.
2.  **Prefer INCONCLUSIVE Over False Confidence**: When code structures exceed the parsing capability of the static analyzer, return a third state: `INCONCLUSIVE`. Never default to assuming a path is `SAFE` simply because an exploit pattern was not detected.
3.  **Strictly Semantic (No Name-Based Heuristics)**: The engine must never rely on string matching (e.g., searching for variables named `admin` or `owner`). A check is defined by its mathematical and structural data-flow constraints, not its labels.
4.  **No Mock Exploits (Real-World Benchmark Gate)**: A rule cannot be marked stable or packaged into production releases until it successfully classifies at least one real-world, historically documented Solana exploit from production git history.

---

## 2. Explicit CFG Scope

The Control Flow Graph (CFG) engine maps source code execution branches to construct sequential paths of evaluation logic. For the Phase 1 release, the CFG engine's capabilities are strictly bounded:

### Supported (Deterministically Evaluated)
*   **Sequential Instruction Blocks**: Standard linear statement evaluation within a single instruction handler function.
*   **Simple Binary Branches (`if` / `else`)**: Conditional execution where both paths terminate or rejoin within the function scope.
*   **Early Returns (`return`, `?`, `require!`)**: Logical termination points that immediately exit the current instruction with an error.
*   **Basic Variable Re-binding**: Tracking alias declarations (e.g., `let user = &ctx.accounts.user;`) within the function body.

### Unsupported (Triggers `INCONCLUSIVE`)
*   **Loops (`for`, `while`, `loop`)**: Complex iteration blocks where loop boundary states carry over mutable modifications.
*   **Complex Pattern Matching (`match`)**: Destructuring assignments containing guard clauses or nested structural patterns.
*   **Dynamic Trait Dispatch**: Calls to methods implemented via traits where the compiler resolves the concrete struct dynamically at runtime.
*   **Workspace Crates & Cross-Crate Method Resolution**: Calls made to helper functions located in sibling packages within the Cargo workspace.

### Deferred (Future Roadmap)
*   **Generics & Lifetime Parameter Overloads**: Complex type-bound resolutions where structure definitions are parameter-dependent.
*   **Asynchronous Call Chains**: Resolving code blocks involving async futures or multi-threaded runtime loops.

---

## 3. INCONCLUSIVE Architecture

To prevent the engine from emitting false-positive noise or missing silent issues in complex code blocks, we introduce the `INCONCLUSIVE` finding state.

```
                    Security Engine Analysis
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
        SAFE                 UNSAFE             INCONCLUSIVE
   (Verified path)      (Definite vulnerability)  (Unresolved paths/
                                                  unsupported syntax)
```

### When `INCONCLUSIVE` is Emitted
The parser yields `INCONCLUSIVE` when:
*   A function contains unsupported Rust constructs (e.g., complex loops, trait dispatch).
*   The call graph references a method outside the parser's interprocedural depth limit (see Section 4).
*   A variable's type cannot be resolved in the symbol table due to missing imports or macro obscurity.

### SARIF Schema Mapping
In the SARIF output, `INCONCLUSIVE` findings are mapped under the `warning` level but contain a customized property object identifying the cause:

```json
{
  "ruleId": "EPIC-SEC-001",
  "level": "warning",
  "message": {
    "text": "INCONCLUSIVE: Ownership check validation path was obscured by an unresolved trait method call (line 54)."
  },
  "properties": {
    "status": "INCONCLUSIVE",
    "reason": "UnresolvedTraitDispatch"
  }
}
```

### GitHub Action Execution Behavior
*   By default, the GitHub Action prints `INCONCLUSIVE` findings inside PR code scanning reviews as warning messages but **does not break the build**.
*   This ensures the developer is alerted to review the section manually, without blocking clean merging runs.

### `epic.toml` Config Options
Teams can adjust engine behavior regarding unresolved blocks using the `security` settings:

```toml
[security]
inconclusive_action = "warn" # Options: "fail" (break build on inconclusive), "warn" (post alert only), "ignore"
```

---

## 4. Interprocedural Resolution Scope

Tracking validations across separate helper function scopes is highly resource-intensive and prone to execution timeouts. EPIC limits interprocedural analysis to a highly conservative envelope:

*   **Maximum Call Depth**: **2 Levels**. The engine resolves helper calls to a maximum depth of two steps (e.g., `Instruction -> HelperA -> HelperB`). Any deeper call defaults to `INCONCLUSIVE`.
*   **Same-File Support**: **Fully Supported**. Helper methods defined inside the same Rust source file are resolved and evaluated.
*   **Same-Crate Support**: **Restricted**. Resolves calls referencing local helper functions imported via path-based declarations (e.g., `use crate::utils::*`), provided they reside inside the same package subdirectory.
*   **Workspace & External Dependency Support**: **Unsupported**. Calls targeting external libraries or sibling packages inside a cargo workspace immediately flag that call pathway as `INCONCLUSIVE`.

---

## 5. Macro Strategy

Solana programs rely heavily on macros (especially Anchor's code generation macros) to format accounts and evaluate constraints. 

### Selected Strategy: Hybrid AST Parser
EPIC implements a **Hybrid AST Parser**:
*   Running a full expansion (e.g., `cargo expand`) is rejected because it introduces significant compilation overhead, requiring cargo dependency building which destroys the "compile-free" speed constraint.
*   Instead, EPIC parses the raw AST but integrates a **Macro Signature Resolver**. When the parser encounters known framework-specific macros, it maps them directly to equivalent CFG constraint logic.

### How Specific Anchor Macros are Evaluated:

*   `require!`: Mapped directly to an early-return error branch:
    ```rust
    // AST Input
    require!(user.key() == target.key(), ErrorCode::InvalidUser);
    
    // CFG Semantic Mapping
    if !(user.key() == target.key()) { return Err(ErrorCode::InvalidUser); }
    ```
*   `constraint = <expr>`: Extracted from the `#[derive(Accounts)]` struct definition and injected as a virtual assertion check at the entry point of the instruction.
*   `has_one = <field>`: Injected as an assertion verification equating the account field key directly to the matching target account key:
    ```rust
    // Mapped as:
    assert!(account.field == target.key());
    ```
*   `close = <target>`: Interpreted as a terminal close state modifying account layout sizes to 0 and transferring all remaining lamports to the destination.
*   `seeds = [...]`: Parsed to verify that the derived PDA path matches the expected seeds array, ensuring correct PDA validation constraints.

---

## 6. Rule Prioritization

To maximize validation quality with a solo-founder engineering limit, rules are organized into release phases:

| Priority | Rule ID | Feature / Name | Complexity | Ecosystem Value | Release Target |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **1** | `EPIC-SEC-002` | **Missing Signer** | Low-Medium | Critical | **Phase 1A** |
| **2** | `EPIC-SEC-001` | **Ownership Check** | Medium | Critical | **Phase 1A** |
| **3** | `EPIC-SEC-003` | **Reinitialization** | High | High | **Phase 1B** |
| **4** | `EPIC-SEC-004` | **Close Authority** | High | Medium | **Phase 1C** |

*   **Phase 1A (Launch Target)**: Focuses on Signer and Owner checks. These two checks represent over 70% of historical hack volumes from missing constraints.
*   **Phase 1B**: Adds Reinitialization checks and the hybrid macro parser.
*   **Phase 1C**: Adds Close Authority checks and expanded workspace reporting.

---

## 7. Historical Validation Standard

Before any rule is merged into production, it must pass verification against real-world smart contract codebases.

### 1. Ownership Verification Validation Case (`EPIC-SEC-001`)
*   **Historical Case**: Cashio Dollar Exploit
*   **Vulnerable Commit**: `59e66db` (cashio-core repository)
*   **Patched Commit**: `a53e41c`
*   **Expected Vulnerable Finding**: `EPIC-SEC-001: CRITICAL` on `collateral_mint` read in `deposit` instruction.
*   **Expected Patched Finding**: `SAFE` (verified owner is matching the expected Token Program ID).

### 2. Missing Signer Validation Case (`EPIC-SEC-002`)
*   **Historical Case**: Crema Finance Liquidity Deposit Exploit
*   **Vulnerable Commit**: `d85fb62`
*   **Patched Commit**: `1f46d99`
*   **Expected Vulnerable Finding**: `EPIC-SEC-002: CRITICAL` on `tick_array` modify authority.
*   **Expected Patched Finding**: `SAFE` (validation block now verifies `is_signer` on the tick manager).

---

## 8. Revised Roadmap

Optimized for a single software engineer working on a focused codebase:

### Phase 1A: Core Pipeline & Vital Guards (Weeks 1 - 6)
*   **Weeks 1 - 2**: Implement the simplified single-function CFG parser and type symbol registry mapping.
*   **Weeks 3 - 4**: Build the `EPIC-SEC-002` (Signer) and `EPIC-SEC-001` (Owner) AST validation rules.
*   **Weeks 5 - 6**: Establish the historical validation test harness and verify against Cashio and Crema commits.

### Phase 1B: State & Macro Support (Weeks 7 - 10)
*   **Weeks 7 - 8**: Integrate the `INCONCLUSIVE` finding state and build the hybrid macro parsing resolvers.
*   **Weeks 9 - 10**: Implement `EPIC-SEC-003` (Reinitialization) checks and validate against native initialization structures.

### Phase 1C: Close Checks & SARIF Integration (Weeks 11 - 14)
*   **Weeks 11 - 12**: Develop `EPIC-SEC-004` (Close Authority) validations.
*   **Weeks 13 - 14**: Format outputs to SARIF specs and package the GitHub Action runner integration.

---

## 9. Final Recommendation

If EPIC wants to defeat Anchor Sentinel, it must **never emulate Sentinel's design**. 

Sentinel relies on generic string search heuristics that trigger massive false positive counts on custom patterns, leading developers to permanently mute them in their pipeline configurations.

### Phase 1 Recommendation: The High-Fidelity Core

EPIC Phase 1 should ship with **exactly two rules: Signer Validation and Owner Validation**.

These rules must be supported by the **INCONCLUSIVE fallback state**. If the engine encounters complex patterns it cannot resolve, it reports them as `INCONCLUSIVE` rather than guessing. This establishes EPIC as an engineering tool of absolute determinism, laying a solid foundation for code safety verification across the Solana ecosystem.
