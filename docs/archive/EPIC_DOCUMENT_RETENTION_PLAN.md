# EPIC Document Retention Plan

This plan scans all workspace Markdown files, classifies each as `KEEP`, `ARCHIVE`, or `DELETE`, and outlines cleanup actions to reduce documentation bloat.

---

## 1. Document Inventory & Classifications

| Filename | Purpose | Classification | Action |
| :--- | :--- | :--- | :--- |
| **README.md** | Core developer setup and overview. | **KEEP** | Retain in root. |
| **README_V2.md** | Redundant draft readme. | **DELETE** | Purge from repository. |
| **CHANGELOG.md** | Version release logs. | **KEEP** | Retain. |
| **CONTRIBUTING.md** | Contributor setup. | **KEEP** | Retain. |
| **EPIC_BENCHMARK_REPORT.md** | Size/layout performance notes. | **ARCHIVE** | Move to `docs/archive/`. |
| **EPIC_GUARDFACT_FINAL_ARCHITECTURE.md** | Security contract contract mapping. | **KEEP** | Retain in root. |
| **EPIC_PARSER_CAPABILITY_AUDIT.md**| Previous capability review. | **DELETE** | Purge (superseded). |
| **EPIC_PARSER_V3_BUILD_SEQUENCE.md**| Earlier development plans. | **DELETE** | Purge. |
| **EPIC_PARSER_V3_DESIGN_REVIEW.md** | Historical review. | **ARCHIVE** | Move to `docs/archive/`. |
| **EPIC_PARSER_V3_FINAL_ARCHITECTURE.md** | Final V3 parser definitions. | **KEEP** | Retain. |
| **EPIC_PARSER_V3_IMPLEMENTATION_PLAN.md** | Stale build plan. | **DELETE** | Purge. |
| **EPIC_PARSER_V3_TASKLIST.md** | Obsolete tasklist. | **DELETE** | Purge. |
| **EPIC_PHASE1_REDESIGN.md** | Pre-V3 redesign notes. | **ARCHIVE** | Move to `docs/archive/`. |
| **EPIC_PHASE1_SECURITY_ARCHITECTURE.md**| Pre-V3 security engine. | **DELETE** | Purge. |
| **EXTERNAL_TESTING_PLAN.md** | Testing notes. | **ARCHIVE** | Move to `docs/archive/`. |
| **ISSUE_1_IMPLEMENTATION_SPEC.md** | V2 struct specification. | **ARCHIVE** | Move to `docs/archive/`. |
| **ISSUE_2_FINAL_IMPLEMENTATION_SPEC.md**| V2 implementation spec. | **ARCHIVE** | Move to `docs/archive/`. |
| **ISSUE_2_IMPLEMENTATION_SPEC.md**| Obsolete draft spec. | **DELETE** | Purge. |
| **ISSUE_2_PRE_IMPLEMENTATION_REVIEW.md**| Obsolete draft review. | **DELETE** | Purge. |
| **PILOT_RECRUITMENT_PACK.md** | Pilot recruitment details. | **ARCHIVE** | Move to `docs/archive/`. |
| **PRIVATE_BETA_EXECUTION_PLAN.md** | Stale roadmap timeline. | **DELETE** | Purge. |
| **epic_guardfact_hostile_architectural_review.md**| Historical hostile review. | **ARCHIVE** | Move to `docs/archive/`. |
| **epic_guardfact_hostile_validation_audit.md** | Historical validation audit. | **ARCHIVE** | Move to `docs/archive/`. |
| **epic_issue_5_anchor_constraints_spec.md**| Obsolete spec. | **DELETE** | Purge. |
| **epic_issue_5a_guardfact_core_model_spec.md**| Superseded spec. | **DELETE** | Purge. |
| **epic_sec_001_owner_validation_spec.md**| Canonical rule spec. | **KEEP** | Retain in root. |
| **epic_sec_001_pre_implementation_review.md**| Pre-implementation audit. | **ARCHIVE** | Move to `docs/archive/`. |
| **epic_sec_001_implementation_plan.md**| Rules engine build plan. | **ARCHIVE** | Move to `docs/archive/`. |
| **EPIC_SEC_001_IMPLEMENTATION_REDESIGN.md**| Redesign solutions. | **KEEP** | Retain. |
| **epic_sec_001_final_hostile_architecture_signoff.md**| Final sign-off. | **KEEP** | Retain. |

---

## 2. Documentation Bloat Assessment

* **Total Markdown Files**: 30
* **Retained (KEEP)**: 8
* **Archived (ARCHIVE)**: 10
* **Purged (DELETE)**: 12
* **Documentation Bloat Percentage**: **73%** (22 out of 30 files are obsolete, superseded, or redundant design history logs).
