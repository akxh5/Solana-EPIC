# EPIC Test Matrix

This matrix charts the verified test coverage (Unit, Integration, End-to-End, and Real Repository) for every EPIC subsystem based on files present in `tests/` directories.

| Subsystem | Exists | Unit Tested | Integration Tested | End-to-End Tested | Real Repository Tested | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Layout Diff Engine** | TRUE | TRUE | TRUE | TRUE | TRUE (git diffs) | 10/10 |
| **Parser v2** | TRUE | TRUE | TRUE | TRUE | TRUE (git diffs) | 10/10 |
| **Parser v3 Extensions** | TRUE | TRUE | FALSE | FALSE | FALSE | 8/10 |
| **AST Engine** | TRUE | TRUE | FALSE | FALSE | FALSE | 9/10 |
| **Type Inference** | TRUE | TRUE | FALSE | FALSE | FALSE | 8/10 |
| **Generic Unpacker** | TRUE | TRUE | FALSE | FALSE | FALSE | 8/10 |
| **CFG Builder** | TRUE | TRUE | FALSE | FALSE | FALSE | 8/10 |
| **Try Expansion** | TRUE | TRUE | FALSE | FALSE | FALSE | 8/10 |
| **SSA-lite** | TRUE | TRUE | FALSE | FALSE | FALSE | 9/10 |
| **Dominance Engine** | TRUE | TRUE | FALSE | FALSE | FALSE | 8/10 |
| **GuardFacts** | TRUE | TRUE | FALSE | FALSE | FALSE | 9/10 |
| **Anchor Constraint Parser** | TRUE | TRUE | FALSE | FALSE | FALSE | 9/10 |
| **Rule Engine** | TRUE | TRUE | FALSE | FALSE | FALSE | 9/10 |
| **EPIC-SEC-001 Owner Check**| TRUE | TRUE | FALSE | FALSE | FALSE | 8/10 |
| **SARIF Components** | FALSE | FALSE | FALSE | FALSE | FALSE | 0/10 |
| **CLI Layer** | TRUE | TRUE | FALSE | FALSE | FALSE | 7/10 |
| **GitHub Action Layer** | TRUE | TRUE | FALSE | FALSE | FALSE | 8/10 |

---

## Matrix Analysis & Findings

1. **Unit Testing Breadth**: Excellent unit testing coverage is present across all core compiler modules inside the Rust `parser-v2` package (totaling 42 tests passing cleanly).
2. **Integration / E2E Testing Gap**: Security rules (Rule Engine, EPIC-SEC-001) are exclusively covered by programmatic synthetic unit mockups inside `rules_tests.rs`. There is zero integration or end-to-end testing running security checks against full workspace directories, Anchor targets, or CLI commands.
3. **Real Repository Verification Gap**: The only real repository integration tests are limited to layout change evaluations inside `validation_harness.rs` (checking drift, marginfi, and squads layout sizes via git histories). No real repositories have been checked using the security rule analysis blocks.
4. **Missing SARIF Coverage**: Since SARIF logic does not exist, it has zero test representation.
