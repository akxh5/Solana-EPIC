# EPIC Imperative Check Recognition Fix Report (Task 2)

## Problem Definition
EPIC initially only checked declarative owner validations mapped in the Accounts struct macro annotations (e.g. `#[account(owner = ...)]`). It failed to recognize imperative ownership checks inside instruction handler bodies like:
```rust
if account.owner != ID {
    return Err(...)
}
```
This resulted in false positives (unsafe flags) on otherwise perfectly safe code bases (e.g., historical exploit patches and safe code variants).

## Resolution Details
1. **CFG Edge Condition Tracking**:
   Created `extract_imperative_checks` inside [guards.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/cfg/guards.rs) to traverse and identify conditional branches checking `.owner`.
2. **Strict Dominance & Fallthrough Verification**:
   Implemented reachability analysis via `is_terminating_branch` to ensure the early-termination branch (e.g., return or panic) actually exits. The ownership guard is only asserted on the path that dominates subsequent writes (e.g. the else / merge node).
3. **Common Macros Support**:
   Added support to extract and parse conditions checked inside sequential macros such as `require!`, `assert!`, `assert_eq!`, `require_eq!`, and `require_keys_eq!`.
4. **General program ID/Pubkey recognition**:
   Updated `is_valid_expected_owner` inside [epic_sec_001.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/rules/epic_sec_001.rs) to properly allow custom expected owners like `crate::ID`, `ID`, `super::ID`, or direct address strings.

## Validation & Results
- Verified Cashio Safe and Wormhole Safe fixtures successfully pass verification:
  - `epic audit fixtures/historical_exploits/cashio_safe.rs` -> **SAFE** (0 findings)
  - `epic audit fixtures/historical_exploits/wormhole_safe.rs` -> **SAFE** (0 findings)
- Verified vulnerable counterparts still correctly raise security flags:
  - `cashio_vulnerable.rs` -> **CRITICAL (EPIC-SEC-001)**
  - `wormhole_vulnerable.rs` -> **CRITICAL (EPIC-SEC-001)**
