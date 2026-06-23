# HISTORICAL EXPLOIT VALIDATION REPORT

This report evaluates EPIC's performance against reconstructed code representative of historical owner validation exploits: Cashio App, Crema Finance, and Wormhole.

## Vulnerability Replica Execution Results

We reconstructed both vulnerable and safe code structures for each exploit and ran `epic audit` to verify classification accuracy.

| Exploit Scenario | Reconstructed Code Type | Expected Classification | EPIC Classification | Status | Root Cause |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cashio App** | Vulnerable (`AccountInfo` write) | UNSAFE | **UNSAFE** | ✅ Pass | Detected mutable write to unchecked `collateral`. |
| **Cashio App** | Safe (Explicit `owner != ID` check) | SAFE | **UNSAFE** | ❌ Fail (FP) | **Imperative Check Ignored**: EPIC does not parse inline runtime owner comparisons. |
| **Crema Finance** | Vulnerable (`AccountInfo` swap write) | UNSAFE | **SAFE** | ❌ Fail (FN) | **Name Collision**: Duplicate struct name (`Swap`) in the folder resolved to the safe struct. |
| **Crema Finance** | Safe (Typed `Account` wrapper) | SAFE | **SAFE** | ✅ Pass | Typed `Account` wrapper correctly recognized when analyzed in isolation. |
| **Wormhole** | Vulnerable (Signature Set write) | UNSAFE | **UNSAFE** | ✅ Pass | Detected mutable write to unchecked `signature_set`. |
| **Wormhole** | Safe (Explicit `owner != ID` check) | SAFE | **UNSAFE** | ❌ Fail (FP) | **Imperative Check Ignored**: Failed to recognize explicit `signature_set.owner` check. |

---

## Detailed Vulnerability Case Studies

### 1. Cashio App Exploit ($52M, March 2022)
* **Vulnerability Reconstructed**: An instruction accepted an unchecked `collateral` account, mutably borrowed its data, and executed printing logic without confirming `collateral.owner == token_program::ID`.
* **EPIC Performance**:
  * **Vulnerable**: Correctly flagged a critical validation error on the write statement.
  * **Safe**: When protected by `if collateral.owner != &crate::ID { return Err(...); }`, EPIC failed to recognize this imperative check and generated a false positive finding.

### 2. Crema Finance Exploit ($8.7M, July 2022)
* **Vulnerability Reconstructed**: A pool swap instruction wrote price details to a mutable `tick_array` account typed as `AccountInfo` without checking that its owner matched the expected liquidity program ID.
* **EPIC Performance**:
  * **Vulnerable**: Incorrectly classified as SAFE (False Negative). Due to the file path directory scan loading both `crema_safe.rs` and `crema_vulnerable.rs`, the struct `Swap` collided in the type registry. The rule engine matched the safe `Swap` definition, bypassing the vulnerability.

### 3. Wormhole Exploit ($320M, Feb 2022)
* **Vulnerability Reconstructed**: Bypassed signature verification by passing a forged `signature_set` account. The program parsed signature data from it but failed to verify that the account was owned by the Wormhole signature verification program.
* **EPIC Performance**:
  * **Vulnerable**: Correctly flagged the unchecked mutable write.
  * **Safe**: Flagged as unsafe due to the lack of inline/dynamic check tracking.
