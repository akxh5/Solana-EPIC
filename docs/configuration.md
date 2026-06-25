# Configuration Reference

EPIC uses an `epic.toml` configuration file located at the root of your workspace. If no file is present, EPIC uses safe defaults.

## Example `epic.toml`

```toml
[epic]
fail_on_severity = "CRITICAL" # Valid options: "SAFE", "MINOR", "MAJOR", "CRITICAL"

[epic.rules]
ignore = [
    "EPIC-SEC-004" # Array of rule IDs to ignore during audits
]
```

## Options

### `[epic]`

*   **`fail_on_severity`**: Controls the exit code of `epic audit` and `epic check`. If any finding equals or exceeds this severity level, EPIC exits with `1`. Useful for blocking CI/CD pipelines.

### `[epic.rules]`

*   **`ignore`**: An array of string rule IDs to bypass. Findings matching these rules will not be reported and will not fail audits.
