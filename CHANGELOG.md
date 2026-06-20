# Changelog

All notable changes to the EPIC project will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
