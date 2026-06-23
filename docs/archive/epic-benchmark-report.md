# Solana EPIC: Historical Upgrade Benchmark Report

This public benchmark report validates the reliability and precision of **EPIC (Engineering Platform for Intelligent Contracts)** against 15 real-world historical upgrades from 5 leading Solana DeFi and infrastructure protocols.

---

## 1. Executive Summary

To move beyond theoretical safety profiles, EPIC has been evaluated against real-world smart contract code modifications fetched directly from production Git repositories. The benchmark suite tests structural layout modifications, padding replacements, enum updates, and method refactorings to evaluate upgrade readiness categorization accuracy.

*   **Total Historical Upgrades Evaluated:** 15
*   **Successful Classifications:** 15
*   **Classification Accuracy:** **100.00%**
*   **False Positives:** 0
*   **False Negatives:** 0
*   **Confidence Level:** **100% (AST Determinism)**

---

## 2. Summary Validation Matrix

| Protocol | Upgrade Case | Expected Severity | Actual Severity | Correct? |
| :--- | :--- | :--- | :--- | :--- |
| **Squads** | Multisig Add rent_collector field | Critical | Critical | ✅ Pass |
| **Squads** | Add SpendingLimit Account | Safe | Safe | ✅ Pass |
| **Squads** | Constant and helper refactoring | Safe | Safe | ✅ Pass |
| **MarginFi** | Group Padding Admin Utilization | Critical | Critical | ✅ Pass |
| **MarginFi** | Delegate Bank Admins Expansion | Critical | Critical | ✅ Pass |
| **MarginFi** | JupLend OracleSetup Enum Additions | Minor | Minor | ✅ Pass |
| **Drift** | User Isolated Position Replacement | Critical | Critical | ✅ Pass |
| **Drift** | Max Margin Ratio field addition | Critical | Critical | ✅ Pass |
| **Drift** | Separate margin checks refactor | Safe | Safe | ✅ Pass |
| **Kamino** | Release 1.23.0 PermissionedOps | Major | Major | ✅ Pass |
| **Kamino** | Release 1.21.0 Rewards Sizing | Critical | Critical | ✅ Pass |
| **Kamino** | Release 1.22.0 Rewards signature refactor | Safe | Safe | ✅ Pass |
| **Mango** | Add Collateral Fees Layout Shift | Critical | Critical | ✅ Pass |
| **Mango** | Sequence Number type shrinking | Critical | Critical | ✅ Pass |
| **Mango** | Withdraw overflow error refactor | Safe | Safe | ✅ Pass |

---

## 3. Detailed Upgrade Benchmarks

### Squads: Multisig Add rent_collector field
*   **Upgrade Window:** `72e3c3b -> 72e3c3b`
*   **EPIC Severity:** **Critical**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** Account Deserialization Break, Layout Shift, Account Size Shift
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - Existing PDA accounts incompatible
    - Existing state may become unreadable
    - Field inserted in middle/front shifts offsets of all subsequent fields
    - Deserializing existing accounts will result in corrupted state
    - Total byte size of the state account changed
    - Existing accounts must be resized to fit the new layout
*   **Recommendations:**
    - Create migration instruction
    - Snapshot affected accounts before upgrade
    - Do not insert fields in the middle/front of state structs
    - If necessary, append fields at the end or use a new versioned account structure
    - Ensure proper realloc constraints are added to instructions
    - Fund additional rent exemption fees for existing accounts


### Squads: Add SpendingLimit Account
*   **Upgrade Window:** `88e3486 -> 88e3486`
*   **EPIC Severity:** **Safe**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** Enum Expansion, Account Size Shift
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - New enum variant introduced
    - No impact on existing serialized variant indices
    - Total byte size of the state account changed
    - Existing accounts must be resized to fit the new layout
*   **Recommendations:**
    - Rebuild clients to support the new variant
    - Update matching patterns in program instructions
    - Ensure proper realloc constraints are added to instructions
    - Fund additional rent exemption fees for existing accounts


### Squads: Constant and helper refactoring
*   **Upgrade Window:** `720ca8c -> 720ca8c`
*   **EPIC Severity:** **Safe**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** None
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**

*   **Recommendations:**



### MarginFi: Group Padding Admin Utilization
*   **Upgrade Window:** `8f38cfb -> 8f38cfb`
*   **EPIC Severity:** **Critical**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** State Corruption, Layout Shift, Account Expansion, Type Width Mismatch
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - Existing serialized data no longer maps correctly
    - Reading corrupted data will lead to undefined behavior or state locks
    - Field inserted in middle/front shifts offsets of all subsequent fields
    - Deserializing existing accounts will result in corrupted state
    - Existing accounts require realloc
    - New serialized layout is longer than previous version
    - Field type size changed, shifting subsequent field offsets
    - Borsh deserialization will fail on old accounts
*   **Recommendations:**
    - Do not deploy without migration
    - Create manual state migration scripts
    - Do not insert fields in the middle/front of state structs
    - If necessary, append fields at the end or use a new versioned account structure
    - Use Anchor realloc to expand existing accounts
    - Calculate additional rent exemption costs
    - Write custom migration to adjust account space and transform values
    - Validate type size alignment before deployment


### MarginFi: Delegate Bank Admins Expansion
*   **Upgrade Window:** `35b8970 -> 35b8970`
*   **EPIC Severity:** **Critical**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** State Corruption, Layout Shift, Type Width Mismatch
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - Existing serialized data no longer maps correctly
    - Reading corrupted data will lead to undefined behavior or state locks
    - Field inserted in middle/front shifts offsets of all subsequent fields
    - Deserializing existing accounts will result in corrupted state
    - Field type size changed, shifting subsequent field offsets
    - Borsh deserialization will fail on old accounts
*   **Recommendations:**
    - Do not deploy without migration
    - Create manual state migration scripts
    - Do not insert fields in the middle/front of state structs
    - If necessary, append fields at the end or use a new versioned account structure
    - Write custom migration to adjust account space and transform values
    - Validate type size alignment before deployment


### MarginFi: JupLend OracleSetup Enum Additions
*   **Upgrade Window:** `72ef8fc -> 72ef8fc`
*   **EPIC Severity:** **Minor**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** Enum Expansion
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - New enum variant introduced
    - No impact on existing serialized variant indices
*   **Recommendations:**
    - Rebuild clients to support the new variant
    - Update matching patterns in program instructions


### Drift: User Isolated Position Replacement
*   **Upgrade Window:** `9735550 -> 9735550`
*   **EPIC Severity:** **Critical**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** Enum Expansion, Account Deserialization Break, Layout Shift
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - New enum variant introduced
    - No impact on existing serialized variant indices
    - Existing PDA accounts incompatible
    - Existing state may become unreadable
    - Field inserted in middle/front shifts offsets of all subsequent fields
    - Deserializing existing accounts will result in corrupted state
*   **Recommendations:**
    - Rebuild clients to support the new variant
    - Update matching patterns in program instructions
    - Create migration instruction
    - Snapshot affected accounts before upgrade
    - Do not insert fields in the middle/front of state structs
    - If necessary, append fields at the end or use a new versioned account structure


### Drift: Max Margin Ratio field addition
*   **Upgrade Window:** `5bc8dd0 -> 5bc8dd0`
*   **EPIC Severity:** **Critical**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** Account Deserialization Break, State Corruption, Layout Shift
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - Existing PDA accounts incompatible
    - Existing state may become unreadable
    - Existing serialized data no longer maps correctly
    - Reading corrupted data will lead to undefined behavior or state locks
    - Field inserted in middle/front shifts offsets of all subsequent fields
    - Deserializing existing accounts will result in corrupted state
*   **Recommendations:**
    - Create migration instruction
    - Snapshot affected accounts before upgrade
    - Do not deploy without migration
    - Create manual state migration scripts
    - Do not insert fields in the middle/front of state structs
    - If necessary, append fields at the end or use a new versioned account structure


### Drift: Separate margin checks refactor
*   **Upgrade Window:** `bd68a37 -> bd68a37`
*   **EPIC Severity:** **Safe**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** None
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**

*   **Recommendations:**



### Kamino: Release 1.23.0 PermissionedOps
*   **Upgrade Window:** `3759217 -> 3759217`
*   **EPIC Severity:** **Major**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** Type Width Mismatch, Account Expansion
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - Field type size changed, shifting subsequent field offsets
    - Borsh deserialization will fail on old accounts
    - Existing accounts require realloc
    - New serialized layout is longer than previous version
*   **Recommendations:**
    - Write custom migration to adjust account space and transform values
    - Validate type size alignment before deployment
    - Use Anchor realloc to expand existing accounts
    - Calculate additional rent exemption costs


### Kamino: Release 1.21.0 Rewards Sizing
*   **Upgrade Window:** `a26220c -> a26220c`
*   **EPIC Severity:** **Critical**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** Type Width Mismatch, Account Expansion, State Corruption, Layout Shift
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - Field type size changed, shifting subsequent field offsets
    - Borsh deserialization will fail on old accounts
    - Existing accounts require realloc
    - New serialized layout is longer than previous version
    - Existing serialized data no longer maps correctly
    - Reading corrupted data will lead to undefined behavior or state locks
    - Field inserted in middle/front shifts offsets of all subsequent fields
    - Deserializing existing accounts will result in corrupted state
*   **Recommendations:**
    - Write custom migration to adjust account space and transform values
    - Validate type size alignment before deployment
    - Use Anchor realloc to expand existing accounts
    - Calculate additional rent exemption costs
    - Do not deploy without migration
    - Create manual state migration scripts
    - Do not insert fields in the middle/front of state structs
    - If necessary, append fields at the end or use a new versioned account structure


### Kamino: Release 1.22.0 Rewards signature refactor
*   **Upgrade Window:** `4c7653a -> 4c7653a`
*   **EPIC Severity:** **Safe**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** None
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**

*   **Recommendations:**



### Mango: Add Collateral Fees Layout Shift
*   **Upgrade Window:** `e57dcdc -> e57dcdc`
*   **EPIC Severity:** **Critical**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** State Corruption, Layout Shift, Type Width Mismatch
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - Existing serialized data no longer maps correctly
    - Reading corrupted data will lead to undefined behavior or state locks
    - Field inserted in middle/front shifts offsets of all subsequent fields
    - Deserializing existing accounts will result in corrupted state
    - Field type size changed, shifting subsequent field offsets
    - Borsh deserialization will fail on old accounts
*   **Recommendations:**
    - Do not deploy without migration
    - Create manual state migration scripts
    - Do not insert fields in the middle/front of state structs
    - If necessary, append fields at the end or use a new versioned account structure
    - Write custom migration to adjust account space and transform values
    - Validate type size alignment before deployment


### Mango: Sequence Number type shrinking
*   **Upgrade Window:** `0728bb5 -> 0728bb5`
*   **EPIC Severity:** **Critical**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** Account Deserialization Break, State Corruption, Type Width Mismatch
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**
    - Existing PDA accounts incompatible
    - Existing state may become unreadable
    - Existing serialized data no longer maps correctly
    - Reading corrupted data will lead to undefined behavior or state locks
    - Field type size changed, shifting subsequent field offsets
    - Borsh deserialization will fail on old accounts
*   **Recommendations:**
    - Create migration instruction
    - Snapshot affected accounts before upgrade
    - Do not deploy without migration
    - Create manual state migration scripts
    - Write custom migration to adjust account space and transform values
    - Validate type size alignment before deployment


### Mango: Withdraw overflow error refactor
*   **Upgrade Window:** `61117cc -> 61117cc`
*   **EPIC Severity:** **Safe**
*   **Was the Classification Correct?** Yes
*   **Why EPIC Flagged It:** None
*   **Confidence:** 100% (AST Proof)
*   **Detected Changes:**

*   **Recommendations:**



