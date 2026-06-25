# Changelog

All notable changes to the EPIC project will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0-beta.2] - 2026-06-25

This release transforms the EPIC CLI from a static analyzer into a premium, interactive, and educational security workflow.

### Added
*   **Intelligent CLI Workflow**: `epic audit` now groups findings intelligently, displays occurrence metrics, and dynamically generates actionable Next Steps based on audit priority.
*   **Rule Knowledge Engine**: Embeds rich historical context, actionable fixes, and conceptual explanations into findings directly inside the terminal.
*   **Diagnostics Mode**: Added `epic doctor` to automatically verify system environment dependencies (Rust, Cargo, Node.js, Configuration, Workspace structure).
*   **Explanation Mode**: Added `epic explain <rule_id>` for on-demand deep-dive rule education containing severity mapping, threat models, safe/unsafe examples, and historical vulnerabilities.
*   **Smart Security Score**: The audit summary now calculates a dynamic `Security Score` spanning confidence bands (`Production Ready`, `Minor Issues`, `Needs Review`, `High Risk`, `Unsafe For Deployment`).

### Changed
*   **Terminal Aesthetics**: Replaced the large ASCII banner with a highly polished typography-driven header. Extensively utilized `bold`, `dim`, `cyan`, and precise alignments for a Cargo/Rust analyzer-like premium feel.
*   **Repository Filtering**: Improved parsing logic to automatically ignore test suites, `.git`, `node_modules`, `vendor`, and `fixtures` by default to ensure only production logic affects security scores. Added overrides (`--include-tests`, `--all`).
*   **Publish Pipeline**: Overhauled `scripts/publish.sh` to enforce real `npm publish`, integrate interactive 2FA prompt support, verify real-time registry deployments, and implement a `--from` resume flag.

### Developer Experience
*   **Execution Metrics**: Added detailed elapsed timing visualizations dividing processing across AST Build, Call Graph extraction, Rule Execution, and Rendering.
*   **Repository Overview**: Generates a fast breakdown of parsed code blocks (Rust Files, Instructions, Accounts, CPIs, PDAs, Programs) prior to rule execution.
*   **Contextual Hints**: Introduced dynamically rolling tips at the end of execution to improve command discovery (e.g., using `--markdown`).
*   **Output Modes**: Expanded `--format` support providing clean JSON output for programmatic ingestion and Markdown rendering for PR comments.

### Fixed
*   **Release Pipeline Simulator Flaw**: Replaced the mock npm publisher (`mock-npm.sh`) with strict production npm registry calls.
*   **Finding Noise**: Resolved issues where dummy test cases would artificially deflate the overall security score of the project.

---

## [0.1.0-beta.1] - 2026-06-18

This is the initial public beta release of the Engineering Platform for Intelligent Contracts (EPIC), providing deterministic state layout verification and ABI compatibility audits for Solana program upgrades.

### Added
*   **Rust AST Parsing Engine (`parser-v2`)**: Compiles and parses Anchor/Rust program structures, state accounts, enums, and type aliases without compile-time cargo steps.
*   **Workspace Packages**:
    *   `@epic/cli`: Command-line executable (`epic`) featuring a multi-layered native binary loader.
    *   `@epic/parser`: Configuration parser for `epic.toml` integrating Zod-schema constraints, wildcard block lists, and security gates.
    *   `@epic/diff-engine`: Comparison engine matching account layouts, analyzing offset drift, type width reductions, and realloc constraints.
    *   `@epic/github-action`: CI pull-request reporter displaying status banners, summary findings tables, and active configuration overrides.
*   **Native Binary Loader**: Automatically detects target platforms and architectures (`darwin-arm64`, `darwin-x64`, `linux-x64`, `win32-x64`) and resolves the host wrapper.
*   **Configuration Mutes (`epic.toml`)**: Custom mutes and override rules to silence specific layout drift warnings, gated by strict security validation rules (blocking wildcard overrides, note lengths, and critical layout overrides).
*   **Validation Suite**: 42 unit and integration tests executing configuration loads, layout drift compares, action HTML/markdown report formatting, and loader checks.
*   **Packaging and Install Runners**:
    *   `package-local.mjs` for workspace packing.
    *   `test-local-install.mjs` to verify isolated npm tarball installation.

### Fixed
*   **TS Tarball Packing**: Added explicit `"files": ["dist"]` filters to TypeScript packages to prevent compiled folders from being ignored by gitignore constraints during packaging.
*   **Inline TOML Parsing**: Resolved AST parsing bugs on inline configurations inside the parser.
