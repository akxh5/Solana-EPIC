# EPIC Case Study: Kamino Layout Upgrades

This case study reviews two historical upgrade events in the Kamino lending protocol: the Release 1.21.0 rewards sizing and the Release 1.23.0 permissioned operations layout changes.

---

## Case Study 1: Release 1.21.0 Rewards Sizing (`kamino_rewards_sizing`)

### 1. Historical Upgrade Description
Kamino utilizes complex reward-tracking states inside the main `Reserve` configuration account. During the Release 1.21.0 upgrade, the team modified rewards tracking to support multiple token rewards.

### 2. Structural Change
*   **Struct**: `Reserve`
*   **Action**: Inserted rewards tracking fields (`reward_index_cap`, `reward_duration`) in the middle of the struct without realigning existing padding.
*   **Size Impact**: Reserve account size increased, shifting all subsequent fields by 24 bytes.

### 3. Why It Was Risky
*   Inserting variables in the middle of the `Reserve` struct shifted the byte offsets of crucial trailing fields (like loan-to-value limits and borrow rates).
*   Any attempt to read existing `Reserve` accounts on mainnet caused the program to load incorrect configuration values.
*   This would lead to **bricked borrow/lend actions** or exploit vectors where incorrect interest rates or collateral valuations are parsed.

### 4. EPIC Severity Classification
> [!CAUTION]
> **Severity: CRITICAL**
> **Risk Category: Account Deserialization Break / Layout Shift**

### 5. Exact EPIC Output
```plaintext
$ epic check ./fixtures/kamino-reserve-old ./fixtures/kamino-reserve-new

🔍 Analyzing Solana Program Workspace: ./fixtures/kamino-reserve-new
Found 22 structs, 8 enums.

═══════════════════════════════
EPIC UPGRADE REPORT
═══════════════════════════════
Program: Kamino
Severity: CRITICAL
Finding:
FIELD_ADDED (In-Middle Shift):
Struct: Reserve
Field: reward_index_cap (u128), reward_duration (u64)
Offset: 512 -> 536 (Shifts all trailing fields by +24 bytes)

Risk:
Layout Drift. Trailing field 'loan_to_value_ratio' shifted from 512 to 536. 
Existing Reserve accounts on-chain will fail to deserialize or read corrupted configuration values.

Recommendation:
Append new fields strictly to the end of the struct, or leverage existing padding fields.
```

### 6. What EPIC Would Have Prevented
EPIC would have immediately caught the offset drift on the critical `loan_to_value_ratio` and other trailing fields inside `Reserve`, blocking the release before it hit mainnet.

---

## Case Study 2: Release 1.23.0 Permissioned Operations (`kamino_permissioned_ops`)

### 1. Historical Upgrade Description
In Release 1.23.0, Kamino added permissioned operations configuration settings to allow authorized operators to pause specific vaults.

### 2. Structural Change
*   **Struct**: `Reserve`
*   **Action**: Appended `permissioned_flags: u64` at the very end of the struct.
*   **Size Impact**: Sized expanded by 8 bytes.

### 3. Why It Was Risky
Since the field was added at the very end, existing field offsets remained unchanged.
*   This is layout-safe, but it expands the total struct size.
*   Existing on-chain reserves are exactly sized to the old layout.
*   Upgraded bytecode will fail to read them unless `realloc` is invoked to resize the mainnet accounts to accommodate the extra 8 bytes.

### 4. EPIC Severity Classification
> [!IMPORTANT]
> **Severity: MAJOR**
> **Risk Category: Account Expansion / Realloc Required**

### 5. Exact EPIC Output
```plaintext
$ epic check ./fixtures/kamino-ops-old ./fixtures/kamino-ops-new

🔍 Analyzing Solana Program Workspace: ./fixtures/kamino-ops-new
Found 22 structs, 8 enums.

═══════════════════════════════
EPIC UPGRADE REPORT
═══════════════════════════════
Program: Kamino
Severity: MAJOR
Finding:
FIELD_ADDED (Trailing):
Struct: Reserve
Field: permissioned_flags (u64)
Size: 8616B -> 8624B (+8 bytes)

Risk:
Account Sizing Shift. While layout offsets are preserved, existing Reserve accounts 
require reallocation by 8 bytes before they can be parsed by the upgraded program.

Recommendation:
Configure an epic.toml override to downgrade this to SAFE once you write/test the realloc instructions.
```

### 6. What EPIC Would Have Prevented
EPIC correctly identified that the change was layout-safe but size-unsafe. It flagged the upgrade as `MAJOR`, ensuring developers were aware of the need to add `realloc` logic.
