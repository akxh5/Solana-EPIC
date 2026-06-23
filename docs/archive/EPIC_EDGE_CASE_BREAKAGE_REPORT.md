# EDGE CASE ASSAULT BREAKAGE REPORT

This report evaluates EPIC's compilation and semantic rules engine under adversarial conditions, identifying concrete vulnerabilities, scoping bugs, and code check bypasses.

---

## Edge Case Matrix

| Edge Case Tested | Scenario | EPIC Verdict | Status | Defect Class / Root Cause |
| :--- | :--- | :--- | :--- | :--- |
| **1. Alias Resolution** | `let alias = vault;` | **UNSAFE** | ✅ Pass | WDG successfully tracked variable reference assignment. |
| **2. Shadowed Variables** | Re-binding variable inside scope | **SAFE** | ❌ Fail (FN) | **SSA Scoping Bug**: Variable shadowing doesn't pop outer state on exit. |
| **3. Nested Scopes** | Writes inside `{ let inner = ... }` | **SAFE** | ❌ Fail (FN) | **Block Check Defect**: Rule engine skips nested `StatementKind::Block` nodes. |
| **4. Reassignments** | `target = &mut other_vault;` | **SAFE** | ❌ Fail (FN) | **WDG Defect**: Reassignments via `Assign` expression bypass the WDG parent map. |
| **5. Remaining Accounts** | `ctx.remaining_accounts[0]` | **SAFE** | ❌ Fail (FN) | **Registry Bypass**: Remaining accounts are not declared in `Accounts` struct. |
| **6. Dynamic Owner Checks**| Imperative runtime checks | **UNSAFE** | ❌ Fail (FP) | **AST Limitation**: Evaluates only declarative attributes, not imperative code. |
| **7. PDA Derivation** | manual PDA validation | **UNSAFE** | ✅ Pass | Correctly flagged; PDA derivation is not an owner check. |
| **8. Explicit Return Paths** | return early in branch | **UNSAFE** | ✅ Pass | Correctly flagged; return branch did not dominate mutable write. |
| **9. Panic Paths** | panic conditional branch | **UNSAFE** | ✅ Pass | Correctly flagged; panic branch did not dominate mutable write. |
| **10. Try Operator Paths** | `?` error path branching | **UNSAFE** | ✅ Pass | Correctly modeled basic block splitting on `?` checkpoints. |
| **11. Match Expressions** | match-statement write | **SAFE** | ❌ Fail (FN) | **Syntax Skip**: Match statements are unresolved expressions and skipped. |
| **12. Loop Structures** | write inside loops | **SAFE** | ❌ Fail (FN) | **Syntax Skip**: For/while loops are unresolved expressions and skipped. |

---

## Detailed Critical Defect Deep Dives

### Defect 1: SSA Shadowing & Scope Leak (False Negative)
* **Reproduction Code**:
  ```rust
  let mut target = &mut ctx.accounts.vault;
  {
      let target = &ctx.accounts.authority; // safe signer
  }
  let mut data = target.try_borrow_mut_data()?; // vulnerable write
  ```
* **Root Cause**: The SSA-lite active variable state does not pop variables or restore shadowed states when exiting block scopes. On scope exit, the active mapping of `target` remains bound to `authority` (SymbolId 2, safe), bypassing the checker.

### Defect 2: Nested Block Node Bypass (False Negative)
* **Reproduction Code**:
  ```rust
  let mut target = &mut ctx.accounts.vault;
  {
      let inner = &mut ctx.accounts.vault;
      let mut data = inner.try_borrow_mut_data()?;
      data[0] = 1; // vulnerable write
  }
  ```
* **Root Cause**: `OwnerValidationRule::check` iterates sequentially over `node.statements` but does not recursively inspect statements wrapped in nested block structures (`StatementKind::Block`). All operations inside nested scopes are silently ignored.

### Defect 3: WDG Reassignment Defect (False Negative)
* **Reproduction Code**:
  ```rust
  let mut target = &mut ctx.accounts.vault;
  target = &mut ctx.accounts.other_vault; // reassignment via ExpressionKind::Assign
  let mut data = target.try_borrow_mut_data()?;
  ```
* **Root Cause**: The Write-Dependency Graph (WDG) only maps dependencies during `StatementKind::Let` execution. It does not update mappings when variables are modified via assignment expressions. As a result, the parent of `target` is not mapped, `trace_to_root` returns the local variable's symbol ID, and the scanner ignores the write because local variables are not registered as account parameters.

### Defect 4: Syntactic Skips on Matches and Loops (False Negative)
* **Reproduction Code**:
  ```rust
  for i in 0..10 {
      let mut data = vault.try_borrow_mut_data()?; // vulnerable write
  }
  ```
* **Root Cause**: Match expressions and Loop structures are not parsed into structured AST elements by the parser-v2 compiler layer; they default to `ExpressionKind::Unresolved` or `StatementKind::Expr` and are ignored, leaving loops and matches completely unchecked.
