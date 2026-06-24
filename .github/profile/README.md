# EPIC

> **Security-first upgrade intelligence for Solana programs.**  
> *Know what changes. Know what breaks. Ship with confidence.*

---

EPIC is a static analysis and upgrade intelligence platform designed specifically for serious Solana protocol teams. It evaluates program account changes, ABI compatibility, and security invariants before deployments reach mainnet, bridging the gap between compiler output and runtime safety.

## Why Upgrade Intelligence Matters

In Solana, the state layout of a program evolves over time. A single offset shift, field width reduction, or missing cache reload during a Cross-Program Invocation (CPI) can cause immediate state corruption or catastrophic asset locks. 

EPIC shifts safety validation from runtime post-mortems to compile-time guarantees, providing developers with absolute confidence in every upgrade.

## Core Capabilities

*   **Upgrade Compatibility Analysis**: Detect state layout drift, field reordering, width changes, and Anchor discriminator shifts between program versions.
*   **Static Invariant Verification**: Validate account ownership checks, transaction signer requirements, post-CPI state reloads, and PDA derivation seed boundaries.
*   **Layout Evolution Metrics**: Map serialized account byte offsets, allocations, and complexity characteristics to manage growth impact.
*   **Continuous Integration Gate**: Automate checks in pull requests via GitHub Actions to block breaking layout changes before merging.

## Installation

Install the CLI globally:

```bash
npm install -g @solana-epic/cli
```

## Repositories

*   **[epic](https://github.com/solana-epic/epic)** — The core Rust syn-based static analyzer, TypeScript CLI wrapper, and GitHub Action.
*   **[epic-web](https://github.com/solana-epic/epic-web)** — The web dashboard and upgrade monitoring interface for protocol tracking.

## Roadmap

*   [ ] IDL-aware automatic state upgrade checkers
*   [ ] Native inline editor diagnostics (LSP integration)
*   [ ] Expanded compile-time security invariant rules
*   [ ] Automated layout patching suggestions

## Contributing

We welcome code contributions, issue reports, and RFC feedback. Review the contribution guidelines in the core repository to get started.

---

*EPIC is open-source developer tooling licensed under the MIT License.*
