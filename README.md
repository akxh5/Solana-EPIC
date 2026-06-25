# EPIC

<p align="center">
  <b>Upgrade Intelligence for Solana Programs</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@solana-epic/cli"><img src="https://img.shields.io/npm/v/@solana-epic/cli.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/solana-epic/epic.svg?style=flat-square" alt="license" /></a>
  <a href="https://github.com/solana-epic/epic/releases"><img src="https://img.shields.io/github/v/release/solana-epic/epic.svg?style=flat-square&color=orange" alt="GitHub release" /></a>
  <a href="https://github.com/solana-epic/epic/actions"><img src="https://img.shields.io/github/actions/workflow/status/solana-epic/epic/test.yml?branch=main&style=flat-square" alt="GitHub Actions status" /></a>
</p>

---

EPIC is the deployment readiness and upgrade intelligence infrastructure for Solana programs. Positioned between git push and mainnet, EPIC evaluates state layout evolution, ABI compatibility, and security regressions to answer a simple question before you deploy:

**"Can this upgrade safely reach mainnet?"**

---

## Why EPIC Exists

Standard developer tooling tells you if your code compiles. Security scanners tell you if a codebase has known vulnerabilities. **Neither tells you if the transition between your old deployment and your new code will break state on mainnet.**

Every Solana program upgrade is a high-risk migration. A minor type shift, field reordering, or missing state reload can corrupt deserialization layouts, lock user accounts, or introduce severe security regressions.

EPIC catches these upgrade compatibility issues and regressions in local development and on every pull request.

---

## What EPIC Does

### 1. Upgrade Compatibility (`epic check`)
Compare two program versions to verify layout compatibility and prevent state corruption.
```
$ epic check ./old-program ./new-program

🔍 Comparing Program Layouts...
[CRITICAL] Layout size decrease detected on struct Position: 56 bytes -> 48 bytes.
           Account shrinkage can lead to mainnet deserialization failures.
           Consider using realloc or adding padding fields to preserve layout sizing.
```

### 2. State Layout Analysis (`epic analyze`)
Track account layout evolution, serialized sizes, and memory offsets to manage state scaling.
```
$ epic analyze .

🔍 Analyzing State Account Layouts...
STATE ACCOUNTS:
├── Vault (49 bytes) [program::lib] [Static]
└── Position (56 bytes) [program::lib] [Static]
```

### 3. Upgrade Safety Verification (`epic audit`)
Verify that modifications to instruction state rules and safety invariants do not introduce security regressions.
```
$ epic audit .

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Security Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Critical ............ 0
High ................ 2
Rules Triggered ..... 1

[CRITICAL] EPIC-SEC-003: Missing Post-CPI Account Reload
           Affected File: programs/vault/src/lib.rs:42
```

### 4. Environment Diagnostics (`epic doctor`)
Automatically verify host prerequisites (Node, Cargo, Rustc) and workspace configurations instantly.
```
$ epic doctor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment Diagnostics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Rust      : rustc 1.89.0
✓ Cargo     : cargo 1.89.0
✓ Node.js   : v24.7.0
✓ Solana    : solana-cli 2.2.12
✓ Anchor    : anchor-cli 0.31.1

✓ parser-v2 : /usr/local/bin/parser-v2
✓ Workspace : Anchor Workspace detected
✓ Config    : Loaded epic.toml successfully
✓ Rules     : 5 safety rules loaded

Ready for Audit
```
---

## Installation

Install the CLI wrapper:
```bash
npm install -g @solana-epic/cli
```

Verify your installation:
```bash
epic rules
```

---

## Quick Start

### 1. Check Upgrade Compatibility
Compare your current working directory against a previous release or program folder:
```bash
epic check ./old_release_dir ./new_release_dir
```

### 2. Run Layout Invariant Verification
Audit your codebase for security regressions before committing:
```bash
epic audit .
```

### 3. Integrate with CI/CD
Incorporate upgrade checks directly into your pull requests. EPIC supports standard SARIF outputs for GitHub Actions integration:
```yaml
- name: Run EPIC Upgrade Checks
  run: npx @solana-epic/cli audit . -f sarif

- name: Upload Safety Report
  uses: github/code-scanning-upload-aurora@v2
  with:
    sarif_file: sarif.json
```

---

## Configuration (`epic.toml`)

Customize EPIC's behavior by placing an `epic.toml` file in your workspace root.

```toml
[epic]
fail_on_severity = "CRITICAL"

[epic.rules]
ignore = [
    "EPIC-SEC-004" # Disable specific rules
]
```

---

## JSON / SARIF Output

For advanced integrations, EPIC can output findings in structured JSON or SARIF formats:
```bash
epic audit . --format json > epic-report.json
epic audit . --format sarif > epic-report.sarif
```
This is ideal for piping output into custom dashboard analytics or enterprise SIEM platforms.

---

## Safety Invariant Rules

EPIC parses Rust source code directly to ensure upgrade changes do not break safety invariants:

| Rule ID | Name | Severity | Description |
| :--- | :--- | :--- | :--- |
| **EPIC-SEC-001** | Owner Validation | Critical | Ensures mutable account write paths are guarded by ownership checks (`account.owner == program_id`). |
| **EPIC-SEC-002** | Signer Validation | Critical | Verifies privileged mutations check signer authority. |
| **EPIC-SEC-003** | Missing Post-CPI Reload | Critical | Flags reads/writes on stale deserialized state cached before a mutating CPI. |
| **EPIC-SEC-004** | PDA Seed Collision Risk | High | Identifies adjacent variable-length seeds lacking delimiters that could cause derivation collision. |
| **EPIC-SEC-005** | Arbitrary CPI Targets | Critical | Flags CPIs targeting dynamic program IDs without validations. |

To inspect a rule's criteria in detail, run:
```bash
epic explain EPIC-SEC-001
```

---

## Architecture Overview

EPIC constructs control-flow representations of program ASTs and diffs state schemas across the following unified pipeline:
```
Source Code ➔ Rust AST Parser ➔ Type Registry ➔ CFG Builder ➔ SSA Engine ➔ Dominance Tree ➔ GuardFacts IR ➔ Rules Analyzer
```
For a deep dive into the compiler and engine architecture, see [docs/architecture.md](docs/architecture.md).

---

## Roadmap

For detailed upcoming features including LSP integration, IDL drift verification, and automatic migration wrappers, view our [Official Roadmap](docs/roadmap.md).

---

## Documentation Reference

Explore our detailed technical guides in the `docs/` directory:
* [CLI Reference](docs/cli-reference.md): Complete list of commands and flags.
* [Configuration](docs/configuration.md): Guide to setting up `epic.toml`.
* [Security Rules](docs/security-rules.md): In-depth explanations of EPIC's safety invariants.
* [Upgrade Safety](docs/upgrade-safety.md): Best practices for managing state drift.
* [Architecture Overview](docs/architecture.md): Internal compiler design and graph engine.

---

## Contributing

We welcome contributions to EPIC! See [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, package structure, and submission guidelines.

---

## License

EPIC is open-source developer tooling licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
