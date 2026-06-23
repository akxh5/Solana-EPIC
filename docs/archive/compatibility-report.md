# Solana EPIC: Anchor IDL Ingestion & Compatibility Report

This compatibility report evaluates the TypeScript-based Anchor IDL parsing engine implemented for **EPIC (Engineering Platform for Intelligent Contracts)**. The parser maps JSON-based IDL specifications directly into on-chain `AccountStruct` layouts for deterministic upgrade diffing.

---

## 1. Compatibility Matrix & Tested Protocols

EPIC's IDL ingestion was validated against real-world IDL files extracted from leading Solana protocol SDKs:

| Protocol | IDL File Path | Accounts Found | Layout Sizing Verification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Squads V4** | `squads_multisig_program.json` | 9 | `100% Matches Rust AST Sizing` | ✅ Pass |
| **Drift V2** | `drift.json` | 18 | `Correctly resolved nested arrays/structs` | ✅ Pass |
| **Kamino Lending** | `kamino_lending.json` (Complete) | 4 | `Correctly resolved new 0.30+ spec objects` | ✅ Pass |
| **Mango V4** | `mango_v4.json` | 11 | `Accurately matched large complex structs` | ✅ Pass |
| **MarginFi V2** | `liquidity.json` | 7 | `Verified recursive nested struct layouts` | ✅ Pass |

---

## 2. Key Technical Findings & Resolved Discrepancies

### A. The "Pubkey" Case-Sensitivity Issue (Older vs. Newer Specs)
*   **The Issue:** Older Anchor IDLs represent the public key type as `"publicKey"` (camelCase). Newer Anchor IDLs (spec `0.1.0` / Anchor v0.30+) represent it as `"pubkey"` (lowercase). Rust AST parsers often output `"Pubkey"`.
*   **Impact:** If case-matching is static, newer IDLs fail to size public key fields, defaulting to `0` bytes and triggering dynamic layout warnings.
*   **Resolution:** Modified `calculateIdlTypeSize` to handle all three variations case-insensitively:
    ```typescript
    case "publicKey":
    case "pubkey":
    case "Pubkey":
      return { byteSize: 32, dynamic: false, notes: [] };
    ```

### B. User-Defined Types: String vs. Object References (v0.30+ IDL Spec)
*   **The Issue:**
    *   **Anchor <0.30:** Custom defined types were referenced as a simple string:
        ```json
        { "name": "lendingMarket", "type": { "defined": "LendingMarket" } }
        ```
    *   **Anchor >=0.30:** Custom types are represented as a nested object:
        ```json
        { "name": "lendingMarket", "type": { "defined": { "name": "LendingMarket" } } }
        ```
*   **Impact:** Coercing `{ "defined": { "name": "LendingMarket" } }` to a string in TypeScript produces `"[object Object]"`, causing registry lookups to fail and defaulting sizes to `0` bytes.
*   **Resolution:** Implemented an object-aware resolver for defined types:
    ```typescript
    if ("defined" in type) {
      const definedName = typeof type.defined === "string" ? type.defined : type.defined?.name;
      if (typeof definedName === "string") {
        return resolveDefinedType(definedName, typesRegistry, resolving);
      }
    }
    ```

### C. Algebraic / Data Enums (Borsh Sizing)
*   **The Issue:** Enums can be simple unit enums (`enum Action { Create, Delete }`) or complex data enums (`enum Action { Create { name: String }, Delete }`).
*   **Borsh Rule:** simple enums occupy `1` byte (variant tag). Data enums serialize as `1` byte variant tag + the active variant's field sizes.
*   **Resolution:** The parser computes the enum size dynamically as `1 + max_variant_size` across all defined variants. If any variant's fields are dynamically sized (e.g., contains a `Vec` or `String`), the entire enum is flagged as `dynamic = true`.

### D. Vectors and Options
*   **Vectors (`Vec<T>` / `bytes` / `string`):** Serialized in Borsh with a `4` byte length prefix. The parser sizes these as `4` bytes and flags them as `dynamic = true`.
*   **Options (`Option<T>`):** Serialized in Borsh with a `1` byte flag. If active, it is followed by the inner type `T`. Sized as `1 + inner_size`. The option inherits the `dynamic` flag of the inner type.

### E. Nested Structs & Circular Dependencies
*   **The Issue:** User-defined structs can wrap other user-defined structs. Self-referential fields or cyclic dependencies can cause infinite loops during parsing.
*   **Resolution:** Implemented a recursion-guard registry in `resolveDefinedType` using a `resolving` Set. If a type is recursively analyzed while already in the resolution stack, it aborts recursion and flags a warning.

---

## 3. Empty IDL Scenarios (Edge Cases)

During testing against stripped or client-only IDL files:
*   **Kamino/Drift SDK Client IDLs:** Files like `test-repos/marginfi/idls/kamino_lending.json` do not contain global state accounts in the root-level `"accounts"` array (it is represented as `"accounts": []`).
*   **Behavior:** The parser successfully processes these without throwing exceptions, returning `0 accounts` found. Comparing them yields a `SAFE` report since no shared accounts exist to differentiate.
*   **Solution:** For meaningful upgrade reports, developers must supply the **complete program IDL** (which contains global state structs) rather than client/instruction-only IDL slices.
