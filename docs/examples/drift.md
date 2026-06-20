# EPIC Case Study: Drift Protocol Layout Upgrades

This case study reviews two historical upgrade events in the Drift Protocol (Drift V2) repository, explaining the state structural changes, the on-chain risks, and how EPIC detects and gates these upgrades.

---

## Case Study 1: User Isolated Position Replacement (`drift_lp_position_replacement`)

### 1. Historical Upgrade Description
Drift V2 manages perpetual and spot trading. During an upgrade to perp positions, the team wanted to replace existing fields inside the `PerpPosition` struct (`last_base_asset_amount_per_lp` and `per_lp_base`) with new fields to support updated liquidity provider (LP) calculations.

### 2. Structural Change
*   **Struct**: `PerpPosition`
*   **Action**: Replaced/reordered active fields in the middle of the struct.
*   **Size Impact**: The total size of `PerpPosition` remained unchanged at 48 bytes, but the internal layout offsets were modified.

### 3. Why It Was Risky
Solana programs deserialize account byte arrays sequentially. Although the struct's overall byte size remained constant (48 bytes), replacing the fields shifted how the on-chain program interpreted the memory layout:
*   When reading pre-existing on-chain user accounts, the upgraded program read the new variables from the byte offsets of the deleted/replaced variables.
*   This caused immediate **account state corruption** and caused the Borsh deserializer to parse garbage data, leading to failed transactions and bricked trading states.

### 4. EPIC Severity Classification
> [!CAUTION]
> **Severity: CRITICAL**
> **Risk Category: Account Deserialization Break / Layout Offset Shift**

### 5. Exact EPIC Output
```plaintext
$ epic check ./fixtures/drift-lp-old ./fixtures/drift-lp-new

🔍 Analyzing Solana Program Workspace: ./fixtures/drift-lp-new
Found 18 structs, 5 enums.

═══════════════════════════════
EPIC UPGRADE REPORT
═══════════════════════════════
Program: Drift
Severity: CRITICAL
Finding:
FIELD_REORDERED / FIELD_REMOVED:
Struct: PerpPosition
Old Fields: last_base_asset_amount_per_lp (i64), per_lp_base (i64)
New Fields: lp_base_asset_amount (i64), lp_quote_asset_amount (i64)

Risk:
Layout Drift (Shifts offsets of all trailing fields in PerpPosition)
Any historical state reading this struct will fail to deserialize.

Recommendation:
Never remove or reorder active fields inside a persisted on-chain structure. 
If fields are obsolete, mark them as deprecated in code but preserve their positions and types.
```

### 6. What EPIC Would Have Prevented
EPIC would have immediately failed the CI run during compilation before the upgrade proposal reached mainnet. A simple size check tool would have approved the PR because the size of `PerpPosition` was unchanged (48B -> 48B). EPIC's AST analysis caught the structural reordering and offset mismatch.

---

## Case Study 2: Max Margin Ratio Field Insertion (`drift_max_margin_ratio_add`)

### 1. Historical Upgrade Description
In a subsequent feature release, the team needed to add a new risk parameter, `max_margin_ratio`, to the core `User` state configuration.

### 2. Structural Change
*   **Struct**: `User`
*   **Action**: A new field `max_margin_ratio: u32` was inserted in the middle of the struct rather than appended to the end.
*   **Size Impact**: Sized increased from 2040 bytes to 2044 bytes.

### 3. Why It Was Risky
Inserting a field in the middle of a struct shifts the byte offsets of all fields declared after it.
*   Borsh reads variables sequentially. Any field after `max_margin_ratio` shifted by 4 bytes.
*   Any read of existing accounts on mainnet populated the wrong variables, corrupting margin checks and risking liquidation engine failures.

### 4. EPIC Severity Classification
> [!CAUTION]
> **Severity: CRITICAL**
> **Risk Category: Layout Offset Shift**

### 5. Exact EPIC Output
```plaintext
$ epic check ./fixtures/drift-margin-old ./fixtures/drift-margin-new

🔍 Analyzing Solana Program Workspace: ./fixtures/drift-margin-new
Found 18 structs, 5 enums.

═══════════════════════════════
EPIC UPGRADE REPORT
═══════════════════════════════
Program: Drift
Severity: CRITICAL
Finding:
FIELD_ADDED (In-Middle Shift):
Struct: User
Field: max_margin_ratio (u32)
Offset: 1024 -> 1028 (Shifts all trailing fields by 4 bytes)

Risk:
Layout Drift. Trailing field 'settle_token_index' offset shifted from 1028 to 1032. 
Existing User accounts on-chain will fail to deserialize.

Recommendation:
Append new fields only at the very end of your struct. 
Verify that the total struct size fits within the preallocated account size limit.
```

### 6. What EPIC Would Have Prevented
EPIC would have flagged the in-middle insertion, blocking the PR merge. It highlights the exact offset shift (`+4 bytes`) and trailing fields affected.
