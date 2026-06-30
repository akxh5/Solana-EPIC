# EPIC

<p align="center">
  <b>Upgrade Intelligence for Solana Programs</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@solana-epic/cli"><img src="https://img.shields.io/npm/v/@solana-epic/cli.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/solana-epic/epic.svg?style=flat-square" alt="license" /></a>
</p>

---

EPIC is the deployment readiness and upgrade intelligence infrastructure for Solana programs. Positioned between `git push` and mainnet, EPIC evaluates state layout evolution, ABI compatibility, and security regressions to answer a simple question before you deploy:

**"Can I safely deploy this upgrade?"**

---

## What Happens to My Existing Accounts?

Every Solana program upgrade is a high-risk migration. A minor type shift, field reordering, or missing state reload can corrupt deserialization layouts, lock user accounts, or introduce severe security regressions.

Standard developer tooling tells you if your code compiles. Security scanners tell you if a codebase has known vulnerabilities. **Neither tells you if the transition between your old deployment and your new code will break state on mainnet.**

EPIC catches these upgrade compatibility issues in local development and on every pull request.

### Catch Corruptions Before Deployment

Compare two program versions to verify layout compatibility and prevent state corruption.

```bash
$ epic check ./old-program ./new-program

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPIC ACCOUNT COMPATIBILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Program        Position
Accounts       1
Verdict        [ BLOCKED ]  Existing accounts would be corrupted
Breakdown      1 blocked  ·  0 migration  ·  0 safe

──────────────────────────────────────────────────

[ BLOCKED ]  Position  ·  Existing accounts would be corrupted

Size        40 → 48 bytes (+8)
Certainty   Exact

WHY
• Field inserted in the middle — every field after the insertion point
shifts on disk.

Old Layout                    New Layout
  owner  8–39            → amount  8–15          
                         → owner  16–47          

WHAT BREAKS
Bytes 8–39 previously held `owner: Pubkey`. Under the new layout those
same bytes deserialize as `amount: u64`. Existing on-chain accounts will
silently decode into the wrong fields.

RECOMMENDED UPGRADE PLAN
  1. DO NOT deploy over existing `Position` accounts — a field was inserted
     before the end, shifting every later field.
  2. Keep the persisted layout backward-compatible (append fields at the
     tail; never reorder, remove, retype, or shrink in place).
  3. If the new shape is required, introduce a versioned account (new
     discriminator) and migrate state explicitly into it.
  4. Re-run `epic check` and verify the migration against a forked mainnet
     state before shipping.
```

---

## 360° Upgrade Security

EPIC doesn't just check layouts. It analyzes the entire lifecycle of an upgrade.

### 1. Workspace Analysis (`epic analyze`)
Track account layout evolution, serialized sizes, and memory offsets to manage state scaling.

### 2. Security Audit (`epic audit`)
Verify that modifications to instruction state rules and safety invariants do not introduce security regressions.

### 3. Environment Diagnostics (`epic doctor`)
Automatically verify host prerequisites (Node, Cargo, Rustc) and workspace configurations instantly.

---

## Installation

Install the CLI wrapper:
```bash
npm install -g @solana-epic/cli
```

Verify your installation:
```bash
epic doctor
```

---

## Integrate with CI/CD

Incorporate upgrade checks directly into your pull requests. EPIC supports standard JSON and SARIF outputs for GitHub Actions integration:

```yaml
- name: Run EPIC Upgrade Checks
  run: npx @solana-epic/cli check ./main-branch ./pr-branch -f sarif > sarif.json

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
fail_on_severity = "MAJOR"

[epic.rules]
ignore = [
    "EPIC-SEC-004" # Disable specific rules
]
```

---

## Documentation Reference

- **[Architecture & Engine Design](docs/architecture.md)**
- **[CLI Command Reference](docs/cli-reference.md)**
- **[Upgrade Safety Guide](docs/upgrade-safety.md)**

