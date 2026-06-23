# EPIC Pilot Recruitment Pack

**Author**: Developer Relations & DX Engineer  
**Target Version**: `0.1.0-beta.1`  
**Tone**: Technical, Developer-to-Developer, Direct, No Hype  

---

## 1. Discord DM Version (Short-Form)

> Hey [Name],
> 
> I've been building EPIC, a local-first static analyzer to detect **Borsh account serialization crashes and layout offset shifts** during Solana program upgrades.
> 
> It parses your Rust structs and Anchor IDL files to compare layout diffs and flags unsafe upgrades (like middle-inserted fields, field reordering, and type width reductions) inside your CI pipeline. We've validated it against historical upgrades from Kamino, Drift, and Squads, achieving 100% accuracy.
> 
> We are running a private beta with 5 Solana protocol leads. I'd love to get your feedback on your team's codebase. The setup is completely local (no data leaves your machine) and takes under 5 minutes.
> 
> Are you open to running a local layout check on your program?

---

## 2. Telegram DM Version (Short-Form)

> Hey [Name],
> 
> I'm building EPIC, a zero-SaaS developer tool to prevent **account serialization crashes and layout drift** during Solana program upgrades.
> 
> It statically evaluates Rust ASTs and Anchor IDL structures, highlighting structural modifications (field additions, reorderings, type width changes) and mapping them to deployment-risk severities. It acts as a fail-closed gate inside your CI/CD pipeline, blocking merges when unsafe upgrades are introduced.
> 
> We're looking for 3-5 protocol leads to run EPIC on their codebase for private beta feedback. The setup is entirely local and takes less than 5 minutes.
> 
> Would you be open to testing it on your program?

---

## 3. X/Twitter DM Version (Short-Form)

> Hey [Name],
> 
> I built a local static analysis tool called EPIC to prevent **Solana account serialization crashes** during program upgrades. 
> 
> It checks layout diffs (like middle-inserted fields, type width reductions, and reorders) and alerts you inside your pull-requests. It runs 100% locally on your machine.
> 
> We are running a private pilot with 5 Solana protocol leads. Would you be open to running a quick scan on your program codebase for feedback?

---

## 4. Long-Form Outreach Message (Email / Forum / Long Telegram)

> **Subject**: Preventing Account Serialization Crashes during Program Upgrades
> 
> Hi [Name],
> 
> In Solana, smart contract state is stored in flat byte arrays. Swapping the order of two fields, adding a field in the middle, or shrinking a type width (`u64` to `u32`) shifts the byte offsets of all trailing fields. Any attempt to read existing on-chain accounts with the new program will fail to deserialize, instantly bricking the program and freezing user assets.
> 
> To prevent this, I've built EPIC (Engineering Platform for Intelligent Contracts). It is a local-first, zero-SaaS command-line tool that statically parses your program source folders or Anchor JSON IDL files, compares layout structures, and detects upgrade drift.
> 
> Key features of the v0.1.0-beta.1 build:
> *   **Local CLI**: `epic analyze` and `epic check` commands running prebuilt native Rust AST engines.
> *   **Diff Engine**: Flags middle-inserted fields, type reductions, and field swaps as `CRITICAL` findings. Appending fields at the end remains `MAJOR`/`MINOR`.
> *   **Configuration overrides**: Mute non-critical layout changes via `epic.toml`.
> *   **GitHub Action**: Displays status tables and warning banners directly in PR comments.
> 
> We are onboarding 3-5 Solana protocol leads for a private pilot to run layout checks on their codebases and integrate the workflow. The setup is fully local, requires no Cargo compilation, and takes less than 5 minutes.
> 
> Would you be open to reviewing the runbook and running a scan on your codebase? Let me know and I'll send over the local package tarballs and setup guide.
> 
> Best regards,  
> [Your Name]

---

## 5. Follow-Up Message (No Response after 5 Days)

> Hey [Name],
> 
> Just following up on this. I know you're busy shipping. 
> 
> If you don't have time to run a layout scan yourself, we can run it on any public branch of your codebase and send you the generated upgrade layout report so you can see the outputs directly.
> 
> Let me know if that works better.
> 
> Best,  
> [Your Name]

---

## 6. Follow-Up Message (After Tester Installs EPIC)

> Hey [Name],
> 
> Awesome to see you got the packages installed!
> 
> When you run `epic analyze` or `epic check`, please let me know if:
> 1. The CLI correctly parsed all helper structs/nested types in your source directory.
> 2. You encountered any unresolved type warnings or compiler crashes.
> 
> If you run into any parsing issues, just paste the console log and the struct definition here and I'll push a hotfix patch.
> 
> Thanks,  
> [Your Name]

---

## 7. Feedback Request Message (After Tester Evaluation)

> Hey [Name],
> 
> Thanks for running the upgrade tests on your codebase.
> 
> To help us harden the tool for the public release, could you answer these three questions?
> 1. Did the parser correctly extract all your `#[account]` structures without throwing errors?
> 2. Did the diff engine accurately classify your layout changes (did it flag middle insertions/reorders as `CRITICAL` and appends as `MAJOR`/`MINOR`)?
> 3. Was the `epic.toml` override configuration intuitive to write?
> 
> Any raw feedback on onboarding friction or setup speed is highly appreciated.
> 
> Best,  
> [Your Name]

---

## 8. Testimonial Request Message

> Hey [Name],
> 
> Thanks again for the detailed feedback. We've resolved the parsing issues you flagged and the patches are live in the local package builds.
> 
> We are preparing our public release and applying for a developer tool grant to support EPIC's development.
> 
> Would you be open to providing a short, 1-2 sentence technical quote about your experience testing EPIC? Something focusing on the utility of checking layout offset shifts or how it helps prevent upgrade crashes would be perfect.
> 
> Thank you,  
> [Your Name]

---

## 9. GitHub Issue Template for Pilot Feedback

Path: `.github/ISSUE_TEMPLATE/pilot-feedback.md`

```markdown
---
name: Pilot Feedback
about: Submit feedback and parser anomalies from pilot testing runs
title: '[PILOT-FEEDBACK] '
labels: pilot-feedback
assignees: ''
---

### 1. Environment Details
*   OS & CPU:
*   Node version:
*   Anchor version:
*   EPIC Version: 0.1.0-beta.1

### 2. Execution Command
```bash
# Paste the command you ran (e.g. epic analyze / epic check)
```

### 3. Problem / Anomalies
Describe any parser crashes, missing accounts, false-positives, or false-negatives encountered:

### 4. Reproduction Snippets
If the parser failed on a specific account struct or helper nested structure, please paste the Rust definition:
```rust
// Paste code here
```

### 5. Console Output Logs
```
# Paste full console stdout/stderr logs here
```
```

---

## 10. Outreach Tracking Spreadsheet Schema

This schema is designed to track outreach and conversion metrics inside a shared team spreadsheet:

| Column Name | Data Type | Description / Allowed Values |
| :--- | :--- | :--- |
| **Protocol Name** | String | Name of the Solana protocol/project (e.g. Kamino, Drift). |
| **Contact Name** | String | Full name of the engineer. |
| **Title / Role** | String | Role (e.g., Smart Contract Lead, CTO). |
| **Channel** | Enum | Platform used (`Telegram`, `Discord`, `X`, `Email`). |
| **Outreach Date** | Date | Date the initial outreach message was sent. |
| **Follow-Up Date** | Date | Date follow-up was sent (if no response after 5 days). |
| **Status** | Enum | Current pipeline status (`Contacted`, `Replied`, `Installing`, `Completed`, `Declined`). |
| **Installation Status**| Enum | Outcome of install run (`Success`, `EBADPLATFORM`, `Loader Error`, `N/A`). |
| **Parser Correct?** | Boolean | Did the static parser successfully extract all accounts without crash? |
| **Mutes Used?** | Boolean | Did the tester write/validate custom `epic.toml` overrides? |
| **Testimonial?** | Boolean | Has the tester provided a testimonial quote? |
| **Notes / Feedback** | String | Raw feedback comments, bug reports, and UX friction notes. |
