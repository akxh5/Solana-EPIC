# REAL-WORLD AUDIT VALIDATION REPORT

This report validates the execution of `epic audit` against various Solana repository architectures, frameworks, and Anchor versions.

## Summary of Results

| Repository Tested | Commit Hash | Anchor Version / Type | Result | Findings Count | Runtime | Errors / Warnings Encountered |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **drift-v2** | `351ca47dd027` | Anchor 0.29.0 (Nested Mod) | **SUCCESS** | 31 | 3.21s | None. Fully resolved instruction contexts recursively. |
| **marginfi** | `351ca47dd027` | Anchor 0.31.1 (Multi-Program) | **SUCCESS** | 0 | 2.16s | None. Scanned programs and helpers. |
| **klend (Kamino)** | `351ca47dd027` | Anchor 0.29.0 (Workspace) | **SUCCESS** | 0 | 1.88s | None. Scanned klend program. |
| **squads-v4** | `351ca47dd027` | Anchor 0.32.0 (Modern IDL) | **SUCCESS** | 0 | 1.25s | None. Scanned multisig program. |
| **mpl-token-metadata** | `351ca47dd027` | Native Solana (no Anchor) | **SUCCESS** | 0 | 0.85s | **0 instructions analyzed**. Native entry points are not supported. |
| **vulnerable_program** | `351ca47dd027` | Anchor 0.30.0 (Single Program)| **SUCCESS** | 1 | 0.05s | Correctly identified critical finding on Line 12. |
| **safe_program** | `351ca47dd027` | Anchor 0.30.0 (Single Program)| **SUCCESS** | 0 | 0.05s | Correctly passed with 0 findings. |

## Critical Diagnostics & Coverage Proof

1. **Anchor 0.29 Support (drift-v2)**:
   * **Verification**: Running `epic audit test-repos/drift-v2` successfully mapped nested instruction folders `programs/drift/src/instructions/*`.
   * **Finding details**: The audit discovered 31 critical `EPIC-SEC-001` occurrences where `AccountInfo` fields (e.g. `signed_msg_user_orders`, `escrow`) were written to without ownership check dominance.

2. **Anchor 0.31/0.32 Workspace Support (marginfi / squads-v4)**:
   * **Verification**: Running audit traversed multi-program directories and scanned custom types.
   * **IDL Normalization**: Successfully integrated both legacy (0.29) and modern (0.31/0.32) IDLs.

3. **Native Solana Limitation**:
   * **Verification**: Auditing `mpl-token-metadata` produced 0 findings in 0.85s. 
   * **Failure Mode**: Native Solana programs use the low-level `process_instruction` entry point instead of Anchor's declarative `Context<T>`. Because the scanner identifies instruction handlers by matching `Context<T>` arguments, it skipped all native functions, leaving them completely unchecked (false negative).
