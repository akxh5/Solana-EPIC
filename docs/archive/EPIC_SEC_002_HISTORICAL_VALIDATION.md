# EPIC-SEC-002: Missing Signer Validation — Historical Exploit Validation Report

## 1. Goal
Validate the compiler-grade `EPIC-SEC-002` rule against representative exploit fixtures modeled after high-profile real-world Solana hacks:
*   **Wormhole** (Guardian set upgrade signature bypass)
*   **Cashio App** (Unchecked minting authority)
*   **Crema Finance** (Pool management authority hijack)

The rule must:
*   Flag all **unsafe** variants as `CRITICAL` findings.
*   Produce **no findings** (`NO FINDINGS`) for all **safe** variants.

---

## 2. Test Matrix and Results

| Exploit Model | Target File | Status | Verdict |
| :--- | :--- | :--- | :--- |
| **Wormhole Unsafe** | `fixtures/historical_exploits/wormhole_sec002_unsafe.rs` | **FLAGGED** | `CRITICAL` finding generated for `guardian_authority` |
| **Wormhole Safe** | `fixtures/historical_exploits/wormhole_sec002_safe.rs` | **NO FINDINGS** | Approved. `guardian_authority` is parsed as `Signer<'info>` |
| **Cashio Unsafe** | `fixtures/historical_exploits/cashio_sec002_unsafe.rs` | **FLAGGED** | `CRITICAL` finding generated for `bank_owner` |
| **Cashio Safe** | `fixtures/historical_exploits/cashio_sec002_safe.rs` | **NO FINDINGS** | Approved. `bank_owner` has `#[account(signer)]` attribute |
| **Crema Unsafe** | `fixtures/historical_exploits/crema_sec002_unsafe.rs` | **FLAGGED** | `CRITICAL` finding generated for `manager` |
| **Crema Safe** | `fixtures/historical_exploits/crema_sec002_safe.rs` | **NO FINDINGS** | Approved. Signer checked via runtime `!manager.is_signer` guard |

---

## 3. Findings Detail

### Wormhole (Guardian Set Upgrade)
*   **Unsafe**: `guardian_authority` declared as `AccountInfo<'info>`. The administrative mutation `data[0] = 1` inside `update_guardian_set` is flagged because it lacks dominating signer validation for this authority-like account.
*   **Safe**: `guardian_authority` wrapped in `Signer<'info>`. The structural check is successfully parsed into `GuardFact::Signer` and dominates the write.

### Cashio (Cash Printing)
*   **Unsafe**: `bank_owner` declared as `AccountInfo<'info>`. Flagged as missing signer validation because the bank account state is modified inside `print_cash`.
*   **Safe**: `bank_owner` marked with `#[account(signer)]`. Anchor constraint parsing maps this to a declared `GuardFact::Signer`, validating the write.

### Crema (Fee Collection)
*   **Unsafe**: `manager` declared as `AccountInfo<'info>` with no runtime signer checks. Flagged.
*   **Safe**: The code runs an imperative signer check:
    ```rust
    if !ctx.accounts.manager.is_signer {
        return Err(ProgramError::MissingRequiredSignature.into());
    }
    ```
    This condition is converted by the compiler engine into a `GuardFact::Signer` located in the exit path of the condition branch. Dominance analysis confirms that all execution paths leading to the state mutation at `pool` are dominated by this check. No findings are generated.
