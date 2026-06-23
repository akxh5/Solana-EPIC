# FALSE POSITIVE BENCHMARK REPORT

This report evaluates EPIC's noise levels and false positive rates when executing `epic audit` against production-grade Solana repositories.

## Benchmark Configuration
* **Audited Repositories**: drift-v2, marginfi, kamino (klend), squads-v4
* **Total Lines of Code Scanned**: ~16,000 LOC
* **Detector Rule**: EPIC-SEC-001 (Owner Validation Rule)

## Summary of Findings

| Repository | Total findings | True Positive (Vulnerability) | Legitimate Warning | False Positive | Inconclusive |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **drift-v2** | 31 | 0 | 0 | 31 | 0 |
| **marginfi** | 0 | 0 | 0 | 0 | 0 |
| **kamino** | 0 | 0 | 0 | 0 | 0 |
| **squads-v4** | 0 | 0 | 0 | 0 | 0 |

**Overall False Positive Rate (FPR)**:
$$\text{FPR} = \frac{\text{False Positives}}{\text{Total Findings}} = \frac{31}{31} = 100\%$$

## Detailed False Positive Analysis (drift-v2)

All 31 findings generated against `drift-v2` were identified as **False Positives** caused by a compiler limitation in type resolution:

### The Boxed Account Bug
In complex Solana programs like Drift, accounts are frequently boxed (wrapped in `Box<Account<'info, T>>` or `Box<AccountLoader<'info, T>>`) to prevent stack frame overflow during execution.
* **Vulnerable Code Pattern as seen by EPIC**:
  ```rust
  pub amm_constituent_mapping: Box<Account<'info, AmmConstituentMapping>>,
  ```
* **EPIC's Parsing Behavior**:
  The Rust type parser in [workspace.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/workspace.rs#L160-L188) extracts the outermost identifier name of a path. For `Box<Account<'info, T>>`, this extracts `"Box"` as the custom type.
* **Impact**:
  Because `"Box"` does not match `"Account"` or `"AccountLoader"` in the implicit check extraction layer inside [guards.rs](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2/src/cfg/guards.rs#L330-L334), EPIC assumes no implicit owner constraints exist for the variable. When the variable is mutated, EPIC flags it as a critical unchecked write, generating 31 false positives on safe, boxed accounts.

## Strategic Mitigation
To make EPIC production-ready, the generic unpacker must be updated to unpack `Box<T>` wrappers recursively and evaluate the inner generic arguments.
