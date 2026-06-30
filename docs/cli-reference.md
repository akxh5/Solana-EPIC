# CLI Reference

EPIC CLI (`epic`) provides Upgrade Intelligence for Solana programs.

---

## Commands

### 1. `epic check` (Compatibility Analysis)
Compare two Solana program versions and perform a Compatibility Analysis to prevent mainnet state corruption.
```bash
epic check <old_path> <new_path> [options]
```
*   **Arguments**:
    *   `<old_path>`: Path to the old program version source directory.
    *   `<new_path>`: Path to the new program version source directory.
*   **Options**:
    *   `-f, --format <format>`: Output format (text, json).

### 2. `epic audit` (Security Audit)
Perform a Security Audit against a repository to catch missing invariants.
```bash
epic audit [path] [options]
```
*   **Arguments**:
    *   `[path]`: Directory or file path to scan (defaults to `.`).
*   **Options**:
    *   `-f, --format <format>`: Output format. Supported options: `text`, `json`, `sarif`, `markdown` (defaults to `text`).
    *   `--include-tests`: Include test directories in the scan.

### 3. `epic doctor` (Environment Diagnostics)
Run Environment Diagnostics to verify dependencies.
```bash
epic doctor
```

### 4. `epic analyze` (Workspace Analysis)
Run a Workspace Analysis to scan a Solana program and report state account sizes.
```bash
epic analyze <path>
```
*   **Arguments**:
    *   `<path>`: Path to Anchor project, source directory, or file.

### 5. `epic rules`
List all security rules implemented in EPIC.
```bash
epic rules
```

### 6. `epic explain`
Print detailed explanations, threat models, and code examples for a specific rule.
```bash
epic explain <rule_id>
```
*   **Arguments**:
    *   `<rule_id>`: The rule identifier (e.g. `EPIC-SEC-004`).

