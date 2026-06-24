# EPIC

<p align="center">
  <b>Security-First Upgrade Intelligence for Solana Programs</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@solana-epic/cli"><img src="https://img.shields.io/npm/v/@solana-epic/cli.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/akxh5/Solana-EPIC.svg?style=flat-square" alt="license" /></a>
  <a href="https://github.com/akxh5/Solana-EPIC/releases"><img src="https://img.shields.io/github/v/release/akxh5/Solana-EPIC.svg?style=flat-square&color=orange" alt="GitHub release" /></a>
  <a href="https://github.com/akxh5/Solana-EPIC/actions"><img src="https://img.shields.io/github/actions/workflow/status/akxh5/Solana-EPIC/ci.yml?branch=main&style=flat-square" alt="GitHub Actions status" /></a>
</p>

---

EPIC protects Solana protocol teams from shipping breaking program upgrades and security vulnerabilities. By performing static syn-compiler audits of state layouts, ABI changes, and account validation rules, EPIC ensures your upgrades are safe before code ever reaches mainnet.

---

## Why EPIC Exists

Every Solana upgrade introduces risk. A seemingly harmless change can:
*   **Break account layouts** and corrupt deserialization layouts on mainnet.
*   **Introduce critical security vulnerabilities** in modified instruction paths.
*   **Create upgrade incompatibilities** that block protocol operations.
*   **Open memory/realloc attack vectors** due to unintended account shrinkage.

Most teams discover these issues during post-mortem investigations or expensive auditing cycles. **EPIC catches them at compile time, in local development, and on every pull request.**

---

## What EPIC Does

### 1. Upgrade Intelligence (`epic check`)
Compare two program versions and understand exactly what changed in state and serialization layouts.
```
$ epic check ./old-program ./new-program

🔍 Comparing Program Layouts...
[CRITICAL] Layout size decrease detected on struct Position: 56 bytes -> 48 bytes.
           Account shrinkage can lead to runtime deserialization failures.
           Consider using realloc or adding padding fields to preserve layout sizing.
```

### 2. Security Auditing (`epic audit`)
Run static security rules against your codebase. EPIC analyzes compile-time semantic constraints on instruction structures to enforce correct program policies.
```
$ epic audit .

🔍 Auditing Security Invariants...
[CRITICAL] EPIC-SEC-003: Missing Post-CPI Account Reload
           Affected File: programs/vault/src/lib.rs:42
           Context: State mutation of Vault account following CPI invocation
           Recommendation: Reload local state cache (e.g., run vault.reload()?) after CPI.
```

### 3. Account Intelligence (`epic analyze`)
Analyze state account layouts and serialized sizes to manage state growth impact.
```
$ epic analyze .

🔍 Analyzing State Account Layouts...
STATE ACCOUNTS:
├── Vault (49 bytes) [program::lib] [Static]
└── Position (56 bytes) [program::lib] [Static]
```

---

## Installation

Install the CLI globally:
```bash
npm install -g @solana-epic/cli
```

Verify your installation:
```bash
epic rules
```

---

## Quick Start

### 1. Run a Security Scan
Scan your active directory for vulnerabilities:
```bash
epic audit .
```

### 2. Verify Upgrade Safety
Compare a previous commit/version against your new modifications:
```bash
epic check ./old_program_dir ./new_program_dir
```

### 3. Integrate with GitHub PRs (CI/CD)
EPIC fully supports the Static Analysis Results Interchange Format (SARIF) JSON schema. Add this step to your GitHub Actions workflow:
```yaml
- name: Run EPIC Security Audit
  run: npx @solana-epic/cli audit . -f sarif

- name: Upload SARIF Report
  uses: github/code-scanning-upload-aurora@v2
  with:
    sarif_file: sarif.json
```

---

## Security Rules

EPIC parses Rust source code directly to enforce the following security invariants:

| Rule ID | Name | Severity | Description |
| :--- | :--- | :--- | :--- |
| **EPIC-SEC-001** | Owner Validation | Critical | Ensures mutable account write paths are guarded by ownership checks (`account.owner == program_id`). |
| **EPIC-SEC-002** | Signer Validation | Critical | Verifies privileged mutations check signer authority. |
| **EPIC-SEC-003** | Missing Post-CPI Reload | Critical | Flags reads/writes on stale deserialized state cached before a mutating CPI. |
| **EPIC-SEC-004** | PDA Seed Collision Risk | High | Identifies adjacent variable-length seeds lacking delimiters that could cause derivation collision. |
| **EPIC-SEC-005** | Arbitrary CPI Targets | Critical | Flags CPIs targeting dynamic program IDs without validations. |

To understand a finding in detail, run:
```bash
epic explain EPIC-SEC-001
```

---

## Architecture Overview

EPIC compiles Solana Rust ASTs directly into control-flow models and evaluates security invariants across the following unified pipeline:
```
Source Code ➔ Rust AST Parser ➔ Type Registry ➔ CFG Builder ➔ SSA Engine ➔ Dominance Tree ➔ GuardFacts IR ➔ Rules Analyzer
```
For a deep dive into the compiler and engine architecture, see [docs/architecture.md](docs/architecture.md).

---

## Roadmap

*   **Additional security rules**: Expanding invariant check coverage (EPIC-SEC-006+).
*   **IDL-aware upgrade analysis**: Compare layouts via IDL definitions.
*   **LSP integration**: Real-time editor diagnostics.
*   **Automated remediation**: Suggesting safe code replacements for audit findings.

---

## Contributing

We welcome contributions to EPIC! See [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, package structure, and submission guidelines.

---

## License

EPIC is open-source developer tooling licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
