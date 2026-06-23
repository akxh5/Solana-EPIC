# EPIC Public Beta Readiness Audit (v0.1)

> **Audit Perspective**: Solana Protocol Engineer, Open-Source Maintainer, Superteam Grant Reviewer, and First-Time GitHub Visitor.
> **Date**: June 18, 2026
> **Objective**: Critically evaluate the current repository state and list the exact gaps remaining before public beta launch, developer testing, and grant application submission.

---

## 1. Persona-Based Auditing & Friction Points

### A. Solana Protocol Engineer
*   **The friction**: I cannot easily install or run this tool today.
*   **Blocking issues**:
    1.  **Registry Absence**: The npm packages (`@epic/cli`, `@epic/parser`, etc.) are not published. Running `npm install -g @epic/cli` throws a 404.
    2.  **Binary Dependency Trap**: If I clone the repo to run it locally, the CLI loader immediately crashes because the precompiled `parser-v2` Rust binary does not exist in the package distribution folders. I have to install the Rust toolchain, navigate to `packages/parser-v2`, and compile the binary myself.
    3.  **Configuration Scaffolding**: There is no command like `epic init` to bootstrap an initial `epic.toml` configuration mapping for my monorepo workspaces, forcing manual config creation.

### B. Open-Source Maintainer
*   **The friction**: The repository lacks contribution and test execution guardrails.
*   **Blocking issues**:
    1.  **Contribution Friction**: There is no `CONTRIBUTING.md` describing how the TypeScript workspaces compile, how the Node.js loader bridges to the Rust parser binary during development, or how to run tests.
    2.  **ESM/CJS Mixed Boundaries**: `@epic/parser` and `@epic/diff-engine` compile to ES Modules (ESM), whereas `@epic/github-action` compiles to CommonJS (CJS). A developer trying to create local package symlinks or add new utilities faces module loading compilation boundaries.
    3.  **Missing CI Workflows**: While tests are configured inside the workspaces, there is no root `.github/workflows/test.yml` to automatically verify code compiles and tests pass on incoming pull requests.

### C. Superteam Grant Reviewer
*   **The friction**: The product marketing materials claim features that do not exist in the code.
*   **Blocking issues**:
    1.  **Unsupported Claims (Proof Gaps)**: The `README.md` and architecture docs state that EPIC prevents PDA seed mismatches and executes "ABI compatibility audits." However, the v0.1 codebase does not parse PDA derivation seeds (it only checks struct layouts) and doesn't evaluate instruction context boundaries.
    2.  **No Partnership/Integration Proof**: The validation table claims 100% correctness against Drift, Marginfi, etc., but these are run on local simulated fixtures. There is no proof or testimonial that real protocol engineers have configured or run the tool on their active repositories.

### D. First-Time GitHub Visitor
*   **The friction**: There is no visual demo or working installation command.
*   **Blocking issues**:
    1.  **Copy-Paste Command Fails**: The main `README.md` provides commands to install and run the tool, but these packages are not live, leading to an immediate bounce.
    2.  **Lack of Visual Assets**: There is no terminal animation (e.g. asciinema) or screenshot demonstrating the report comment layout on a PR, making the value proposition feel theoretical.

---

## 2. Evidence Assessment (Strongest vs. Weakest)

### The Strongest Evidence
*   **The 15-Case Upgrade Validation Suite**: The matrix in `HISTORICAL_VALIDATION.md` and the automated tests in `packages/diff-engine/test/compare.test.mjs` and `packages/parser/test/config.test.mjs` are highly robust. They prove that EPIC accurately classifies historical layout shifts, padding repurposes, and size modifications against real-world protocol history with 100% accuracy.
*   **Local Execution Security**: The architecture is 100% local and compile-free, which appeals strongly to protocol engineers who reject SaaS dashboards due to code leakage and security exploit vectors.

### The Weakest Evidence
*   **Zero-Copy Alignment**: The documentation claims compatibility with `zero_copy` layouts, but the engine does not validate compiler-inserted padding bytes or memory alignment constraints.
*   **PDA Seed Shift Protection**: Listed as a key differentiator, but there is zero parser code targeting seed derivations in v0.1.

---

## 3. Roadmap Auditing: Mandatory vs. Unnecessary for Beta

### Mandatory for Public Beta
1.  **NPM Registry Publication**: Set up the platform optional dependencies packaging pipeline and publish `@epic/cli` to the public registry.
2.  **GitHub Action Tag Release**: Assemble, build, and publish the action to the GitHub Action Marketplace under a v0.1 release tag.
3.  **Documentation Cleanup**: Remove or reposition unsupported claims (like PDA seed checks and ABI boundary checking) to avoid developer complacency and auditor distrust.
4.  **Auto-CI Pipeline**: Create `.github/workflows/test.yml` to execute tests on every PR.

### Unnecessary for Public Beta (Defer to v0.2+)
1.  **Dockerized `solana-verify`**: A useful verification check, but not blocking the beta release of state layout checks.
2.  **Squads Multisig Embedded Layout Proposals**: High implementation effort; can wait for a stable v1.0 release.
3.  **Dynamic Sizing Offset Shift Tracking**: Very complex layout boundary mathematics; static layouts analysis is sufficient for beta adoption.

---

## 4. Execution Backlog: Remaining Tasks

### A. Before GitHub Public Launch
*   [ ] Fix the documentation in `README.md` to remove claims regarding PDA seeds and ABI audits, positioning EPIC strictly as a "State Layout Drift Guard."
*   [ ] Add an interactive terminal output block or link to a visual screenshot in `README.md`.
*   [ ] Create a `CONTRIBUTING.md` outlining local workspace compilation commands.
*   [ ] Add a `.github/workflows/test.yml` file to run `npm run build && npm test` on pull requests.

### B. Before Superteam Application
*   [ ] Complete and audit [EPIC_PROOF_GAPS.md](file:///Users/aksh/Documents/Solana%20EPIC/EPIC_PROOF_GAPS.md) and [docs/examples/README.md](file:///Users/aksh/Documents/Solana%20EPIC/docs/examples/README.md) to showcase validation matrices.
*   [ ] Write a concise, evidence-driven project deck linking to local test execution logs.
*   [ ] Prepare a demo recording script demonstrating `epic check` running on the Squads or Drift upgrade fixtures.

### C. Before First External User Testing
*   [ ] Compile and distribute local tarball binaries to pilot engineers (e.g. at Drift or Marginfi) to verify loader path resolution without publishing to the registry.
*   [ ] Add casing normalization checks on struct comparisons to prevent false positives when matching AST structs to configuration files.
*   [ ] Implement a basic command `epic init` that writes a default `epic.toml` configuration template file.
