# EPIC

### Deterministic Solana Upgrade & Security Analysis

EPIC protects Solana protocol teams from shipping breaking program upgrades by performing static compiler audits of state layouts, ABI changes, and account validation rules before code reaches mainnet.

---

## What EPIC Does

EPIC provides deep static analysis of Anchor and Rust-based Solana programs, acting as a fail-closed gate in local development and CI/CD pipelines.

* **Upgrade Safety Analysis**: Prevents state layout drift during program updates by verifying fields are safely appended rather than inserted or reordered.
* **ABI & Layout Validation**: Calculates exact byte serialization offsets (e.g., Borsh) to flag changes in persisted type widths (`u64 -> u32` or field swaps) before deployment.
* **Security Rule Engine**: Evaluates compile-time semantic constraints on instruction structures to enforce correct program policies.
* **Ownership Validation (EPIC-SEC-001)**: Statically tracks mutable account write operations to ensure they are protected by an ownership check (`account.owner == program_id`) that dominates the write path.
* **Signer Validation (EPIC-SEC-002)**: Flags write paths that modify sensitive accounts without verifying they are signed by the appropriate authority.
* **Fail-Closed Analysis**: Evaluates compiler semantics (including try/catch bubbles, early returns, and conditional branch exits) to verify validation paths cannot be bypassed.

---

## Why EPIC Exists

Solana smart contracts operate on flat, sequential byte arrays. Because serialization formats like Borsh deserialize fields sequentially, a seemingly minor shift—such as adding a field in the middle of a struct, reordering two fields, or changing a type's width—shifts the offsets of all trailing data. Any attempt by the upgraded program to read existing on-chain accounts will fail to deserialize, causing instant transaction failures and locking user assets on-chain.

Existing Solana tooling focuses heavily on heuristic pattern matching (regular expressions or AST linters) or runtime validation (integration testing). While useful, linters miss complex aliasing, variable shadowing, or conditional bypasses, and runtime tests only cover paths hit by test inputs.

EPIC solves this by performing **deterministic static analysis**. It does not compile your code or depend on runtime state; instead, it models the control flow and value state of your programs statically to prove safety properties across all executable paths.

---

## Architecture

EPIC achieves high-fidelity analysis by compiling Rust code directly into an abstract model representation, running it through the following pipeline:

```text
       Source Code
            ↓
     Rust AST Parser  (Rust syn-based parser-v2 engine)
            ↓
  Type Inference Engine  (Unpacks nested generics, Option/Vec, aliases)
            ↓
  Control Flow Graph (CFG)  (Resolves execution pathways & try operators)
            ↓
     SSA-Lite Engine  (Tracks variable versioning, aliases, and shadowing)
            ↓
      GuardFacts IR   (Extracts Anchor constraints & checks structurally)
            ↓
   Security Rule Analyzer  (Evaluates dominance trees & Write Dependency Graphs)
            ↓
    CLI / SARIF Output  (Generates findings and CI fail-closed gates)
```

---

## Example Usage

### 1. Analyze State Layout Sizes
Scan a Solana program directory to output its detected state accounts and their serialized byte sizes.
```bash
# Run local analyze command on a program folder
npx tsx packages/cli/src/index.ts analyze packages/parser-v2/tests/fixtures/ Kamino
```

### 2. Compare Program Upgrades
Compare two versions of a program folder or JSON IDL files to verify ABI compatibility.
```bash
# Compare old and new program versions
npx tsx packages/cli/src/index.ts check ./demo-fixtures/old_program ./demo-fixtures/new_program_safe
```

### 3. Run Rule Verification Crate
Run the core parser-v2 test suite to execute 42 compile-free unit/integration validation tests.
```bash
# Run Rust analysis cargo suite
cargo test --manifest-path packages/parser-v2/Cargo.toml
```

---

## Current Capabilities

| Feature | Implemented | In Progress | Planned | Description |
| :--- | :---: | :---: | :---: | :--- |
| **Borsh Size Calculation** | ✅ | | | Computes exact sizes of types, arrays, optionals, and recursive structs. |
| **Layout Swaps & Shrinks** | ✅ | | | Flags field removals, middle-insertions, swaps, and width reductions. |
| **Try Operator Splits** | ✅ | | | Evaluates early exits from `?` operators in CFG construction. |
| **Write-Dependency Tracking** | ✅ | | | Traces mutations through references, borrows, and aliases back to root arguments. |
| **Ownership Check Dominance** | ✅ | | | Asserts that an owner check (`EPIC-SEC-001`) dominates write instructions. |
| **Signer Check Dominance** | | ✅ | | Asserts that authority signature checks (`EPIC-SEC-002`) dominate write instructions. |
| **SARIF Format Exporter** | | | ✅ | Exposes findings in SARIF JSON schema for native GitHub code-scanning integrations. |

---

## Roadmap

* **EPIC-SEC-001 (Owner Validation)**: Finalize transitive Write-Dependency Graph (WDG) propagation to capture mutations on deserialized fields and buffers. (Current Release)
* **EPIC-SEC-002 (Signer Verification)**: Implement signer-check dominance analysis across all instruction entrypoints.
* **SARIF Integration**: Add a command-line format option to write standard SARIF outputs to direct native alerts in GitHub Security tabs.
* **Real Repository Scanning**: Support automated multi-crate cargo workspaces and external dependency layout parsing.
* **Extended Rule Set**: Introduce rules targeting reentrancy vectors, account size overflows, and math underflows.

---

## Repository Structure

EPIC is managed as an NPM workspace containing the following packages under `/packages`:

* [`packages/cli`](file:///Users/aksh/Documents/Solana%20EPIC/packages/cli): Entrypoint of the `epic` command, containing the platform binary loader.
* [`packages/parser`](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser): Handles loading, validation of configuration overrides (`epic.toml`), and project directory discovery.
* [`packages/diff-engine`](file:///Users/aksh/Documents/Solana%20EPIC/packages/diff-engine): Core TypeScript engine evaluating ABI diff results and mapping them to severities.
* [`packages/github-action`](file:///Users/aksh/Documents/Solana%20EPIC/packages/github-action): A GitHub Action wrapper providing pull-request status checks and markdown table reports.
* [`packages/parser-v2`](file:///Users/aksh/Documents/Solana%20EPIC/packages/parser-v2): The core Rust program analyzer parsing Rust ASTs, compiling CFGs, and evaluating dominance rules.

---

## Contributing

We welcome contributions from protocol engineers and tooling developers. To set up your local environment:

1. Clone the repository and install workspace dependencies:
   ```bash
   git clone https://github.com/solana-epic/epic.git
   cd epic
   npm install
   ```
2. Build all workspaces and compile TypeScript files:
   ```bash
   npm run build
   ```
3. Run the Node.js test suite:
   ```bash
   npm test
   ```

Please read [`CONTRIBUTING.md`](file:///Users/aksh/Documents/Solana%20EPIC/CONTRIBUTING.md) for more details.

---

## EPIC vs Existing Tooling

| Feature / Dimension | Traditional Linters (e.g., Clippy) | Solana Verify | Anchor Sentinel | EPIC |
| :--- | :--- | :--- | :--- | :--- |
| **Analysis Method** | Syntax-level pattern matching / AST checks | Bytecode comparison (reproducibility) | IDL difference checking | Static semantic compiler analysis (CFG, SSA, Dominance) |
| **Scope of Verification** | General code style and common anti-patterns | On-chain deployment authenticity | IDL metadata compatibility | State layout serialization drift & static control-flow security rules |
| **Upgrade Safety Check** | None | Verifies that compiler output matches target source | Compares field definitions in generated IDL | Computes byte-offset shifts on AST layout definitions directly |
| **Validation Path Sensitivity** | Syntax-only checks; easily bypassed by aliasing or shadowing | Post-compilation binary verification | Relies on generated IDL; does not evaluate actual instruction logic paths | Traverses compiler semantic versions (SSA) to trace write-dependency paths |

### Structural Differences
* **Traditional Linters (e.g. Clippy)** identify local code style patterns and isolated anti-patterns inside a single file. They do not trace state mutation chains across multiple functions or verify block dominance across conditional pathways.
* **Solana Verify** is used to assert that the compiled program binary on-chain matches a specific public source repository. It does not perform structural audits of state definition layouts.
* **Anchor Sentinel** diffs generated Anchor IDL files to warn when properties change. It operates on build output metadata and does not analyze the instruction execution logic paths in the Rust source code.
* **EPIC** performs static semantic analysis on the program's Rust AST. It reconstructs execution pathways using Control Flow Graphs (CFG), tracks references using Single Static Assignment (SSA), and evaluates dominance trees to verify security invariants (like `EPIC-SEC-001`).

---

## License

EPIC is open-source developer tooling licensed under the **MIT License**.
