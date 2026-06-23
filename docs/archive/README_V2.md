# EPIC: Engineering Platform for Intelligent Contracts

EPIC is a deterministic static analysis platform designed to verify layout offset compatibility and prevent account deserialization crashes during Solana program upgrades. By statically evaluating Rust ASTs and Anchor IDL definitions, EPIC acts as a fail-closed gate in your CI/CD pipeline, blocking upgrades that introduce layout drift before they reach mainnet.

---

## The Solana Upgrade Problem

In account-based runtimes like Solana, smart contract state is stored on-chain as flat, unaligned byte arrays. Unlike EVM storage layouts that map variables dynamically to keys or storage slots via hashing, Solana state structures rely strictly on static byte offsets. When a program reads an account, it deserializes the entire byte stream sequentially using Borsh (Binary Object Representation Serializer for Hashing).

Because of this runtime architecture, upgrades are exceptionally high-risk:
*   **Offset Shifts**: Swapping the order of fields, inserting a field in the middle of a struct, or changing a field type width (e.g., `u64` to `u32`) shifts the offsets of all trailing fields. Any attempt to read existing on-chain accounts with the upgraded program will fail to deserialize, **instantly bricking the program and freezing user assets**.
*   **The Realloc Trap**: Adding a field at the end of a struct is structurally safe (as it preserves prior offsets), but executing writes to it will crash at runtime unless the account is explicitly resized via `realloc` and funded for rent exemption.

EPIC solves this by providing **deterministic, compile-free verification** of structural layouts, mapping differences to concrete risk levels.

---

## What EPIC Does

EPIC is a specialized upgrade safety platform. Below is the breakdown of its current capabilities, limitations, and future direction.

### What EPIC Does Today

We group EPIC's capabilities into five logical categories:

#### 1. Upgrade Analysis
Statically parses Rust source directories and Anchor IDL definitions to map state struct fields, types, and byte sizes.
*   *Why it matters*: Eliminates the need to run local cargo builds or local test validator networks to extract account layout structures.
*   *Who benefits*: Core protocol developers and CI runner nodes requiring rapid validation feedback without compilation overhead.

#### 2. Layout Compatibility
Compares old and new account layouts to calculate byte offset drift, field order swaps, and size deltas.
*   *Why it matters*: Automatically identifies offset shifts that would cause Borsh deserialization crashes on-chain.
*   *Who benefits*: Security auditors and release engineers staging upgrades for production environments.

#### 3. CI/CD Enforcement
Runs as a blocking exit gate inside pull request pipelines, failing builds if layout differences exceed risk thresholds.
*   *Why it matters*: Prevents manual layout check omissions from slipping into release branches.
*   *Who benefits*: Core protocol maintainers managing multi-signature release workflows.

#### 4. Verification & Reporting
Generates upgrade readiness reports containing detailed tables, risk severities, and markdown banners.
*   *Why it matters*: Translates raw layout difference indices into clear, actionable advice for protocol developers.
*   *Who benefits*: Protocol leads and DAO members reviewing upgrade proposals.

#### 5. Configuration & Policy
Supports auditable rules inside `epic.toml` to mute minor alerts while keeping critical safety rules unbreakable.
*   *Why it matters*: Eliminates compiler noise in development while enforcing zero-bypass limits on dangerous upgrades.
*   *Who benefits*: Release engineers tuning CI pipelines for active codebases.

---

### What EPIC Does NOT Do

EPIC is a specialized layout verification tool. It is not designed to replace other security tooling:
*   **No Fuzzing**: EPIC does not execute transaction fuzzing or generate random input transactions against program entrypoints. Use tools like `trident` or `jito-solana` test suites for fuzz testing.
*   **No Runtime Simulation**: EPIC is a static verifier. It does not spin up testnets or execute bytecode on simulated Solana runtimes (e.g., `solana-program-test` or `bankrun`) during checks.
*   **No Business Logic Auditing**: EPIC evaluates layout sizes and offsets. It cannot detect mathematical overflow errors, flash loan vulnerabilities, or authorization omissions.
*   **No Dependency Scanning**: EPIC does not inspect your Cargo dependency tree for supply chain exploits, out-of-date crates, or malicious libraries. Use `cargo-audit` for dependency audits.
*   **No Full Security Auditing**: EPIC is a pipeline guard, not a replacement for manual smart contract reviews.

---

### What EPIC May Do in the Future (Roadmap)

The following items are accepted as future work (Phase 2 & Phase 3):
*   **Auto-generation of `realloc` instructions** based on account size shifts.
*   **Validation check suggestions** for default-values initialization scripts.
*   **Automatic verification of program account sizes** against live on-chain data before release deployment.
*   **Leader pre-flight deployment checks** integrated into Solana deployment CLI tools.

---

## Example Upgrade Failures

Solana's production history contains several upgrade mistakes that EPIC is designed to detect:

*   **Field Insertion (e.g., Squads Multisig `rent_collector` insertion):** 
    Inserting a new field in the middle or front of a struct shifts the offset of every single subsequent field. When the upgraded program attempts to load an existing account, it deserializes the new field from the bytes previously belonging to other variables, leading to state corruption and deserialization failure.
*   **Padding Repurposing (e.g., Marginfi Bank Padding):** 
    Repurposing raw padding fields (e.g., `[u8; 32]`) into structured fields can be safe, but resizing or misaligning them shifts subsequent offsets, triggering a major layout mismatch.
*   **Type Width Shrinking (e.g., Mango Sequence Number):** 
    Shrinking a field type (e.g., changing a sequence number from `u64` to `u32`) changes the struct's byte width, shifting all trailing offsets by 4 bytes and causing deserialization to fail on existing accounts.
*   **Trailing Append without Realloc (e.g., Drift Max Margin Ratio):** 
    Appending a field to the end of a struct preserves prior offsets, but any write instruction that attempts to store the expanded struct into an existing account will crash at runtime with an `AccountDataTooSmall` error unless the account size is explicitly expanded via `realloc`.

---

## How EPIC Works

EPIC processes layout upgrades through a structured evaluation pipeline:

```
          Source Code (Rust ASTs or Anchor IDLs)
                         │
                         ▼
                     AST Parser
      (Scans structs, parses fields recursively,
            calculates byte layout offsets)
                         │
                         ▼
                 Layout Comparator
    (Aligns matching accounts across versions,
         evaluates relative field indices)
                         │
                         ▼
                  Severity Engine
     (Maps differences to SAFE / MINOR / MAJOR /
                    CRITICAL)
                         │
                         ▼
                 Override Resolver
    (Applies epic.toml rules, blocks wildcards,
             validates audit note length)
                         │
                         ▼
               GitHub Action / CLI Report
    (Outputs status table, warning logs, exit code)
```

---

## Features Matrix

The following table lists the capabilities implemented and production-ready in the current release:

| Feature | Description | Implemented | Production Ready |
| :--- | :--- | :---: | :---: |
| **Rust Source Parsing** | Walks source trees to parse brace-delimited structs, ignoring attributes and comments. | Yes | Yes |
| **Recursive Custom Types** | Walks source trees to build a type registry and resolve nested helper structs. | Yes | Yes |
| **Lifetimes & Generics** | Extracts struct definitions with lifetime tags (`<'info>`), generic bounds (`<T>`), and `where` clauses. | Yes | Yes |
| **Multiline Attributes** | Parses fields without skipping variables that use multiline macros or annotations. | Yes | Yes |
| **Anchor IDL Parsing** | Loads and recursively parses defined types, structs, and enums from IDL JSONs. | Yes | Yes |
| **Enum Sizing Logic** | Identifies varying enum variant payload sizes and flags them as dynamically sized. | Yes | Yes |
| **Field Reorder Checks** | Detects field swaps inside a struct regardless of whether variables are added or removed. | Yes | Yes |
| **Offset Shift Detection** | Differentiates trailing appends (MAJOR) from middle field insertions (CRITICAL). | Yes | Yes |
| **epic.toml Validation** | Enforces note audits, rejects wildcard overrides (`*`), and blocks critical mutes. | Yes | Yes |
| **Local Pack & Install** | Bundles workspaces to `.tgz` files and executes isolated installation verifications. | Yes | Yes |
| **GitHub Action PR Comments**| Renders status banners, summary tables, and overrides active lists on PR runs. | Yes | Yes |

---

## Why EPIC Exists

*   **Why doesn’t Anchor catch this?** Anchor maps your structures to IDL JSONs, but it does not track historical layouts or alert you when a modification in your current code breaks deserialization compatibility with accounts deployed on-chain.
*   **Why doesn’t Solana Verify catch this?** `solana-verify` proves that the bytecode of a compiled file matches the source code repository. It does not evaluate state account offset structures against prior production builds.
*   **Why isn’t CI enough?** Rust unit tests run on clean memory states and compile-time allocations. They do not simulate reading historical serialized account bytes on-chain unless developers manually mock prior raw byte buffers for every test.
*   **Why do protocol teams still get upgrade risk?** Because manual layout checks are prone to human error. During active development, refactoring a struct by adding a field in the middle or changing a type width is easy to commit, but fatal if merged.

---

## Historical Validation

EPIC is evaluated against a historical test suite of 15 real-world upgrades from 5 major Solana protocols:

*   **Squads**: Validated multisig structural changes (e.g., `rent_collector` insertion) and new account additions.
*   **MarginFi**: Validated bank allocation limits, padding repurposing, and Oracle enum additions.
*   **Drift**: Validated isolated positions and margin configuration updates.
*   **Kamino**: Validated reward layout sizing shifts.
*   **Mango**: Validated collateral fee insertions and type width shrinking.

### Performance Results
*   **Total Historical Upgrades Evaluated**: 15
*   **Successful Classifications**: 15
*   **Classification Accuracy**: **100.00%** (15/15 classifications matched actual outcomes)
*   **False Positives**: 0
*   **False Negatives**: 0
*   **Confidence**: 100% (AST Determinism)

---

## Installation

### From npm Registry (Release)
Install the CLI globally on your system:
```bash
npm install -g @epic/cli
```

### Local Tarball Installation (Beta Verification)
To install EPIC in an isolated sandbox for testing:
```bash
# Clone the repository and build typescript packages
git clone https://github.com/solana-epic/epic.git
cd epic
npm install && npm run build

# Package workspaces to tgz files
node scripts/package-local.mjs

# Install in your target directory
cd /path/to/my-program
npm install \
  "<path_to_epic>/artifacts/local-packages/epic-parser-0.1.0-beta.1.tgz" \
  "<path_to_epic>/artifacts/local-packages/epic-diff-engine-0.1.0-beta.1.tgz" \
  "<path_to_epic>/artifacts/local-packages/epic-cli-0.1.0-beta.1.tgz" \
  "<path_to_epic>/artifacts/local-packages/epic-cli-<platform>-0.1.0-beta.1.tgz" \
  --force
```

---

## CLI Usage

### `epic analyze`
Scans a Rust source file, directory, or IDL JSON and prints state account byte sizes:
```bash
epic analyze ./programs/my-program
```
*Output Example:*
```plaintext
🔍 Analyzing Solana Program Workspace: ./programs/my-program
Found 2 structs, 0 enums, 0 aliases.

STATE ACCOUNTS:
├── Position (56 bytes) [program::lib] [Static]
└── Vault (49 bytes) [program::lib] [Static]
```

### `epic check`
Compares old and new program directories or IDL JSONs and reports layout drift:
```bash
epic check ./path-to-old ./path-to-new [--config ./epic.toml]
```

*Output Example (CRITICAL Block):*
```plaintext
🔍 EPIC Layout Compatibility Report
Comparing: ./path-to-old -> ./path-to-new

[Position] CRITICAL: FIELD_REORDERED
  - Persisted field order changed.
  - Size impact: 56 bytes -> 56 bytes

❌ EPIC Guard Blocked: Upgrade severity is CRITICAL (threshold: CRITICAL).
```

---

## GitHub Action

Integrate EPIC into your pull request workflows by entering the following configuration in `.github/workflows/epic.yml`:

```yaml
name: EPIC Upgrade Guard
on:
  pull_request:
    branches: [ main ]

jobs:
  epic_guard:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      
      - name: Run EPIC Guard
        uses: solana-epic/github-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          old_path: './idl/old_idl.json'
          new_path: './idl/new_idl.json'
          fail_on_severity: 'CRITICAL'
```

---

## `epic.toml` Configuration

Configure workspace thresholds and program overrides inside `epic.toml`:

```toml
[workspace]
compare_mode = "ast"
fail_on_severity = "MAJOR"
rpc_url = "https://api.mainnet-beta.solana.com"
exclude_paths = ["**/tests/**", "**/mocks/**"]
enforce_padding = true

[programs]
marginfi = { path = "./programs/marginfi", id = "MFv28xrwG2k1GZnhwYhcz1GL9G7gW4mh99PP5zER6NL" }

[[programs.marginfi.overrides]]
account = "Bank"
finding = "FIELD_ADDED"
field = "new_risk_parameter"
action = "downgrade"
severity = "SAFE"
note = "Verified Bank state has 256 bytes of unallocated headroom space. Adding trailing field is safe."
```

### Security Policy Rules for Overrides

To prevent developers from accidentally muting dangerous upgrades, the parser enforces the following rules at runtime:
1.  **No Wildcards (`*`)**: Overrides must specify exact account, finding, and field names. Wildcards are rejected.
2.  **Unbreakable Rules (Banned Findings)**: Muting or downgrading `FIELD_REMOVED` or `FIELD_REORDERED` is strictly forbidden. Any override containing these findings will trigger a `SecurityViolationError` and fail the build.
3.  **Auditable Notes**: Every override must contain a `note` of at least 10 characters explaining the engineering rationale behind the downgrade. Short or blank notes will fail validation.

---

## Architecture

EPIC is structured as a TypeScript monorepo using npm workspaces and Turborepo:
*   `@epic/cli`: Command-line executable (`epic`) incorporating the platform-specific native binary loader.
*   `@epic/parser`: Configuration validation (`epic.toml`), schema validation (Zod), and Rust AST loaders.
*   `@epic/diff-engine`: Layout comparison, severity evaluation, and override resolution.
*   `@epic/github-action`: CI integration, PR table formatting, and exit gate checker.
*   `@epic/cli-<target>`: Target-specific wrappers (`@epic/cli-darwin-arm64`, `@epic/cli-linux-x64`, etc.) housing the precompiled Rust AST parsing engines (`parser-v2`).

---

## Roadmap

### Phase 2: State Migration Automation
*   **Auto-generation of `realloc` instructions** based on account size shifts.
*   **Validation check suggestions** for default-values initialization scripts.

### Phase 3: SolDeploy Integration
*   **Automatic verification of program account sizes** against live on-chain data before release deployment.
*   **Leader pre-flight deployment checks** integrated into Solana deployment CLI tools.
