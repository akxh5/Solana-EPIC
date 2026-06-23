# EPIC-SEC-002: Missing Signer Validation — Edge Case Assault Report

## 1. Overview
The compiler-grade static analysis engine was subjected to an edge case assault using `/Users/aksh/Documents/Solana EPIC/fixtures/edge_case_assault_sec002.rs`. This test evaluated the engine's ability to reason about variable shadowing, nested blocks, loop guards, match branching, alias chains, and dynamic helper calls.

---

## 2. Edge Case Results Matrix

| Scenario | Modeled Target | Code Construct | Status | Engine Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **Alias Chain** | `test_alias_chain` | `let alias = auth;` | **SAFE** | The engine traced the reference chain transitively back to the root symbol `admin_authority`, verifying dominance. |
| **Shadowing** | `test_shadowing` | `{ let _auth = other; }` | **SAFE** | Scoped SSA variable versions prevented shadowing variables from overriding the true validation fact on the root symbol. |
| **Nested Blocks** | `test_nested_block` | `{ if !auth.is_signer { ... } }` | **SAFE** | Flattening nested block statements in the CFG builder correctly split branches, allowing dominance to cover the mutation. |
| **Loop Validation** | `test_loop_validation` | `for _ in 0..10 { ... }` | **SAFE** | The validation check dominates the exit node branch and the merge node. |
| **Match Branching** | `test_match_branching` | `match check { true => { ... } false => { ... } }` | **UNSAFE / FLAGGED** | Detected that only one branch checked the signature; the second branch mutated state unchecked. |
| **Dynamic Helper** | `test_dynamic_helper` | `check_helper(&auth);` | **UNSAFE / FLAGGED** | The check occurs inside an un-inlined helper function body, which is treated conservatively as unchecked. |

---

## 3. Key Technical Improvements Made

### CFG Block Flattening
Nested blocks (`StatementKind::Block`) containing branching controls (such as `if` statements or `try` operator aborts) are recursively compiled by flattening their statements during Control Flow Graph (CFG) generation. This ensures that nested branch splits are correctly represented in the CFG predecessor/successor graph, and dominance is calculated accurately.

### Transitive Signer Verification in Alias Chains
`has_dominating_signer_check` was upgraded to recursively trace evaluated signer targets back to their root symbol using the WDG `parent_map` alias tracking before comparing them to the target authority-like symbol. This allows the engine to recognize validations performed on any reference alias as valid for the source account.
