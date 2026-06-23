# EPIC Documentation Hygiene Report

This report records the complete documentation audit, classification, and restructuring executed to prepare the Google Antigravity EPIC repository for Release Candidate (RC) status.

---

## 1. Files Kept

### Repository Root
*   [README.md](file:///Users/aksh/Documents/Solana%20EPIC/README.md)
*   [CHANGELOG.md](file:///Users/aksh/Documents/Solana%20EPIC/CHANGELOG.md)
*   [CONTRIBUTING.md](file:///Users/aksh/Documents/Solana%20EPIC/CONTRIBUTING.md)

### Docs Folder (`docs/`)
*   [docs/installation.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/installation.md)
*   [docs/cli-reference.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/cli-reference.md)
*   [docs/security-rules.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/security-rules.md)
*   [docs/upgrade-safety.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/upgrade-safety.md)
*   [docs/architecture.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/architecture.md)
*   [docs/sentinel-comparison.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/sentinel-comparison.md)

### Rule Documentation (`docs/rules/`)
*   [docs/rules/EPIC-SEC-001.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/rules/EPIC-SEC-001.md)
*   [docs/rules/EPIC-SEC-002.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/rules/EPIC-SEC-002.md)
*   [docs/rules/EPIC-SEC-003.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/rules/EPIC-SEC-003.md)
*   [docs/rules/EPIC-SEC-004.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/rules/EPIC-SEC-004.md)
*   [docs/rules/EPIC-SEC-005.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/rules/EPIC-SEC-005.md)

---

## 2. Files Archived (`docs/archive/`)

Moved all engineering research notes, sprint briefs, and verification reports out of the repository root and standard folders:
*   Sprint results, Design reviews, and Final verdicts: `EPIC_SEC_00X_DESIGN_REVIEW.md`, `EPIC_SEC_00X_FINAL_VERDICT.md`, `EPIC_SEC_00X_EDGE_CASE_REPORT.md` (for rules 002, 003, 004, 005).
*   Exploit validation notes: `EPIC_SEC_00X_HISTORICAL_VALIDATION.md`, `EPIC_SEC_00X_REAL_WORLD_VALIDATION.md`.
*   Obsolete specifications: `EPIC_SEC_00X_SPEC.md` (historical spec drafts).
*   Roadmaps and strategy briefs: `roadmap.md`, `ROADMAP.md`, `milestones.md`, `agentic-engineering-grant-application.md`.
*   Miscellaneous drafts: `simulation.md`, `trustworthiness.md`, `performance-report.md`, `configuration.md`.
*   Research and study folders: `docs/research/` and `docs/examples/` moved entirely into archive.

---

## 3. Files Deleted

*   `grant-upload-checklist.md` (Temporary checklist)
*   `epic-report.md` (Duplicate auto-generated report)
*   `epic-report.json` (Auto-generated CLI workspace report)
*   `sarif.json` (Duplicate code scan artifact)

---

## 4. New Documentation Structure

```
EPIC Workspace/
├── CHANGELOG.md
├── CONTRIBUTING.md
├── README.md
├── docs/
│   ├── installation.md
│   ├── cli-reference.md
│   ├── security-rules.md
│   ├── upgrade-safety.md
│   ├── architecture.md
│   ├── sentinel-comparison.md
│   ├── rules/
│   │   ├── EPIC-SEC-001.md
│   │   ├── EPIC-SEC-002.md
│   │   ├── EPIC-SEC-003.md
│   │   ├── EPIC-SEC-004.md
│   │   ├── EPIC-SEC-005.md
│   └── archive/
│       └── [Historical Engineering Documents]
```

---

## 5. Final Repository Tree

The resulting repository layout for markdown documentation matches our Target Release Candidate layout:
*   **Root**: 3 Keep files (`CHANGELOG.md`, `CONTRIBUTING.md`, `README.md`).
*   **Docs Folder**: 6 Keep files.
*   **Rules Folder**: 5 Keep files.
*   **Archive Folder**: Contains all historical design reviews, verdicts, specs, and validation reports safely catalogued out of view.
