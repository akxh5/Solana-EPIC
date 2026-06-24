# EPIC Doctrine: Strategic Positioning & Messaging Guidelines

This document defines the strategic positioning, category definitions, and messaging rules for EPIC to maintain a coherent brand identity over the next 12 months and prevent messaging drift back into "generic security scanner."

---

## 1. Category Alignment

### What category does EPIC belong to?
EPIC belongs to **Solana Developer Tooling** and **Deployment Infrastructure**.

### What category are we creating?
We are establishing the category of **Solana Upgrade Intelligence**.

---

## 2. Competitive & Ecosystem Differentiation

### What problem does EPIC solve?
EPIC eliminates the risk of **state layout corruption, breaking ABI shifts, and upgrade-introduced security regressions** during program deployments. When a protocol upgrade is committed, EPIC verifies that the transition from the old layout to the new layout is safe, preventing live mainnet account deserialization failures and vulnerability regressions.

### What does Sentio solve?
Sentio solves **runtime security monitoring and transaction auditing**. It operates post-deployment, tracking live transaction streams, identifying anomalies, and alerting teams after events have occurred on mainnet.

### What does Anchor Sentinel solve?
Anchor Sentinel solves **runtime assertion defense and active circuit-breaking**. It monitors live account mutations on-chain, verifying that state rules are not violated during execution, and triggers emergency halts if assertions fail during an active exploit.

### Why does EPIC exist if those tools already exist?
Sentio and Sentinel are **reactive/active runtime safety tools**. They inspect behavior and defend protocols *after* code reaches mainnet. By the time they alert or halt, state corruption or exploit execution has already occurred.

EPIC is **preventative deployment infrastructure**. It operates *before* code reaches mainnet (between git push and deployment keys). It statically verifies compile-time upgrade compatibility and safety invariants to ensure that breaking layouts or regressions can never reach production.

---

## 3. Messaging Vocabulary

### Phrases to ALWAYS Use
*   **Upgrade Intelligence** (The core category)
*   **Upgrade Compatibility** (The core function of `epic check`)
*   **Deployment Readiness** / **Deployment Confidence** (The core value)
*   **Account Evolution** / **State Layout Analysis** (How we evaluate state)
*   **Safety Regressions** / **Safety Invariants** (How we evaluate code modifications)
*   **Ship with Confidence** (The primary developer benefit)

### Phrases to NEVER Use
*   *Security scanner / scanner* (Reduces EPIC to a generic utility)
*   *Static analysis tool / static analyzer* (Too generic; use only when contextualized with layout upgrades)
*   *Solana auditor / audit tool* (Implies a service or generic check)
*   *Vulnerability scanner* (Misrepresents the upgrade safety focus)
*   *On-chain sentinel / runtime monitor* (Confuses EPIC with post-deployment runtime tools)

---

## 4. Contextual Copy Specifications

*   **GitHub**:
    > `Upgrade intelligence and deployment readiness infrastructure for Solana programs. Compare layouts, track account evolution, and verify upgrade safety before deploying to mainnet.`
*   **Website**:
    > `EPIC is the upgrade safety and deployment confidence infrastructure for Solana developers. Analyze layouts, track account evolution, and verify invariants before code reaches mainnet.`
*   **Twitter**:
    > `Solana upgrades are high-risk mutations of live state. EPIC is the upgrade intelligence layer that prevents state layout corruption and security regressions before deployment. Ship with confidence.`
*   **Conference Demos**:
    > Highlight the contrast between previous and modified ASTs. Show `epic check` instantly catching field reordering or size shrinkage in a compile-time comparison, proving safety before deployment.
*   **Investor Conversations**:
    > `Every Solana program upgrade represents a risk of state layout breakage and multi-million dollar exploits. Existing tooling focuses on runtime monitoring post-incident. EPIC is the pre-deployment upgrade intelligence infrastructure that ensures layout compatibility and safety before code reaches production, establishing a new category for smart contract lifecycle safety.`

---

## 5. Core Positioning Statement

> **EPIC is the upgrade intelligence and deployment readiness infrastructure for Solana programs, preventing state layout corruption and security regressions before code reaches mainnet.**
