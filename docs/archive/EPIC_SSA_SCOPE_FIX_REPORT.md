# EPIC SSA Scope Fix Report (Task 4)

## Problem Definition
Prior to this fix, shadowed variables inside a block leaked out to the outer scope upon block exit. 
For example:
```rust
let mut target = vault;
{
    let target = authority;
}
// After the block, target remained bound to authority instead of vault
let mut data = target.try_borrow_mut_data()?;
```
This behavior allowed attackers to bypass the ownership validation checker since the checker resolved `target` to `authority` (which was not flagged as a vulnerable write on `vault`), creating critical false negatives.

## Resolution Details
1. **SSA Scope popping**:
   Ensured that `cfg/ssa.rs` correctly pushes and pops nested scopes. When a block is entered, we track the `before_block_versions`. When the block exits, we restore any shadowed variables that were declared (`inner_declared` via `Let` statements) within the block to their pre-block state.
2. **Checker State Restoration**:
   Updated `check_statements_recursive` inside [epic_sec_001.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/rules/epic_sec_001.rs) to:
   - Identify variables declared within the block via `Let` statements (`block_declared`).
   - Save the pre-block states of `active_variables` and parent mappings (`parent_map`) for these variables.
   - Restore the outer versions and remove block-only variables from both `active_variables` and `parent_map` upon block exit.

## Validation & Results
- **Command Run**: `cargo run -- audit ../../fixtures/edge_case_assault.rs`
- **Target Fixture**: `test_shadowing`
  ```rust
  pub fn test_shadowing(ctx: Context<TestAccounts>) -> Result<()> {
      let mut target = &mut ctx.accounts.vault;
      {
          let target = &ctx.accounts.authority;
          // Inner target shadows the outer vault
      }
      let mut data = target.try_borrow_mut_data()?;
      data[0] = 1;
      Ok(())
  }
  ```
- **Result**: Successfully resolved `target` back to `vault` after the block, generating a critical finding for `vault` on line 25:
  ```json
  {
    "rule_id": "EPIC-SEC-001",
    "severity": "Critical",
    "message": "Mutable write to account 'vault' lacks program owner verification.",
    "location": {
      "file": "../../fixtures/edge_case_assault.rs",
      "line": 25,
      "column": 0,
      "node_id": 2,
      "statement_index": null
    },
    "confidence": "Asserted",
    "target_symbol": 1
  }
  ```
- All unit and integration tests under `tests/ssa_tests.rs` (including `test_ssa_shadowing`) pass successfully.
