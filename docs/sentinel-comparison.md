# EPIC VS ANCHOR SENTINEL COMPARISON

This report compares **Google Antigravity EPIC** against the community standard **Anchor Sentinel (v0.5.0)** static analysis tool.

---

## Comparison Matrix

| Metric / Dimension | Anchor Sentinel (v0.5.0) | Google Antigravity EPIC (0.4.0) |
| :--- | :--- | :--- |
| **Dependency Requirements** | High. Requires `Anchor.toml` and compiled `target/idl/*.json` build outputs. | Low. Scans raw Rust AST directly, compiling CFGs without build outputs. |
| **Robustness / Crash Risk** | **Critical Failure**. Crashes on standard v30/v31 IDLs due to a deserializer type mismatch. | High. Unified `ProgramIr` normalizes legacy and modern IDLs safely. |
| **Path / Repo Sensitivity** | High. Fails to parse Rust AST if folder structure deviates from standard layout. | Low. WalkDir recursively builds complete module graph across files. |
| **Rule Coverage** | Broad (14 active rules covering Signer, Rent, PDA, integer casts, etc.). | Narrow (1 active rule: EPIC-SEC-001 Owner Validation). |
| **Boxed Account Handling** | **Excellent**. Resolves validation via IDL definitions correctly. | **Poor (FP)**. Fails to unpack `Box<Account<'info, T>>`, causing false positives. |
| **Native Program Support** | None (analyzes 0 instructions). | None (analyzes 0 instructions). |
| **Runtime (Small Repo)** | < 10ms | ~50ms |
| **Runtime (Drift-v2 / Large)** | Crash / Failed Execution | 3.21s (Successfully Scanned) |

---

## Detailed Comparative Analysis

### 1. Robustness & Deserialization Errors
* **Sentinel**: Sentinel crashes with `error: parsing IDLs: deserializing IDL (v29) ...: invalid type: map, expected a string` on standard Anchor workspaces (like Drift, Mango, or token-metadata). It assumes type references are always strings, making it fail on modern type representations.
* **EPIC**: EPIC’s typescript IDL layer handles modern and legacy variations safely by standardizing all inputs into a unified `ProgramIr`.

### 2. Scanning Execution and False Positives
* **Sentinel**: Sentinel scanned `fixtures/safe_program` and generated a false positive `missing_ownership` error because the files were not in `programs/*/src/lib.rs`. It analyzed `0 files`, failed to parse the AST, and assumed the account was unvalidated.
* **EPIC**: EPIC successfully walks any arbitrary directory, reads all `.rs` files, builds the complete AST, and correctly recognizes `Account<'info, T>` wrappers to emit 0 findings for safe code.

### 3. Boxed Account Support (Sentinel Advantage)
* **Sentinel**: Because Sentinel relies on compiled IDLs, it reads account types directly from the IDL (where boxing is stripped out). It correctly ignores boxed accounts.
* **EPIC**: EPIC parses the Rust code directly. Because it does not recursively unpack `Box<T>`, it flags `Box<Account<'info, T>>` as an unvalidated raw type, yielding a high number of false positives (31 warnings in Drift).

---

## Verdict
* **Anchor Sentinel** is a fast metadata-based linter that is heavily restricted by rigid structure requirements and is currently broken on standard modern IDLs.
* **EPIC** is a far more advanced semantic compiler scanner, but its rule coverage is narrow and it suffers from false positives on boxed variables.
