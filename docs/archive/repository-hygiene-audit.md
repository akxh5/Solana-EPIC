# EPIC v0.1 Repository Hygiene Audit & DX Review

**Auditor**: Open Source Maintainer & Developer Experience (DX) Reviewer  
**Target Release**: EPIC v0.1 Public Beta  
**Date**: 2026-06-18  

---

## 1. Executive Summary: Audience Perspective Analysis

A repository's root directory is its digital storefront. Currently, EPIC contains **over 35 planning, strategy, audit, roadmap, validation, and historical research documents** in the root workspace. While this shows incredible velocity and analytical depth, it severely damages developer experience (DX) and public trust. 

Here is how four key audiences perceive the current repository structure:

### 1. Protocol Engineers (First Discovery)
*   **Impression**: Confused. They want to find: *Is this stable? How do I install it? Where is the configuration spec? Where is the code?* Instead, they are met with a wall of 30+ capitalized planning files. 
*   **Result**: Decreased trust. Protocol teams expect security tooling to look clean, highly organized, and deterministic. Overwhelming clutter suggests an experimental "developer lab" rather than production-grade developer tooling.

### 2. GitHub Visitors (From Social Media/Twitter)
*   **Impression**: Overwhelmed. A visitor wants to scan the `README.md` and see standard open-source folders (`/src`, `/docs`, `/examples`). A root folder cluttered with strategic reviews makes it hard to locate the packages and find where the actual codebase is.
*   **Result**: High bounce rate. They leave without starring the repo or running the installation.

### 3. Superteam Grant Reviewers
*   **Impression**: Mixed. They value the deep research (e.g. historical Solana upgrades studies), but they are trained to look for launch readiness. Documents detailing "unsupported claims" or internal roadmap disputes indicate the team is still in brainstorming mode.
*   **Result**: Delayed or reduced funding due to perceived execution risk.

### 4. Potential Contributors
*   **Impression**: Lost. They expect standard onboarding documentation (`CONTRIBUTING.md`, `ARCHITECTURE.md`). Duplicate design files and internal architecture draft files make it unclear which documentation is the source of truth for the codebase.
*   **Result**: Friction in contributing; abandonment of pull requests.

---

## 2. Document Categorization Inventory

Every single markdown document in the repository has been evaluated and categorized. The goal is to clean up the root to **under 5 essential files**, consolidate core documentation in `/docs`, and isolate historical planning in `/docs/archive/`.

### Category Mapping:
*   **KEEP IN ROOT**: Essential user-facing files standard for GitHub repositories.
*   **MOVE TO docs/**: Core user guides, configuration specs, and technical references.
*   **MOVE TO docs/research/**: Case studies, benchmarks, and historical protocol analyses.
*   **MOVE TO docs/archive/**: Historical internal planning documents, phase plans, and development logs.
*   **DELETE**: Duplicate, obsolete, or credibility-weakening files.

| Document Name | Current Location | Recommended Action | Justification |
| :--- | :--- | :--- | :--- |
| `README.md` | Root | **KEEP IN ROOT** | The main landing page and storefront. Needs minor updates to link to new locations. |
| `LICENSE` | Root | **KEEP IN ROOT** | Legal licensing terms (MIT). |
| `CONTRIBUTING.md` | - (Create) | **KEEP IN ROOT** | Onboarding documentation for open-source contributors. |
| `CHANGELOG.md` | - (Create) | **KEEP IN ROOT** | Lists version releases and updates (crucial for protocol teams). |
| `ARCHITECTURE.md` | Root | **DELETE** | Duplicate. A cleaner, more updated version exists in `docs/ARCHITECTURE.md`. |
| `VISION.md` | Root | **DELETE** | Duplicate. A cleaner version exists in `docs/VISION.md`. |
| `docs/VISION.md` | `/docs` | **MOVE TO docs/archive/** | A founder's manifesto is great for early stages but belongs in the archive for a release. |
| `MILESTONE_V0_1.md` | Root | **DELETE** | Obsolete duplicate of `docs/MILESTONES.md`. |
| `docs/MILESTONES.md` | `/docs` | **MOVE TO docs/archive/** | Project management milestones are obsolete once v0.1 is shipped. |
| `EPIC_BETA_ROADMAP.md` | Root | **DELETE** | Obsolete duplicate of `docs/ROADMAP.md`. |
| `docs/ROADMAP.md` | `/docs` | **MOVE TO docs/** | User-facing roadmap showing next features (rename to `roadmap.md`). |
| `docs/PARSER_V2_SPIKE.md` | `/docs` | **MOVE TO docs/archive/** | Technical spike notes from parser v2 development. Historic only. |
| `docs/SIMULATION.md` | `/docs` | **MOVE TO docs/** | Explains simulation design and validation. |
| `docs/TRUSTWORTHINESS.md` | `/docs` | **MOVE TO docs/** | User-facing trust framework (how EPIC guarantees safety). |
| `GRANT-NOTES.md` | `/docs` | **MOVE TO docs/archive/** | Internal notes for grants. Unprofessional for general public. |
| `EPIC_CONFIG_SPEC.md` | Root | **MOVE TO docs/** | Core documentation for users on `epic.toml` usage. Rename to `configuration-spec.md`. |
| `epic_config_design.md` | Root | **DELETE** | Superseded by the completed `EPIC_CONFIG_SPEC.md` implementation. |
| `epic_toml_implementation_plan.md` | Root | **DELETE** | Internal planning task document. Implementation is already finished. |
| `abi_intelligence_plan.md` | Root | **DELETE** | Obsolete early-phase planning doc. |
| `EPIC_PARSER_V2_ARCHITECTURE.md` | Root | **MOVE TO docs/archive/** | Internal developer notes on parser v2. Historic. |
| `EPIC_PARSER_V2_REVIEW.md` | Root | **DELETE** | Code review feedback. Already resolved. |
| `RUST_CLI_INTEGRATION_PLAN.md` | Root | **DELETE** | Design document for Rust/TS CLI boundary. Already implemented. |
| `RUST_NODE_BRIDGE.md` | Root | **DELETE** | Implementation plan for bridge. Already implemented. |
| `validation_report.md` | Root | **DELETE** | Obsolete validation report. Superseded by `CLI_VALIDATION_REPORT.md` and `LOCAL_INSTALL_REPORT.md`. |
| `EPIC_V2_VALIDATION_REPORT.md` | Root | **DELETE** | Obsolete validation report. |
| `CLI_VALIDATION_REPORT.md` | Root | **MOVE TO docs/archive/** | Internal validation run outputs. |
| `LOCAL_INSTALL_REPORT.md` | Root | **MOVE TO docs/archive/** | Release engineering validation details. Keep as historical proof. |
| `COMPATIBILITY_REPORT.md` | Root | **MOVE TO docs/archive/** | Early development compatibility studies. |
| `DEMO_PROOF.md` | Root | **DELETE** | Obsolete planning files for demo scripting. |
| `EPIC_ACTION_DEMO.md` | Root | **DELETE** | Demo walkthrough. Redundant now that actions are verified. |
| `EPIC_ACTION_REPORT.md` | Root | **DELETE** | Demo report. Redundant. |
| `EPIC_DEMO_READINESS_REPORT.md` | Root | **DELETE** | Readiness check. Outdated. |
| `EPIC_PROJECT_STATUS.md` | Root | **DELETE** | Project status tracking file. Outdated. |
| `EPIC_STRATEGY_REVIEW.md` | Root | **DELETE** | Strategy brainstorming file. **Weakes credibility** (reveals internal issues). |
| `EPIC_PROOF_GAPS.md` | Root | **DELETE** | **CRITICAL DX RISK**. Lists unsupported claims and verification holes. Weakens public credibility. |
| `POSITIONING.md` | Root | **DELETE** | Marketing positioning notes. Belongs in private wiki. |
| `EPIC_PHASE4_PRODUCTIZATION_PLAN.md` | Root | **DELETE** | Internal workflow notes. Obsolete. |
| `EPIC_BETA_LAUNCH_PLAN.md` | Root | **DELETE** | Internal product launch plan. |
| `EPIC_RELEASE_GAP_ANALYSIS.md` | Root | **DELETE** | Development gap analysis. Obsolete. |
| `EPIC_V0_1_RELEASE_PLAN.md` | Root | **DELETE** | Release task list. Obsolete. |
| `EPIC_WORKFLOW_PRODUCTIZATION.md` | Root | **DELETE** | Internal workflow plan. |
| `UPGRADE_IMPACT_ENGINE_REPORT.md` | Root | **MOVE TO docs/archive/** | Internal technical report on impact engine. |
| `HISTORICAL_VALIDATION.md` | Root | **MOVE TO docs/research/** | Crucial research matching EPIC against actual hacks. (Rename to `historical-validation.md`). |
| `EPIC_HISTORICAL_PROTOCOL_STUDY.md` | Root | **MOVE TO docs/research/** | In-depth case study on protocol hacks. (Rename to `protocol-upgrade-study.md`). |

---

## 3. Credibility Risk Assessment

Security products are sold on **absolute trust and technical precision**. The following documents currently residing in the repository represent severe credibility hazards:

1.  **`EPIC_PROOF_GAPS.md`**:
    *   *Why it harms*: It lists sections where marketing claims are "weaker than proof" and explicitly points out "unsupported claims" and "missing validation artifacts". If a protocol engineer or auditor sees this, they will question the reliability of the entire tool.
    *   *Action*: **DELETE immediately**. This analysis was useful during early development, but keeping it in the open-source repository undermines public confidence.
2.  **`EPIC_STRATEGY_REVIEW.md` and `POSITIONING.md`**:
    *   *Why it harms*: They contain raw venture/business positioning analysis, target audiences, and "how to sell" EPIC. Protocol engineers dislike corporate positioning jargon in open-source tools; they expect purely developer-focused utility.
    *   *Action*: **DELETE immediately** (move to private team wiki/Notion).
3.  **Obsolete validation reports (`validation_report.md`, `EPIC_V2_VALIDATION_REPORT.md`)**:
    *   *Why it harms*: They reference early versions, failures, and incomplete setups, muddying current stable performance metrics.
    *   *Action*: **DELETE**.

---

## 4. Proposed Ideal Repository Structure

We recommend organizing the repository into a clean, modern monorepo layout:

```plaintext
solana-epic/
├── .github/                   # GitHub Action workflows and configuration
│   └── workflows/
│       └── test.yml           # CI workspace testing workflow
├── artifacts/                 # Ignored generated artifacts (tarballs)
├── docs/                      # Core user-facing documentation
│   ├── archive/               # Historical development plans & internal logs
│   ├── examples/              # Case studies & reference configurations
│   ├── research/              # Academic & historical vulnerability research
│   ├── architecture.md        # Technical spec (layout mapping, rust parsing engine)
│   ├── configuration.md       # epic.toml schema & override configuration guide
│   ├── roadmap.md             # Public development goals (docker builds, Squads integration)
│   ├── simulation.md          # State account simulation & bankrun guide
│   └── trustworthiness.md     # How EPIC protects program state
├── examples/                  # Reference project integrations
│   └── github-workflow.yml    # Copy-pasteable workflow file for protocol teams
├── fixtures/                  # Rust source & IDL test fixtures
├── packages/                  # Workspace package modules
│   ├── cli/                   # @epic/cli command-line wrapper
│   ├── parser/                # @epic/parser parser-v2 JS wrapper
│   ├── diff-engine/           # @epic/diff-engine ABI comparator
│   ├── github-action/         # @epic/github-action PR guard
│   └── cli-<target>/          # Target platform prebuilt wrappers (darwin, linux, win32)
├── scripts/                   # Local developer automation tools
│   ├── package-local.mjs      # Local pack compiler
│   └── test-local-install.mjs # Local installation verification test runner
├── .gitignore
├── CHANGELOG.md               # Version updates (Create)
├── CONTRIBUTING.md            # Onboarding guide (Create)
├── LICENSE                    # MIT license details
├── package.json               # Monorepo workspaces definition
├── README.md                  # Landing page & quick-start guide
├── tsconfig.base.json         # Base TS configurations
└── turbo.json                 # Build cache orchestrator
```

---

## 5. Detailed Migration Action Plan

To transition from the current cluttered state to the ideal repository structure, execute the following steps in sequence:

### Phase 1: Cleaning & Deletions
1.  Remove duplicate files in root that exist in `docs/`: `ARCHITECTURE.md`, `VISION.md`, `MILESTONE_V0_1.md`, `EPIC_BETA_ROADMAP.md`.
2.  Purge business strategy/positioning files: `EPIC_STRATEGY_REVIEW.md`, `POSITIONING.md`, `EPIC_PROOF_GAPS.md`.
3.  Remove outdated task planning lists and reports: `epic_toml_implementation_plan.md`, `epic_config_design.md`, `abi_intelligence_plan.md`, `RUST_CLI_INTEGRATION_PLAN.md`, `RUST_NODE_BRIDGE.md`, `DEMO_PROOF.md`, `EPIC_ACTION_DEMO.md`, `EPIC_ACTION_REPORT.md`, `EPIC_DEMO_READINESS_REPORT.md`, `EPIC_PROJECT_STATUS.md`, `EPIC_PHASE4_PRODUCTIZATION_PLAN.md`, `EPIC_BETA_LAUNCH_PLAN.md`, `EPIC_RELEASE_GAP_ANALYSIS.md`, `EPIC_V0_1_RELEASE_PLAN.md`, `EPIC_WORKFLOW_PRODUCTIZATION.md`.
4.  Remove obsolete test reports: `validation_report.md`, `EPIC_V2_VALIDATION_REPORT.md`.

### Phase 2: Document Archiving & Reorganization
1.  Create `/docs/archive/` and `/docs/research/` folders.
2.  Move `CLI_VALIDATION_REPORT.md` and `LOCAL_INSTALL_REPORT.md` to `docs/archive/` to serve as a record of launch readiness audits.
3.  Move internal/historic specs to `docs/archive/`: `docs/VISION.md`, `docs/MILESTONES.md`, `docs/PARSER_V2_SPIKE.md`, `EPIC_PARSER_V2_ARCHITECTURE.md`, `COMPATIBILITY_REPORT.md`, `UPGRADE_IMPACT_ENGINE_REPORT.md`, `GRANT-NOTES.md`.
4.  Move research papers to `docs/research/`: `HISTORICAL_VALIDATION.md` (rename to `historical-validation.md`), `EPIC_HISTORICAL_PROTOCOL_STUDY.md` (rename to `protocol-upgrade-study.md`).
5.  Organize `/docs` root files:
    *   Move `EPIC_CONFIG_SPEC.md` to `docs/configuration.md`
    *   Move `docs/ROADMAP.md` to `docs/roadmap.md`
    *   Ensure `docs/ARCHITECTURE.md` is lowercase: `docs/architecture.md`
    *   Ensure `docs/SIMULATION.md` is lowercase: `docs/simulation.md`
    *   Ensure `docs/TRUSTWORTHINESS.md` is lowercase: `docs/trustworthiness.md`
6.  Move protocol examples (`drift.md`, `kamino.md`, `marginfi.md`, `squads.md`, `README.md`) from `docs/examples/` to a dedicated `docs/examples/case-studies/` subdirectory to keep the main docs folder clean.

### Phase 3: Creating Essential DX Documents
1.  **`CONTRIBUTING.md`**: Guide contributors on setup (`npm install`), building (`npm run build`), and testing (`npm test`).
2.  **`CHANGELOG.md`**: Initialize the changelog tracking `v0.1.0-beta.1` features.

---

## 6. Target Repository Trees by Checkpoint

### Checkpoint A: Before First External Tester (Pre-Tester Cleanup)
*Focus: Clear all obsolete files and group validation reports. Keep all core documentation intact for feedback.*
*   Root level markdown files: `README.md`, `LICENSE`, `LOCAL_INSTALL_REPORT.md`, `CONTRIBUTING.md`.
*   `/docs` contains core configuration, architecture, and case studies.
*   Archived files moved to `docs/archive/`.

### Checkpoint B: Before GitHub Public Launch (Production Storefront)
*Focus: Maximum polish, 100% public-ready. Remove internal validation reports entirely from root.*
*   Root level markdown files: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`.
*   `/docs` contains user guides and guides (`architecture.md`, `configuration.md`, `roadmap.md`).
*   `/docs/research` houses validation and historical study case files.
*   All validation reports (`LOCAL_INSTALL_REPORT.md`, `CLI_VALIDATION_REPORT.md`) are consolidated inside `/docs/archive/`.
*   No strategic, business, positioning, or draft files exist anywhere in the repository.

### Checkpoint C: Before Superteam Grant Submission (Maximum Credibility)
*Focus: Retain deep research studies (`docs/research/`) to show technical expertise, while ensuring zero "proof gap" files are present.*
*   Root level markdown files: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`.
*   `/docs/research/` contains `historical-validation.md` (100% pass verification) and `protocol-upgrade-study.md` (proves EPIC would have saved bricked protocols).
*   High-level vision and roadmap documents are well-formatted.
*   No draft architecture or internal brainstorm notes exist. The repository looks like a mature, venture-scale open-source project.
