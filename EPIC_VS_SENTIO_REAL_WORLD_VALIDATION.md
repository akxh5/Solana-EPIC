# EPIC vs Sentio: Real-World Validation Report

This report compares **EPIC** and **Sentio (`sentio-rs`)** across parsing compatibility, type system architecture, multi-file resolution, and layout validation to identify engine improvements and differences in production scanning.

---

## 1. Executive Comparison Summary

| Metric / Feature | EPIC | Sentio |
| :--- | :--- | :--- |
| **Primary Focus** | Upgrade layout compatibility & security validation | General Solana program vulnerability auditing |
| **Upgrade Safety Check** | Yes (`epic check` checks layout shift / resize / reorder) | No (Purely static codebase vulnerability scanner) |
| **Precision Model** | Semantic SSA-lite, GuardFacts, & CFG | AST pattern matching via Rust `syn` visitor |
| **Type Resolution** | Strong (Workspace-wide type sizes & array widths) | Weak (String matching on last path segment) |
| **Anchor `@ Error` Parsing** | Silently fails & discards constraints on that field | Robust custom parser strips `@` error suffix |
| **Multi-File Scope** | Centralized type registry (prone to duplicate name crashes) | File-by-file context matching (blind to namespaces) |

---

## 2. Parser Compatibility & Syntax Robustness

During validation, `epic audit` was run against the `sentio-rs` codebase:
```bash
node packages/cli/dist/index.js audit test-repos/sentio-rs
```
*   **Result:** **PASS**. EPIC parsed `sentio-rs` successfully with zero crashes, syntax errors, or warnings.
*   **Critical Parsing Defect Found in EPIC:**
    *   Anchor supports custom error messages inside attribute lists: `#[account(constraint = x == y @ ErrorCode::MyError)]`.
    *   **Sentio** implements a custom parser (`ParsedConstraintEntry`) to peel away the `@` token and the custom error code before feeding the expression to `syn::Expr`, ensuring robust parsing.
    *   **EPIC** uses standard `syn::Meta` to parse attribute tokens. Since `@` is invalid in standard Rust expressions, `parser.parse2` inside `parse_anchor_attribute_string` fails silently and returns an empty array. **All constraints on that attribute are lost**, leading to false negatives in security checks or false positives in layout matching.

---

## 3. Architecture Assumptions

### A. Anchor Account Parsing
*   **Sentio:** Parses `#[derive(Accounts)]` structures and indexes constraints into fields (`is_signer`, `is_mut`, `token_mint`, etc.). It ignores standard Rust AST limits to support Anchor's customized attributes.
*   **EPIC:** Relies on standard Rust syntax parsing and processes attributes by replacing `mut` with `writable` before parsing. It is fragile when dealing with non-standard Anchor-specific syntax (like `@ Error` suffixes).

### B. Type Extraction
*   **Sentio:** Only inspects the last segment of the field type string. For instance, `Box<Account<'info, MyData>>` has its outer `Box` wrapper registered, and the inner type string is classified as `Account`. It does not calculate sizes.
*   **EPIC:** Performs recursive type resolution. It resolves arrays (`[u8; 32]`), standard primitives, and structures to compute the exact byte layout of state accounts, which is necessary for upgrade validation.

### C. Multi-File Handling
*   **Sentio:** Iterates over all discovered `.rs` files and loads their ASTs. Because it checks rules file-by-file with a list of all parsed files as global context, it does not build type dependency references across files, making it immune to namespace collisions but blind to import hierarchies.
*   **EPIC:** Compiles a workspace type registry to resolve types project-wide. However, it lacks path module namespaces, causing it to crash when separate files declare the same struct name (e.g. `LastUpdate` inside Kamino).

### D. Generic Wrappers
*   **Sentio:** Specifically strips away `Box` and `Ref` generics to locate underlying account types.
*   **EPIC:** Resolves all generic parameters, type aliases, and structures to determine physical serialization size.

---

## 4. Feature Coverage Comparison

### Patterns Sentio Handles but EPIC Misses
Sentio implements 17 security auditing rules for Solana code logic:
*   **Signer/Owner Validation:** SW001 (Signer check) and SW002 (Owner check) for `AccountInfo`.
*   **CPI Auditing:** SW003 (Arbitrary CPI targets) and SW008 (Missing post-CPI account reload).
*   **Token Checks:** SW009 (Mint verification) and SW010 (Authority verification) on token accounts.
*   **PDA Sizing & Entropy:** SW012 (Missing PDA seeds/bump), SW013 (Unvalidated PDA seeds), and SW021 (PDA seed collision risk from adjacent variable-length slices).
*   **Arithmetic Security:** SW005 (Checked arithmetic checks).

*EPIC currently only audits `EPIC-SEC-001` (Unchecked mutable write missing program owner validation).*

### Patterns EPIC Handles but Sentio Misses
*   **Upgrade Layout Checks:** EPIC compares two different versions of a workspace to identify:
    *   Field removals, additions, and type shifts.
    *   Middle-insertion shifts (shifting downstream field offsets).
    *   Discriminator shifts (changing instruction/account serialization keys).
    *   Account shrinkage (`SIZE_REDUCED`).
*   **Semantic SSA and Control Flow:** EPIC builds a Control Flow Graph (CFG) and checks if safety checks (e.g., owner check validations) actually dominate the write paths, whereas Sentio uses syntactical AST visitors.

---

## 5. Opportunities to Improve EPIC

To make EPIC production-ready and close gaps found during validation against Sentio, we must implement:

1.  **Anchor Attribute Error Preprocessing:**
    Add preprocessing logic in `packages/parser-v2` to strip out `@ ErrorCode` suffixes from account constraint strings before parsing them as `syn::Meta`. This fixes the silent attribute parsing drops.
2.  **Absolute Namespace Type Registry:**
    Incorporate full module import paths into the `TypeRegistry` (e.g. `program::common::LastUpdate` vs `program::last_update::LastUpdate`) to prevent crashes during workspace-wide analysis of large repos like Kamino.
3.  **Expanded Vulnerability Rule Set:**
    Integrate basic checks for unchecked math (`SW005`), arbitrary CPI program validation (`SW003`), and PDA seed collisions (`SW021`) into the EPIC semantic audit engine.
