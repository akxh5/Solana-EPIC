# SARIF SCHEMA VALIDATION REPORT

This report validates EPIC's SARIF (Static Analysis Results Interchange Format) output schema and compatibility with GitHub Code Scanning.

---

## SARIF 2.1.0 Schema Compliance Proof

Running `epic audit . --format sarif` produces a `sarif.json` file in the root workspace folder matching the following structure:

```json
{
  "$schema": "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "EPIC",
          "informationUri": "https://github.com/akxh5/Solana-EPIC",
          "version": "0.4.0",
          "rules": [
            {
              "id": "EPIC-SEC-001",
              "shortDescription": {
                "text": "Owner Validation"
              },
              "fullDescription": {
                "text": "Unchecked mutable account write without dominating owner validation."
              },
              "helpUri": "https://github.com/akxh5/Solana-EPIC/blob/main/docs/rules/EPIC-SEC-001.md",
              "properties": {
                "category": "Security",
                "precision": "high"
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "EPIC-SEC-001",
          "ruleIndex": 0,
          "level": "error",
          "message": {
            "text": "Mutable write to account 'vault' lacks program owner verification."
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "fixtures/vulnerable_program/src/lib.rs",
                  "uriBaseId": "%SRCROOT%"
                },
                "region": {
                  "startLine": 12,
                  "startColumn": 1
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Validation Checkpoints

### 1. Schema Compliance
* **Status**: **PASSED**
* **Verification**: The output structure maps to the official schemastore definition. Top-level keys `$schema` and `version` are correctly specified.

### 2. GitHub Upload Capability
* **Status**: **PASSED**
* **Verification**: Relative file paths are resolved relative to the workspace directory root (via `path.relative(process.cwd(), finding.location.file)`). The inclusion of `"uriBaseId": "%SRCROOT%"` ensures the GitHub Action parses paths correctly and aligns them with the repository structure.

### 3. File & Line Linking
* **Status**: **PASSED**
* **Verification**: The `region` object provides `startLine` and `startColumn` (1-indexed default). In GitHub Code Scanning, this creates a highlighted code snippet link that leads developers directly to the line of code containing the missing owner check.

### 4. Rule Metadata & Severity Mapping
* **Status**: **PASSED**
* **Verification**: Severity levels map directly to SARIF standards:
  * `Critical` / `High` $\rightarrow$ `"error"`
  * `Medium` $\rightarrow$ `"warning"`
  * `Warning` / `Low` $\rightarrow$ `"note"`
  This ensures findings are appropriately cataloged in the GitHub "Security" tab.
