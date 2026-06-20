# EPIC Case Study: Squads Layout Upgrades

This case study reviews a critical historical upgrade event in the Squads multisig protocol: adding a `rent_collector` field in the middle of the core `Multisig` state account.

---

## Case Study: Multisig Add `rent_collector` Field (`squads_rent_collector`)

### 1. Historical Upgrade Description
Squads v4 is a smart account and multisig protocol. During an upgrade, developers wanted to introduce a `rent_collector` feature to reclaim lamports from closed proposal accounts. They added a `rent_collector: Pubkey` field to the `Multisig` struct.

### 2. Structural Change
*   **Struct**: `Multisig`
*   **Action**: A new field `rent_collector` was inserted in the middle of the struct.
*   **Size Impact**: The `Multisig` account size increased by 32 bytes (size of a `Pubkey`), shifting all subsequent field offsets.

### 3. Why It Was Risky
*   In Borsh serialization, fields are read sequentially from the byte array.
*   Inserting a 32-byte `Pubkey` field in the middle shifted the offset of all subsequent fields (like `threshold`, `member_count`, and `vault_bump`) by exactly 32 bytes.
*   When existing multisigs on mainnet were loaded, the program read `threshold` and `member_count` from the wrong bytes, loading corrupted numbers into memory.
*   This caused immediate **deserialization crashes**, bricking existing multisig accounts and preventing users from initiating or approving transactions.

### 4. EPIC Severity Classification
> [!CAUTION]
> **Severity: CRITICAL**
> **Risk Category: Account Deserialization Break / Layout Shift**

### 5. Exact EPIC Output
```plaintext
$ epic check ./fixtures/squads-multisig-old ./fixtures/squads-multisig-new

🔍 Analyzing Solana Program Workspace: ./fixtures/squads-multisig-new
Found 11 structs, 2 enums.

═══════════════════════════════
EPIC UPGRADE REPORT
═══════════════════════════════
Program: Squads
Severity: CRITICAL
Finding:
FIELD_ADDED (In-Middle Shift):
Struct: Multisig
Field: rent_collector (Pubkey)
Offset: 64 -> 96 (Shifts all trailing fields by +32 bytes)

Risk:
Layout Drift. Trailing field 'threshold' shifted from 64 to 96. 
Existing Multisig accounts on mainnet will fail to deserialize.

Recommendation:
Do not add fields in the middle of on-chain structs. 
Append new fields strictly to the end of the struct, and ensure realloc is implemented.
```

### 6. What EPIC Would Have Prevented
EPIC's static AST analysis would have blocked the PR merge. It details the exact byte shift (`+32 bytes`) and warns that the `threshold` offset shifted from `64` to `96`. This would have prevented a catastrophic mainnet lockup of smart accounts.
