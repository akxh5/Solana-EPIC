# EPIC Phase 1 Security Engine: Technical Architecture

This document defines the technical design and architectural specification for the **EPIC Phase 1 Security Engine**. The engine extends EPIC’s existing Rust AST parser and semantic type registry to perform compile-free, deterministic security analysis on Solana smart contracts.

The primary design principle is **semantic correctness over heuristic pattern matching**. By analyzing control flow paths, AST data relationships, and type tracking, EPIC avoids the high false-positive rates of name-based grep rules (e.g., Anchor Sentinel) and delivers production-grade security gates for CI/CD environments.

---

## 1. Ownership Validation Engine

### Semantic Vulnerability Pattern
In Solana, any account passed to an instruction is untrusted until its owner is validated. If a program mutates an account's data buffer (e.g., updating a user's balance) without verifying that the account is owned by the program itself, an attacker can pass a malicious account owned by a different program (or a system account they control) containing crafted data, leading to arbitrary state injection.

### AST Signals & Detection Rules
To verify ownership safety, the engine evaluates every instruction scope against the following AST patterns:

1.  **Mutable Account Modification**:
    *   Identify all variable bindings originating from instruction arguments that resolve to mutable references (`&mut`) of serialized data structures, or raw `AccountInfo` wrappers where `data.borrow_mut()` is called.
    *   Flag any mutable access to account data that occurs on types *other* than Anchor’s safe wrapper `Account<'info, T>` (which implicitly validates ownership via the type constraint).
2.  **Missing Guard Analysis**:
    *   Trace the target account variable through the control flow graph (CFG).
    *   Look for ownership verification expressions matching:
        ```rust
        // Direct comparison
        *account_info.owner == program_id
        // Macro verification
        assert_eq!(account_info.owner, program_id);
        ```
    *   If a control flow path leads to a data mutation or write without traversing one of these verification AST nodes, register a vulnerability.
3.  **Unsafe AccountInfo Usage**:
    *   Detect cases where a raw `AccountInfo<'info>` or `UncheckedAccount<'info>` is manually deserialized (e.g., using `BorshDeserialize::deserialize(&mut &**account.data.borrow())`) and subsequently modified without an explicit ownership guard preceding the borrow.

### Type-Resolution Requirements
The parser must maintain a **Symbol & Type Table** resolving:
*   Variable identifiers back to their structural definitions (e.g., `AccountInfo`, `Account`, `Signer`, `UncheckedAccount`).
*   Associated lifetime maps and custom structs to trace aliased reference variables (e.g., `let account_alias = &mut ctx.accounts.untrusted;`).

### False-Positive Avoidance Strategy
*   **Safe Type Exclusion**: Do not flag accounts defined under Anchor's `Account<'info, T>` type or SPL type wrappers (like `TokenAccount<'info>`) since ownership is verified during deserialization.
*   **Inter-procedural Ownership Checking**: Trace validation helper functions. If ownership validation is delegated to a separate private function (e.g., `check_owner(info)`), resolve the helper's AST to verify it executes the owner check and returns a terminal error on mismatch.

### Historical Exploits Prevented
*   **Cashio ($52M Exploit)**: The program accepted a fake collateral mint account because it omitted checking that the mint account was owned by the SPL Token program. EPIC would detect the raw `AccountInfo` read of the mint data without an owner verification guard.
*   **Crema Finance ($8.7M Exploit)**: The program accepted a fraudulent tick-array account because the custom deserialization did not verify the account owner, allowing simulated data injection.

---

## 2. Missing Signer Detection

### Semantic Vulnerability Pattern
Privileged actions—such as administrative parameter updates, fund withdrawals, or state overrides—must be authorized by a signature from a specific key. If a program verifies that an account's public key matches a stored authority (e.g., `ctx.accounts.config.admin == ctx.accounts.authority.key`) but fails to verify that the authority actually signed the transaction, an attacker can pass the target admin public key without a signature, bypassing security checks entirely.

### Semantic Detection Approach
Unlike baseline scanning tools that match string literals like `"admin"` or `"owner"`, EPIC uses a data-flow dependency tracking model:

1.  **State Mutation Gating**:
    *   Identify all conditional branch nodes (`if`, `match`, `guard`) that control access to write/mutation AST nodes or CPI calls (`invoke`, `invoke_signed`).
    *   Extract the public keys involved in the condition comparisons (e.g., checking if `lhs == rhs`).
2.  **Signer Verification Trace**:
    *   For each verified public key involved in a gating condition, verify if its type is `Signer<'info>` or if the CFG contains a signer guard expression:
        ```rust
        account_info.is_signer
        // or
        assert!(account_info.is_signer);
        ```
    *   If a public key is used as an authority comparison to authorize a mutation path, but the account representing that public key never has its signer status asserted, flag it as a missing signer vulnerability.

```
                  Instruction Inputs
                           │
                           ▼
                 Identify Gating Guard
            (e.g., config.admin == admin.key)
                           │
                           ▼
            Does admin resolve to Signer<'info>?
               ├── Yes ──► Safe (No Alert)
               └── No  ──► Check if admin.is_signer is asserted in CFG
                             ├── Yes ──► Safe (No Alert)
                             └── No  ──► EMIT: Missing Signer Alert
```

### Avoiding Name Matching
Instead of inspecting variable naming patterns, EPIC identifies privileged execution states based on semantic effects:
*   Calls to token program transfers (CPI).
*   Mutations of variables that map to system config states (e.g., fee rates, treasury addresses).
*   Instructions that trigger program-level closures or reallocations.

Any variable that acts as a check key to protect these operations is automatically marked as a security-sensitive authority.

---

## 3. Reinitialization Protection

### Semantic Vulnerability Pattern
Reinitialization occurs when an already initialized state account is overwritten, resetting its fields (e.g., setting vault balances or administrative structures back to zero). This happens when an initialization instruction does not verify whether the account data buffer has already been formatted, or when the `init_if_needed` macro is applied without sufficient bounds checking.

### Anchor-Specific Detection
The engine scans Anchor struct annotations for `#[derive(Accounts)]` structures:
1.  **`init_if_needed` Risk Analyzer**:
    *   Locate any accounts annotated with `#[account(init_if_needed, ...)]`.
    *   Verify that the corresponding instruction implementation validates that the account state is not already configured, or that it is designed with idempotent field assignments.
    *   Check for the presence of a rent allocation size check, ensuring the realloc boundary cannot be triggered repeatedly to drain program-managed lamports via rent top-ups.
2.  **Anchor Discriminator Checking**:
    *   Ensure that every state struct has a valid 8-byte discriminator check. If custom serialization is bypass-annotated, verify that the manual discriminator validation is present in the instruction block.

### Native Rust Detection
For non-Anchor (native) programs, state initialization checks are manual. The engine flags vulnerabilities by scanning for:
1.  **Lack of Discriminator Checks**:
    *   Identify if an account is deserialized using custom data layout offsets.
    *   Flag if there is no check verifying that the first byte (or range of bytes) matches a specific constant (e.g., `StateVersion::Initialized`).
2.  **Unprotected Writes on Zeros**:
    *   Scan for checks that verify initialization based on zero-value testing (e.g., checking if `state.is_initialized == 0`).
    *   Ensure the code blocks re-entry by setting the state variable to a non-zero initialized state before any external cross-program calls or logic branches occur (preventing re-entrancy style initialization state overrides).

---

## 4. Close Authority Validation

### Semantic Vulnerability Pattern
Solana programs reclaim rent lamports by closing accounts. This is accomplished by setting the account's data size to 0 and transferring its lamport balance to a target destination account. If the close execution path is accessible without verifying that the caller has the authority to close the account, or if the lamports are transferred before clearing the account data, attackers can execute denial-of-service sweeps or access stale memory states.

### Required AST Patterns
The engine checks close operations by scanning for:
1.  **Lamport Reallocation Flow**:
    *   Detect variables mutably borrowing `lamports` (e.g., `**account.lamports.borrow_mut()`).
    *   Trace the transfer of these lamports:
        ```rust
        let dest_lamports = target.lamports.borrow_mut();
        **dest_lamports += **account.lamports.borrow();
        **account.lamports.borrow_mut() = 0;
        ```
2.  **Memory Clearing Control Flow**:
    *   Validate that data length modification (`account.realloc(0, false)`) or data zeroing (`account.data.borrow_mut().fill(0)`) is executed in the same control branch as the lamport drain.
3.  **Authorization Guards**:
    *   Verify that the close branch is guarded by an authority public key comparison. If the account being closed is a PDA, verify that the closing instruction validates that the PDA seeds match the caller's context or that the close destination matches a statically derived program vault.

### Required Type Information
To perform this analysis, the parser resolves the fields of `AccountInfo` and tracks variables that map to on-chain balances, ensuring that any logic executing a manual subtraction on account balances is verified against close authority structures.

---

## 5. Shared Security Engine Architecture

The Security Engine runs inside the compiler-free pipeline, integrated alongside the existing layout diff engine.

```
       Source AST / IDL ──► Symbol Table & Type Registry
                                   │
                                   ▼
                       Control Flow Graph (CFG)
                                   │
                                   ▼
                        Rule Execution Pipeline
                ┌──────────────────────────────────────┐
                │ 1. OwnershipValidationRule           │
                │ 2. MissingSignerRule                 │
                │ 3. ReinitializationRule              │
                │ 4. CloseAuthorityRule                │
                └──────────────────────────────────────┘
                                   │
                                   ▼
                         Severity & Policy Filter
                         (Respects epic.toml)
                                   │
                                   ▼
                       JSON / SARIF / CLI Output
```

### Rule Abstraction Interface
All security rules implement the `SecurityRule` interface:

```typescript
export interface SecurityRule {
  id: string;
  name: string;
  defaultSeverity: "CRITICAL" | "MAJOR" | "MINOR" | "LOW";
  
  evaluate(
    ast: ProgramAST,
    typeRegistry: TypeRegistry,
    cfg: ControlFlowGraph
  ): SecurityFinding[];
}

export interface SecurityFinding {
  ruleId: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "LOW";
  message: string;
  filePath: string;
  startLine: number;
  endLine: number;
  contextSnippet: string;
}
```

### Rule Execution Pipeline
1.  **AST Parsing & Type Mapping**: The Rust `parser-v2` generates structural AST nodes. The parser compiles a unified type registry containing custom struct sizes, lifetimes, and enum specifications.
2.  **Control Flow Graph (CFG) Generation**: The engine builds a localized CFG for each instruction function to trace variable usage, guard conditions, and mutation blocks.
3.  **Rule Execution**: Rules run in parallel across the CFG and AST trees.
4.  **Policy Evaluation**: Results are passed to the override resolution system, filtering alerts according to `epic.toml`.

### Integration with `epic.toml`
Security rules can be customized, disabled, or overridden under a new `[security]` configuration block:

```toml
[security]
fail_on_ruleset = "MAJOR"
disable_rules = ["EPIC-SEC-004"] # Disables Close Authority checks if desired

[security.overrides]
# Downgrade a specific finding with mandatory audit log note
"EPIC-SEC-001" = { action = "downgrade", severity = "MINOR", note = "Ownership check is executed via custom upstream macro check_admin_owner" }
```

---

## 6. SARIF Architecture

To integrate seamlessly with GitHub Advanced Security code scanning, EPIC outputs warnings in the **SARIF (Static Analysis Results Interchange Format) v2.1.0** format.

### Rule Metadata Model

Each rule maps to a static metadata profile:

| Rule ID | Rule Name | Description | Default Severity |
| :--- | :--- | :--- | :--- |
| **EPIC-SEC-001** | `OwnershipValidation` | Writable account modified without owner validation check. | `CRITICAL` |
| **EPIC-SEC-002** | `MissingSigner` | Privileged operation missing signer constraint verification. | `CRITICAL` |
| **EPIC-SEC-003** | `Reinitialization` | State account susceptible to reinitialization attacks. | `MAJOR` |
| **EPIC-SEC-004** | `CloseAuthority` | Account closed without authority verification. | `MAJOR` |

### SARIF Schema Mapping

The generated SARIF report matches the standard structure:

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemavl/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "EPIC Security Engine",
          "version": "0.1.0",
          "rules": [
            {
              "id": "EPIC-SEC-001",
              "name": "OwnershipValidation",
              "shortDescription": {
                "text": "Missing owner check on mutable account"
              },
              "defaultConfiguration": {
                "level": "error"
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "EPIC-SEC-001",
          "message": {
            "text": "Account 'user_state' is mutably modified without verifying that the owner is the executing program ID."
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "programs/my-program/src/lib.rs"
                },
                "region": {
                  "startLine": 45,
                  "startColumn": 9,
                  "endLine": 48,
                  "endColumn": 10
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### GitHub Security Tab Integration
When the GitHub Action runs, it checks for the presence of the security findings:
1.  Writes the report to `epic-results.sarif`.
2.  Uploads the file to GitHub using the `github/code-scanning/upload-sarif` action.
3.  Vulnerabilities appear directly under the **Security -> Code scanning** alerts tab, with inline comments highlighting the offending code lines inside pull requests.

---

## 7. Historical Validation Plan

To ensure high confidence and prevent regressions, the rules are validated against historical vulnerabilities in real Solana programs.

### 1. Ownership Validation Rule (`EPIC-SEC-001`)
*   **Historical Exploit**: Cashio (Fake Collateral Mint)
*   **Vulnerability Pattern**: Program processes an account's data buffer without checking if `account.owner == &spl_token::ID`.
*   **Test Case Code**:
    ```rust
    pub fn deposit_collateral(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let mint_info = &ctx.accounts.collateral_mint;
        // Read mint data without checking mint_info.owner
        let mint = Mint::unpack(&mint_info.data.borrow())?;
        Ok(())
    }
    ```
*   **Success Criteria**: EPIC flags the instruction as `CRITICAL` vulnerability `EPIC-SEC-001` at the point of `unpack`.

### 2. Missing Signer Rule (`EPIC-SEC-002`)
*   **Historical Exploit**: Crema Finance (Missing Signer Verification)
*   **Vulnerability Pattern**: Comparison of account key with owner address without validating `is_signer`.
*   **Test Case Code**:
    ```rust
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        if state.admin != *ctx.accounts.admin_info.key {
            return err!(ProgramError::InvalidArgument);
        }
        // Mutates state, but admin_info.is_signer is never validated
        state.admin = *ctx.accounts.new_admin.key;
        Ok(())
    }
    ```
*   **Success Criteria**: EPIC flags the code block as a `CRITICAL` missing signer issue `EPIC-SEC-002`.

### 3. Reinitialization Protection Rule (`EPIC-SEC-003`)
*   **Historical Exploit**: Dynamic PDA initialization overlaps
*   **Vulnerability Pattern**: Manual writing of state structs without asserting that a state discriminator or initializer flag has already been set.
*   **Test Case Code**:
    ```rust
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        // Write state fields directly without checking if state.is_initialized == true
        state.is_initialized = true;
        state.vault = ctx.accounts.vault.key();
        Ok(())
    }
    ```
*   **Success Criteria**: EPIC flags the write instruction as a `MAJOR` security hazard `EPIC-SEC-003`.

### 4. Close Authority Rule (`EPIC-SEC-004`)
*   **Historical Exploit**: Solana Account Drainer
*   **Vulnerability Pattern**: Unrestricted reallocation and transfer of lamports.
*   **Test Case Code**:
    ```rust
    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let dest = &ctx.accounts.destination;
        // Drains lamports to destination but fails to verify close authority check against program config admin
        **dest.lamports.borrow_mut() += **vault.lamports.borrow();
        **vault.lamports.borrow_mut() = 0;
        Ok(())
    }
    ```
*   **Success Criteria**: EPIC detects the transfer and flags it as a `MAJOR` close authority hazard `EPIC-SEC-004`.

---

## 8. Implementation Roadmap

The development of the Security Engine is broken into four iterative engineering sprints:

### Task 1: Semantic AST Mapping & Control Flow Graph Builder
*   **Objective**: Implement localized Control Flow Graph (CFG) parsing in the Rust parser-v2 crate. Update the TS parser engine to map expression blocks to execution paths.
*   **Effort Estimate**: 8 Days (Complexity: High)
*   **Key Deliverable**: A compiler-free CFG structure showing variable execution paths for every instruction.

### Task 2: Core Rule Implementation (Rules 001 - 004)
*   **Objective**: Implement the four key analysis rules matching the specified AST conditions, type registry validations, and control-flow checks.
*   **Effort Estimate**: 10 Days (Complexity: Medium-High)
*   **Key Deliverable**: Rust and TS rule runners producing intermediate JSON findings.

### Task 3: Configuration & Policy Filter
*   **Objective**: Integrate the findings filter into the `epic.toml` parser, supporting rule silencing, severity adjustments, and validation checks.
*   **Effort Estimate**: 4 Days (Complexity: Low)
*   **Key Deliverable**: Configuration validation parser enforcing override security restrictions.

### Task 4: SARIF Reporter & CI Action Upgrade
*   **Objective**: Build the SARIF v2.1.0 output formatter and upgrade `@epic/github-action` to handle uploading SARIF artifacts to GitHub.
*   **Effort Estimate**: 5 Days (Complexity: Medium)
*   **Key Deliverable**: Fully integrated GitHub Security tab scanning pipeline.
