# Security Rules Registry

This registry catalogues all active security checks executed by the EPIC compiler engine.

---

## Active Security Rules

### 1. `EPIC-SEC-001: Owner Validation`
*   **Severity**: `CRITICAL`
*   **Exploit Class**: Missing Program Owner Check
*   **Description**: Ensures that all mutable account writes are protected by an ownership validation check (`account.owner == program_id`) that dominates the write path.
*   **Example Finding**:
    ```json
    {
      "rule_id": "EPIC-SEC-001",
      "severity": "Critical",
      "message": "Mutable write to account 'vault' lacks program owner verification.",
      "location": { "file": "src/lib.rs", "line": 22 }
    }
    ```

---

### 2. `EPIC-SEC-002: Missing Signer Validation`
*   **Severity**: `CRITICAL`
*   **Exploit Class**: Privilege Escalation / Administrative Spoofing
*   **Description**: Verifies that authority-like accounts performing privileged instructions (mutating global state or initiating transfers) are validated as signers.
*   **Example Finding**:
    ```json
    {
      "rule_id": "EPIC-SEC-002",
      "severity": "Critical",
      "message": "Privileged instruction mutation lacks signer verification for authority-like account 'admin'.",
      "location": { "file": "src/lib.rs", "line": 40 }
    }
    ```

---

### 3. `EPIC-SEC-003: Missing Post-CPI Account Reload`
*   **Severity**: `CRITICAL`
*   **Exploit Class**: Stale Cache State Access / Double Spend
*   **Description**: Identifies state accesses (reads/writes) to deserialized accounts following a mutating Cross-Program Invocation (CPI) without an intervening reload of the state cache.
*   **Example Finding**:
    ```json
    {
      "rule_id": "EPIC-SEC-003",
      "severity": "Critical",
      "message": "State access to 'vault' occurs after a CPI mutation without reloading. The account's in-memory data layout may be stale.",
      "location": { "file": "src/lib.rs", "line": 33 }
    }
    ```

---

### 4. `EPIC-SEC-004: PDA Cryptographic Seed Collision Risk`
*   **Severity**: `HIGH`
*   **Exploit Class**: PDA Derivation Hijacking
*   **Description**: Scans for adjacent variable-length seeds (e.g. strings or raw byte arrays) passed during PDA derivation without boundary separation.
*   **Example Finding**:
    ```json
    {
      "rule_id": "EPIC-SEC-004",
      "severity": "High",
      "message": "Potential PDA cryptographic seed collision risk. Adjacent variable-length seeds 'name.as_bytes()' and 'symbol.as_bytes()' can merge ambiguously.",
      "location": { "file": "src/lib.rs", "line": 15 }
    }
    ```

---

### 5. `EPIC-SEC-005: Arbitrary CPI Target Program Spoofing`
*   **Severity**: `CRITICAL`
*   **Exploit Class**: Untrusted Execution Redirect (CPI hijacking)
*   **Description**: Flags any Cross-Program Invocation (CPI) targets whose executable account keys are supplied by the caller without dominating program ID assertions.
*   **Example Finding**:
    ```json
    {
      "rule_id": "EPIC-SEC-005",
      "severity": "Critical",
      "message": "Arbitrary CPI target program validation missing for program account 'token_program'.",
      "location": { "file": "src/lib.rs", "line": 98 }
    }
    ```
