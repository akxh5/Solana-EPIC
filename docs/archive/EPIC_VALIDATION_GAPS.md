# EPIC Validation Gaps & Executive Report

This executive report summarizes the capabilities, validation gaps, implementation metrics, and criticisms of the EPIC static analysis platform.

---

## 1. What can EPIC genuinely demonstrate today?
* **Workspace Upgrade Layout Verification**: End-to-end execution of checking layout upgrades (field additions/removals/size drifts) in git commits using real project histories (Squads, MarginFi, Drift) via the CLI and GitHub Action layers.
* **Rust SSA & Dominance Mappings**: Compiling isolated syntax code blocks to CFGs, tracking versioned variable SSA states, computing IDoms Dominance Trees, and resolving symbol bases.
* **Simulated Security Rules Verification**: Programmatically executing `EPIC-SEC-001` (Owner Validation) inside Rust crate unit tests to identify safe/unsafe write sites and trace transitiveness (WDG).

---

## 2. What features are claimed but not proven?
* **SARIF Integration**: Claimed in specifications as complete, but zero code implementations exist.
* **Workspace Security Audits**: Claimed as a security analysis tool for Solana programs, but the CLI lacks commands to invoke the rules engine.
* **Real Exploit Detection**: EPIC-SEC-001 is claimed to detect the Cashio and Crema exploits, but it has never been run or verified against actual codebase inputs of those programs.

---

## 3. What subsystems are highest risk?
* **SymbolResolver / Write-Dependency Graph (WDG)**: Crucial for security rule precision, but lacks real-world codebase validation. Minor type inference opacity or AST nesting variations could easily bypass resolver lookup keys.
* **Type Inference Engine**: Defaults to `Inconclusive` on nested method calls and complex macro allocations, leading to excessive false positives or fail-closed alarms.

---

## 4. What must be fixed before EPIC-SEC-002 begins?
1. **CLI & Cargo Integration**: Create a subcommand (e.g. `epic audit`) to run the security rules check against actual workspaces.
2. **Real-World Vuln Corpus Testing**: Run EPIC-SEC-001 against real-world Solana program commits to assert accuracy and tune resolver path mappings.
3. **SARIF Output implementation**: Implement the JSON output format according to the specification.

---

## 5. What would a Grant Reviewer criticize today?
* "The project claims to be a Solana security rules engine, but the CLI and Action layers only verify struct byte layouts. The actual security validation code is unreachable and runs only inside unit tests using mock objects."

---

## 6. What would an Audit Firm criticize today?
* "The rule engine checks for owner validation only on mutable writes. It fails to detect read-only account data poisoning (e.g., config/oracle account spoofing), which was the exact vector of the Cashio and Crema exploits. Transitive read tracking must be implemented."

---

## 7. What is the minimum path to a publicly demoable release?
1. Create a `main.rs` run loop in `packages/parser-v2` that loads a workspace, parses it, runs the rules engine, and prints findings.
2. Integrate the run loop into the TS CLI under `epic audit <path>` command.
3. Run the CLI against a mock vulnerability file to demonstrate detection.

---

## 8. Evidenced-based Project Readiness Metrics

* **IMPLEMENTED**: **85%** (All core parser, AST, CFG, SSA, Dominance, and Rules checks are coded).
* **TESTED**: **60%** (Core parser library is unit tested; CLI and Action layers are tested for upgrade checks; integration tests are missing for security rules).
* **VALIDATED**: **30%** (Upgrade diffing is validated on real histories; security rules are unvalidated on real-world vulns).
* **PRODUCTION READY**: **20%** (Lacks CLI rules runner and has not run against real-world workspaces).
