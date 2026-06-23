# EPIC-SEC-001 Hostile Pre-Implementation Review

* **Role**: Principal Static Analysis Architect & Compiler Security Reviewer
* **Workspace File**: [epic_sec_001_pre_implementation_review.md](file:///Users/aksh/Documents/Solana%20EPIC/epic_sec_001_pre_implementation_review.md)

---

## 1. Executive Summary & Verdict

We have performed a hostile validation review of the [EPIC-SEC-001 implementation plan](file:///Users/aksh/Documents/Solana%20EPIC/epic_sec_001_implementation_plan.md). While the high-level architecture remains frozen, the **proposed implementation details contain major correctness defects** that will cause massive false negatives and rule bypasses in real Solana programs. 

### Verdict: NO (Do Not Merge Implementation Plan Without Fixes)
The current specification is **not build-ready**. If implemented as written, the rules engine will be trivial to bypass and will fail to detect real Solana vulnerabilities (such as the Cashio or Crema exploits) due to brittle write-site detection and string-based resolver gaps.

---

## 2. Critical Defects (Rule Bypass / Safety Violations)

### Defect C-01: Brittle Write-Site Detection (Critical False-Negative Risk)
* **Vulnerable Pattern**:
  The rule logic in `epic_sec_001.rs` detects writes using this check:
  ```rust
  ExpressionKind::Assign { left, .. }
  ExpressionKind::MethodCall { method: "borrow_mut" | "try_borrow_mut", .. }
  ```
* **Why it Fails**:
  In Solana programs, state writes rarely happen via direct assignment to the account variable itself (e.g. `vault = new_val`). Instead, they happen through subfields or indirect buffers:
  1. **Direct Field Modification**: `ctx.accounts.vault.amount += 100;` resolves to an assignment where `left` is `ctx.accounts.vault.amount`. The resolver will query the string `"ctx.accounts.vault.amount"`. If it doesn't strip the `.amount` field correctly during assignment resolution, it fails to find the account's owner check, or worse, misses that it was a write to `vault`.
  2. **Indirect Deserialization**:
     ```rust
     let mut data = account.try_borrow_mut_data()?; // (1) borrow
     let mut state = State::try_from_slice(&data)?;   // (2) deserialization
     state.amount = 100;                            // (3) write to local struct
     state.serialize(&mut *data)?;                 // (4) serialization
     ```
     At step (3), the write is to a local variable `state` (`SymbolId` of the local). The rules engine will see a write to `state` and check if `state` is a Solana account. It is not; it is a custom struct `State`. The engine misses the write!
     At step (4), the serialization writes to `data` (a local buffer reference), which is also not the account variable itself.
* **Required Fix**:
  The rule must trace mutability transitively:
  1. If `try_borrow_mut_data` or `borrow_mut` is called on an account symbol, any derived local references (like `data`) must inherit the **underlying write dependency** to the root account.
  2. Any serialization write (e.g., calling `serialize`, `exit`, or writing back to the slice) on a buffer derived from the account must be mapped as a write to the root account symbol.

### Defect C-02: String-Based Resolution in Resolver (High Bypass Risk)
* **Vulnerable Pattern**:
  `SymbolResolver::resolve` takes a `&str` (`expr_str`) as parameter:
  ```rust
  pub fn resolve(&self, expr_str: &str, current_ssa_state: &SSANodeState) -> Option<SymbolId>;
  ```
* **Why it Fails**:
  Rust AST parsing can produce duplicate string names in nested scopes (shadowing). If we resolve names using raw strings, we bypass the safety guarantees of SSA-lite versioning:
  1. If a variable is shadowed, `current_ssa_state.active_variables.get(expr_str)` returns the version representation (e.g. `"vault#2"`).
  2. If the user writes `vault.lamports.borrow_mut()`, the AST expression string representation could be stringified as `"vault.lamports"`.
  3. The resolver cleans it to `"vault"`. It then looks up `"vault"` in `alias_map` instead of checking the versioned `"vault#2"` matching the active statement scope. This leaks facts across shadowed bounds.
* **Required Fix**:
  The resolver must take an AST `ExpressionNode` or the specific `SSAVersionId` instead of a raw `&str` string representation. The resolution pipeline must be typed:
  `fn resolve_expr(&self, expr: &ExpressionNode, state: &SSANodeState) -> Option<SymbolId>;`

---

## 3. High-Risk Defects (Control-Flow / Dominance Gaps)

### Defect H-01: Same-Node Statement Ordering (`a <= b` is Incorrect)
* **Vulnerable Pattern**:
  `DominanceChecker::dominates` implements:
  ```rust
  if node_a == node_b {
      match (stmt_a, stmt_b) {
          (Some(a), Some(b)) => return a <= b,
          ...
      }
  }
  ```
* **Why it Fails**:
  1. **Strict Dominance Violation**: If the check and write occur in the *same* statement, e.g. `assert_owner(account)?; write_account(account);` (if they are parsed in a single statement block or nested subexpressions), `a <= b` evaluates to `true` even if they are in the same statement, but a statement cannot dominate itself if the write executes before the check in evaluation order.
  2. **Evaluation Order of Expression Blocks**: In Rust, block expressions inside statement initializers are evaluated sequentially. A check inside a right-hand side subexpression could precede the write on the left-hand side, but standard statement indexes are identical.
* **Required Fix**:
  If `node_a == node_b` and `stmt_a == stmt_b`, the checker must evaluate the AST execution order within the statement tree (subexpression evaluation order) to prove the check executes before the write.

### Defect H-02: Failure to Handle Loop-Carried Dependencies (False-Negative Risk)
* **Vulnerable Pattern**:
  A check dominates a write in terms of CFG path, but occurs inside a loop where a reassignment is performed.
* **Why it Fails**:
  ```rust
  for acc in accounts {
      // Check owner of acc
      require_keys_eq!(acc.owner, program_id);
      
      // Reassign to next element without checking
      let target = next_acc; 
      target.try_borrow_mut_data()?;
  }
  ```
  The dominator tree DFS interval calculation assumes static paths. It does not account for loop-carried dependencies where variables are reassigned across loop iterations.
* **Required Fix**:
  The `SymbolResolver` must invalidate alias mappings when variables cross loop back-edges, forcing a re-evaluation of the owner check at every loop iteration.

---

## 4. Medium-Risk Defects (Usability / Completeness)

### Defect M-01: `InterfaceAccount` Set Resolution is Opaque
* **Vulnerable Pattern**:
  `InterfaceAccount<'info, T>` maps expected owner to:
  `expected_owner: FactExpression::BinaryOp { op: "||", lhs: prog_a, rhs: prog_b }`
* **Why it Fails**:
  The checking logic in `epic_sec_001.rs` only tests for the existence of `GuardFact::Owner`. It does not verify that the expected owner matches the valid program list. If an attacker passes a fake account owned by `prog_a` (which is in the list) but the instruction expects a write to an account owned by `prog_b` (also in the list), the check passes but is logically vulnerable.
* **Required Fix**:
  The rules engine must evaluate the disjunction set. If the write targets a specific interface instance, the expected owner must match the exact interface provider program ID, not the entire list.

### Defect M-02: Missing Verification of the Fail-Closed Exit Path
* **Vulnerable Pattern**:
  If a procedural check is present (`FactConfidence::Asserted`), the plan states:
  "Verify that the failure branch path terminates execution."
* **Why it Fails**:
  Solana handlers often return errors using custom error structures or library wrappers (e.g. `return err!(MyError::InvalidOwner)` or custom macro `require!(...)`). If the CFG builder maps these custom aborts as normal nodes rather than terminal exit nodes, the dominance check will falsely flag safe code as unsafe.
* **Required Fix**:
  The CFG builder must register all program error returns (including `Result::Err`, `panic!`, `custom_error!`) as explicit terminal exit nodes in the CFG.

---

## 5. Performance Bottlenecks

### Bottleneck P-01: Substring Parsing inside Resolver Loop
* **Risk**:
  `clean_field_path` performs string splits and vector allocations on *every* statement resolve:
  ```rust
  let parts: Vec<&str> = raw_path.split('.').collect();
  ```
  This creates high GC/allocation pressure on large files (e.g. Drift DEX contains thousands of assignments).
* **Fix**:
  Avoid string splits. Match paths using tokens in the AST parser or store pre-parsed field path vectors directly in the `SymbolResolver`.

---

## 6. Required Fixes Before Implementation

1. **Typed Resolver Mappings**: Replace string keys with typed `SSAVersionId` and `SymbolId` inside the resolver map.
2. **Serialization Dependency Tracker**: Track when a write is performed on a buffer or local structure derived from an account, linking it back to the root account symbol.
3. **Subexpression Dominance Check**: Implement subexpression evaluation order validation when a check and write reside in the same statement node.
