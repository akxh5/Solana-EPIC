# EPIC v0.1 External User Testing Plan

**Role**: Lead DX & Developer Relations Engineer  
**Version**: `0.1.0-beta.1`  
**Audience**: Pilot Program Solana Protocol Engineers  
**Date**: 2026-06-18  

---

## Executive Summary

This testing plan outlines the framework to evaluate **EPIC v0.1.0-beta.1** with the first 3–5 external Solana protocol engineers on production-grade Anchor codebases. The objective is to validate the developer setup, parser accuracy, and integration gates without direct support from the core developer team.

---

## Section A: First Tester Runbook

This guide is designed for external testers evaluating EPIC on their protocol workspaces.

### 1. Prerequisites
Ensure your local development environment has:
*   **Node.js**: `v20` or higher
*   **npm**: `v10` or higher
*   **Anchor**: `0.30` or higher (if comparing IDL JSON structures)

### 2. Sandbox Setup
During the public beta phase, we distribute packages via local tarballs to test installation isolation before publishing to the global registry:

```bash
# Clone the repository
git clone https://github.com/solana-epic/epic.git
cd epic

# Build the TS packages and compile prebuilt binaries
npm install
npm run build

# Package tarballs to artifacts/local-packages/
node scripts/package-local.mjs
```

In a clean directory containing your Solana program source code, run:

```bash
# Initialize dummy package.json if not present
npm init -y

# Install the packaged tarballs (replace paths with absolute paths to the cloned EPIC folder)
npm install \
  "<path_to_epic>/artifacts/local-packages/epic-parser-0.1.0-beta.1.tgz" \
  "<path_to_epic>/artifacts/local-packages/epic-diff-engine-0.1.0-beta.1.tgz" \
  "<path_to_epic>/artifacts/local-packages/epic-cli-0.1.0-beta.1.tgz" \
  "<path_to_epic>/artifacts/local-packages/epic-cli-<your_platform_cpu>-0.1.0-beta.1.tgz" \
  --force --no-audit
```

---

### 3. Test Workflow Operations

#### Step A: Analyze Current State Layouts
Execute the layout analyzer against your Anchor program directory (or built IDL JSON):

```bash
# Analyze using source directories
npx epic analyze ./programs/my-program

# Analyze using compiled IDL file
npx epic analyze ./target/idl/my_program.json
```

*Verify that all struct fields, discriminator tags, and account byte sizes are correctly extracted and matched.*

#### Step B: Simulate and Check Upgrade Risks
1. Copy your program folder to a temporary location to serve as the "old" version.
2. In your active workspace, introduce a structural layout change:
   *   **Safe Change**: Append a new field to the *end* of an account struct.
   *   **Unsafe Change (Middle Insert)**: Insert a new field at index 1 of an account struct (shifting subsequent field offsets).
   *   **Unsafe Change (Swap)**: Reorder two existing fields in a struct.
   *   **Unsafe Change (Type Width)**: Shrink a field width from `u64` to `u32`.
3. Compare the old and new program structures:
   ```bash
   npx epic check ./path-to-old-program ./path-to-new-program
   ```

*Confirm that unsafe changes trigger `CRITICAL` findings, and appends trigger `MAJOR` or `MINOR` severities.*

#### Step C: Add Configuration Overrides
Create an `epic.toml` in your program directory:

```toml
# epic.toml
fail_on_severity = "CRITICAL"

[programs.my_program]
# Downgrade a specific field addition severity
[[programs.my_program.overrides]]
finding_type = "FIELD_ADDED"
field_name = "my_appended_field"
downgrade_to = "MAJOR"
note = "Field is appended to the end of the struct and size allocation was expanded."
```

Run check with configuration:
```bash
npx epic check ./path-to-old-program ./path-to-new-program --config ./epic.toml
```

*Verify that `epic check` exits with code 0 (Approved) once critical alerts are muted.*

---

## Section B: Tester Feedback Template

Please complete this feedback template after running the evaluation runbook:

```markdown
### 1. Environment Details
*   Tester Name / Protocol:
*   OS Version & CPU:
*   Node.js Version:
*   Anchor Version:

### 2. Installation & Setup
*   Did you run into any installation errors or peer dependency warnings? [Yes/No]
*   If yes, paste the terminal logs here:
*   How many minutes did it take to install and verify `--help`?

### 3. Parser & Sizing Accuracy
*   Did `epic analyze` accurately parse all structs marked with `#[account]`? [Yes/No]
*   Were any custom nested structures or enum sizes calculated incorrectly? (Please paste your code snippets)
*   Did the parser crash or throw any unexpected exceptions?

### 4. Upgrade Risk Validation
*   Did middle insertions correctly trigger `CRITICAL` layout warnings? [Yes/No]
*   Did field swaps correctly trigger `CRITICAL` reorder warnings? [Yes/No]
*   Did you find the recommendations and risk severity ratings clear and actionable?

### 5. Configuration Overrides (epic.toml)
*   Was the structure of `epic.toml` easy to understand? [Yes/No]
*   Did the CLI successfully resolve and mute warnings according to overrides?
```

---

## Section C: Bug Report Template

If you encounter parser crashes, false negatives, or command failures, please submit a bug report:

```markdown
### 1. Defect Description
*   Clear description of what went wrong:
*   Expected behavior:
*   Actual behavior:

### 2. Steps to Reproduce
1.  
2.  
3.  

### 3. Minimally Reproducible Code Snippet
Provide the exact Rust account struct definition or the IDL JSON block that caused the issue:
```rust
// Paste struct code here
```

### 4. CLI Console Log output
```bash
# Paste full console stdout/stderr logs here
```
```

---

## Section D: Success Criteria & Evaluation Metrics

To graduate from private tester verification to a successful public grant application, we define the following quantitative success gates:

### 1. Success Metrics Definitions

*   **Install Success Rate (Target: > 95%)**:
    $$\text{Rate} = \frac{\text{Successful isolated setups}}{\text{Total setups attempted}} \times 100$$
    *Failure defines OS/Architecture binary resolver exceptions or npm module lookup crashes.*
*   **Time to First Successful Scan (Target: < 5 Minutes)**:
    Measure the time from unpacking the runner package to displaying parsed state account byte sizes for the target program.
*   **False Positive Reports (Target: 0)**:
    Cases where EPIC incorrectly flags valid Rust/Borsh structures as crash-inducing upgrade drifts, blocking pipelines.
*   **False Negative Reports (Target: 0)**:
    Cases where EPIC fails to block layout reorders, middle field insertions, or width reductions, allowing a bricked upgrade to pass.
*   **Onboarding Friction (Target: < 2 items)**:
    Specific steps in the contribution or installation guides that required manual troubleshooting or dev team support.

### 2. Grant Reviewer Readiness Checkpoint
To submit a high-credibility grant application to Superteam or the Solana Foundation, the project must demonstrate:
*   **Minimum Tester Count**: **3 independent Solana protocol teams** running EPIC successfully on production-grade source code.
*   **Active Pipeline Integrations**: At least **2 teams** integrating `@epic/github-action` directly inside pull request pipelines for upgrade verification.
*   **Zero Fatal Open Issues**: No open critical bugs causing compilation errors or parser crashes on standard Anchor accounts.
