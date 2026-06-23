# EPIC WDG Assignment Fix Report (Task 5)

## Problem Definition
Previously, the Write-Dependency Graph (WDG) only tracked initializations:
```rust
let target = vault;
```
but failed to track variable reassignments:
```rust
target = other_vault;
```
As a result:
- Mutable writes after reassignment were either attributed to the old account (e.g. `vault` instead of `other_vault`) or ignored completely.
- Simple reference reassignments were sometimes false-positive flagged as direct writes to the account.
- In multi-node control-flow graphs (e.g. loops or try-operator splits), CFG nodes were processed in random hash-map iteration order, causing parent mappings from predecessor blocks to be missing when analyzing successor blocks.

## Resolution Details
1. **Reassignment Tracking in WDG**:
   Updated the `check_statements_recursive` handler in [epic_sec_001.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/rules/epic_sec_001.rs) to match assignments (`ExpressionKind::Assign`). If an existing active variable is reassigned, its dependency mapping in `parent_map` is updated to point to the new initializer source.
2. **Pointer Assignment Filtering**:
   Implemented `skip_write_check` logic to identify pointer/alias assignments (e.g. `target = &mut other_vault`). These reassignments are skipped from write checks (preventing false positives) while still correctly updating the WDG mapping.
3. **Topological CFG Node Iteration**:
   Replaced random hash-map traversal of CFG nodes inside `OwnerValidationRule::check` with a DFS post-order topological sort. Predecessor statements are now guaranteed to be evaluated before successor statements, ensuring WDG parent mappings are correctly populated.

## Validation & Results
- **Command Run**: `cargo run -- audit ../../fixtures/edge_case_assault.rs`
- **Target Fixture**: `test_reassignment`
  ```rust
  pub fn test_reassignment(ctx: Context<TestAccounts>) -> Result<()> {
      let mut target = &mut ctx.accounts.vault;
      target = &mut ctx.accounts.other_vault;
      let mut data = target.try_borrow_mut_data()?;
      data[0] = 1;
      Ok(())
  }
  ```
- **Result**: Successfully tracked reassignment to `other_vault` and flagged the write on line 45 (while correctly skipping line 44 from false positives):
  ```json
  {
    "rule_id": "EPIC-SEC-001",
    "severity": "Critical",
    "message": "Mutable write to account 'other_vault' lacks program owner verification.",
    "location": {
      "file": "../../fixtures/edge_case_assault.rs",
      "line": 45,
      "column": 0,
      "node_id": 2,
      "statement_index": null
    },
    "confidence": "Asserted",
    "target_symbol": 2
  }
  ```
- All unit and integration tests under `tests/rules_tests.rs` (including `test_owner_validation_wdg_transitive` and `test_ssa_reassignment`) pass successfully.
