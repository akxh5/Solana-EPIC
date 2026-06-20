# EPIC Case Study: Marginfi Layout Upgrades

This case study reviews two historical upgrade events in the Marginfi repository: padding admin utilization and the delegate bank admins expansion. It explains the state structural changes, the on-chain risks, and how EPIC detects and gates these upgrades.

---

## Case Study 1: Group Padding Admin Utilization (`marginfi_padding_admin_utilization`)

### 1. Historical Upgrade Description
To support new admin permissions, the Marginfi team needed to repurpose bytes inside a pre-allocated padding block in the main `MarginfiGroup` configuration structure. 

### 2. Structural Change
*   **Struct**: `MarginfiGroup`
*   **Action**: Replaced/realigned byte arrays in the configuration padding. A custom field `admin_authority: Pubkey` was introduced by carving out space from a `reserved: [u8; 128]` padding array.
*   **Size Impact**: The overall struct size was unchanged, but the alignment boundaries of internal trailing fields were shifted due to incorrect padding math (shrinking the padding array incorrectly to `[u8; 104]` instead of `[u8; 96]`).

### 3. Why It Was Risky
*   In Borsh, public keys require exactly 32 bytes.
*   By shrinking the padding block from 128 bytes to 104 bytes while inserting a 32-byte key, the total size of the padding block + key became 136 bytes (an increase of 8 bytes).
*   This shifted the offset of every single field declared after the padding array by 8 bytes.
*   When deployed, the program failed to read subsequent fields (like risk boundaries or interest rate rules) from existing accounts on mainnet, leading to deserialization failures.

### 4. EPIC Severity Classification
> [!CAUTION]
> **Severity: CRITICAL**
> **Risk Category: State Corruption / Layout Offset Shift**

### 5. Exact EPIC Output
```plaintext
$ epic check ./fixtures/marginfi-group-old ./fixtures/marginfi-group-new

🔍 Analyzing Solana Program Workspace: ./fixtures/marginfi-group-new
Found 14 structs, 3 enums.

═══════════════════════════════
EPIC UPGRADE REPORT
═══════════════════════════════
Program: Marginfi
Severity: CRITICAL
Finding:
TYPE_CHANGED / PADDING_REPURPOSE:
Struct: MarginfiGroup
Old Field: reserved: [u8; 128]
New Fields: admin_authority: Pubkey, reserved: [u8; 104]

Risk:
Layout Drift (Shifts offsets of all trailing fields by +8 bytes).
The overall offset boundary of trailing fields has shifted, bricking existing accounts.

Recommendation:
To repurpose padding, ensure that the size of the new fields exactly matches the size carved out of the padding array. 
For a 32-byte Pubkey, shrink the reserved array by exactly 32 bytes (e.g. from 128 to 96).
```

### 6. What EPIC Would Have Prevented
EPIC's AST layout engine checks byte alignments and computes exact offsets. It would have caught that the newly introduced fields (`32 bytes` + `104 bytes` = `136 bytes`) exceeded the original padding size (`128 bytes`), warning the developer before merging.

---

## Case Study 2: Delegate Bank Admins Expansion (`marginfi_delegate_admin_expansion`)

### 1. Historical Upgrade Description
The team wanted to extend `Bank` structures to allow delegated administrators to adjust risk limits. They added several trailing fields to the `Bank` state configuration.

### 2. Structural Change
*   **Struct**: `Bank`
*   **Action**: Appended multiple fields to the end of the struct.
*   **Size Impact**: `Bank` size expanded from 768 bytes to 820 bytes.

### 3. Why It Was Risky
Appending trailing fields is layout-safe (it does not shift existing offsets), but it increases the overall size of the struct.
*   If the original account size allocated on-chain (`space`) was exactly 768 bytes, the expanded program would throw an **OutOfSpace / Deserialization Failure** error when reading existing on-chain banks because the account data array was too small.
*   This requires running `realloc` instructions to resize existing accounts on mainnet before they can be read or written to by the upgraded code.

### 4. EPIC Severity Classification
> [!IMPORTANT]
> **Severity: MAJOR**
> **Risk Category: Account Expansion / Out of Space Crash**

### 5. Exact EPIC Output
```plaintext
$ epic check ./fixtures/marginfi-bank-old ./fixtures/marginfi-bank-new

🔍 Analyzing Solana Program Workspace: ./fixtures/marginfi-bank-new
Found 14 structs, 3 enums.

═══════════════════════════════
EPIC UPGRADE REPORT
═══════════════════════════════
Program: Marginfi
Severity: MAJOR
Finding:
FIELD_ADDED (Trailing):
Struct: Bank
Field: delegate_authority (Pubkey), risk_limit_cap (u64)
Size: 768B -> 820B (+52 bytes)

Risk:
Account Expansion. Existing on-chain accounts must be resized using the realloc instruction 
and funded for rent-exemption. Otherwise, the program will crash with OutOfSpace errors at runtime.

Recommendation:
Run realloc migrations on mainnet accounts prior to upgrading the program bytecode.
```

### 6. What EPIC Would Have Prevented
EPIC alerts the team that `Bank` size increased by 52 bytes. In the PR comments, it provides direct instructions on implementing `realloc` code, preventing a runtime crash on mainnet banks.
