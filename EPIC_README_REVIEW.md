# EPIC README Review

This document provides a review of the current public-facing `README.md` from the perspectives of a Solana founder, security engineer, grant reviewer, and open-source contributor.

## Assessment

### 1. Strengths
* **Clear Core Value Proposition**: The README immediately communicates what EPIC is, why it exists (layout drift, Borsh deserialization shifts), and the value it adds over traditional AST linters.
* **Architecture Diagram**: Provides a clear pipeline block-diagram explaining the compilation steps (AST -> CFG -> SSA -> GuardFacts -> Rule Engine).
* **Comparison Matrix**: A helpful comparison table highlights differences between EPIC, traditional linters, Solana Verify, and Anchor Sentinel.

### 2. Weaknesses
* **Stale and Incorrect Examples**: 
  * The `epic analyze` example uses a command structure (`npx tsx packages/cli/src/index.ts analyze packages/parser-v2/tests/fixtures/ Kamino`) that contains trailing argument leftovers and is incorrect.
  * Running files using `npx tsx packages/cli/src/index.ts` is fine for local dev, but doesn't mention how to execute it when checked out or globally.
* **Feature Alignment Discrepancies**:
  * The **What EPIC Does** section lists *Signer Validation (EPIC-SEC-002)* as if it is fully functional, but both the **Current Capabilities** table and the **Roadmap** mark it as "In Progress" or "Planned."
  * The **Roadmap** and **Current Capabilities** tables list *SARIF Format Exporter* as planned or in progress, even though SARIF formatting is already fully implemented in the codebase via `--format sarif`.
* **Heuristics vs Semantic Terminology**: The text makes strong claims about "proving safety properties across all executable paths." It should explain the limitations of the tool transparently (e.g. SSA-lite, no full solver back-end).

### 3. Missing Sections
* **Installation via NPM**: Doesn't clearly specify how the user can install and run the tool in their projects.
* **CI Integration Example**: No concrete example of integrating EPIC with GitHub Actions in a target repository.
* **Limitations/Borders**: Does not specify what the engine *cannot* analyze (e.g., dynamic vectors inside accounts, native layouts not using Anchor macros, complex cross-program invocations).

---

## Recommended Improvements

1. **Clarify Capabilities Table**: Move **SARIF Format Exporter** to the **Implemented** column.
2. **Correct CLI Examples**: Simplify and correct the `epic analyze` and `epic audit` usage instructions.
3. **Add CI Integration Section**: Provide a snippet showing how to use `packages/epic-action` or a composite step in GitHub Actions.
4. **Document Current Limitations**: Explicitly call out current limitations (e.g., Anchor-centric constraint parsing, SSA-lite tracing boundaries).
5. **Update Roadmap**: Align roadmap to show next steps clearly.
