# Agentic Engineering Grant Application — EPIC

Grant: Superteam Agentic Engineering Grant (200 USDG)

Submission form: https://superteam.fun/earn/grants/agentic-engineering

## Step 1: Basics

**Project Title**
> EPIC — Deterministic Solana Upgrade & Security Analysis

**One Line Description**
> EPIC is a fail-closed static analysis and CI tool that prevents breaking Solana program upgrades by detecting unsafe state-layout, ABI, and account-validation changes before mainnet deployment.

**TG username**
> https://t.me/akxh_5

**Wallet Address**
> 6bQsxzf2fkHzRHpPLsKEp9DfkX5dwLmDtMk3ARBb7YL7

## Step 2: Details

**Project Details**
> Solana program upgrades can compile and pass tests while still corrupting or making existing on-chain accounts unreadable. In Borsh-serialized state, inserting, reordering, removing, or narrowing fields shifts byte offsets for trailing data. Runtime tests usually exercise newly created accounts and can miss incompatibilities with existing mainnet state. Existing linters and IDL diff tools also do not prove that critical validation checks dominate every state-writing execution path.
>
> EPIC addresses this with deterministic, compile-free static analysis for Anchor and Rust-based Solana programs. Its Rust AST engine reconstructs type layouts, control-flow graphs, SSA-lite value flows, write dependencies, and guard facts. EPIC detects breaking layout and ABI changes, verifies ownership-check dominance for mutable account writes, and emits human-readable or SARIF findings for local and CI use. The repository also includes a CLI, GitHub Action integration, safe and vulnerable fixtures, and real-world validation against major Solana program codebases.
>
> The current engineering focus is hardening the parser and namespace/type resolution, completing signer-validation analysis, expanding regression coverage, and packaging the analyzer into a reliable developer workflow. The grant will support agent-assisted implementation, adversarial fixture generation, validation, documentation, and release preparation.

**Deadline**
> 31 July 2026, 11:59 PM IST 

**Proof of Work**
> Repository: https://github.com/akxh5/Solana-EPIC
>
> Implemented artifacts include a Rust AST analyzer, ABI/layout diff engine, CLI, GitHub Action, SARIF output, ownership-check dominance analysis, safe/vulnerable fixtures, configuration validation, and multi-program tracking.
>
> Recent Git history shows implementation and validation work including: Upgrade Safety MVP and CLI reporting (`194ccb1`); Anchor `ErrorCode` parsing and namespace registry hardening (`676ab7e`); real-world validation and benchmarks (`377b269`); EPIC-versus-Sentio validation (`98fc6c5`); ownership-check stabilization and fixtures (`bd2dab0`); GitHub Actions integration (`bddb787`); ABI diff classification (`6b17327`); and parser-v3 rule-engine and owner-validation work (`7542190`, `f0c92f5`).
>
> Validation artifacts in the repository include `EPIC_UPGRADE_REAL_WORLD_VALIDATION.md`, `EPIC_BENCHMARK_REPORT.md`, `EPIC_PRODUCTION_STRESS_REPORT.md`, `EPIC_VS_SENTIO_REAL_WORLD_VALIDATION.md`, and `docs/research/historical-validation.md`.

**Personal X Profile**
> https://x.com/akxh_5

**Personal GitHub Profile**
> https://github.com/akxh5

**Colosseum Crowdedness Score**
> Score: 257 (Low-Medium), cluster `v1-c5` — Solana Data and Monitoring Infrastructure. Analysis generated via Colosseum Copilot on 14 June 2026. Supporting Drive folder: https://drive.google.com/drive/folders/1USH8_Tzp0Dye0umX0wESfqKRxqnz_3L2?usp=sharing

**AI Session Transcript**
> `codex-session.jsonl` — exported to the project root for upload as evidence of Codex-assisted engineering.

## Step 3: Milestones

**Goals and Milestones**
> 1. By 28 June 2026 — lock the upgrade-safety and security-rule regression corpus, including Anchor error-code, namespace, aliasing, shadowing, and nested-type edge cases.
>
> 2. By 7 July 2026 — complete signer-verification dominance analysis (EPIC-SEC-002) with positive, negative, and bypass-path fixtures.
>
> 3. By 17 July 2026 — run the analyzer against at least five representative Solana program repositories and publish reproducible accuracy, performance, and false-positive results.
>
> 4. By 25 July 2026 — harden CLI and GitHub Action behavior, including deterministic exit codes, SARIF output, failure summaries, and documented CI examples.
>
> 5. By 31 July 2026 — publish a tagged beta release with installation documentation, an end-to-end demo, and a Colosseum project update.

**Primary KPI**
> At least five real-world Solana program repositories analyzed end-to-end with zero known critical upgrade-safety false negatives in the published regression corpus by 31 July 2026.

**Final Tranche Acknowledgement**
> I understand that receiving the final tranche requires submission of the Colosseum project link, public GitHub repository, and AI subscription receipt.

## Files and Links to Submit

- Application responses: `agentic-engineering-grant-application.md`
- AI transcript: `codex-session.jsonl`
- Colosseum Crowdedness Score screenshot: place it in the linked public Google Drive folder
- Repository: https://github.com/akxh5/Solana-EPIC
- Final-tranche evidence: Colosseum project link and AI subscription receipt
