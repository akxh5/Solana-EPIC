import type { RawEpicConfig } from "./types.js";

const BANNED_FINDINGS = new Set(["FIELD_REMOVED", "FIELD_REORDERED"]);

export function validateEpicConfigSecurity(config: RawEpicConfig): void {
  if (!config.programs) {
    return;
  }

  for (const [programName, program] of Object.entries(config.programs)) {
    if (!program.overrides) {
      continue;
    }

    for (const override of program.overrides) {
      // 1. Wildcard detection
      if (
        override.account.includes("*") ||
        override.finding.includes("*") ||
        (override.field && override.field.includes("*"))
      ) {
        throw new Error(
          `ConfigValidationError: Wildcard overrides are forbidden in epic.toml to prevent broad security bypasses. ` +
          `Offending account: "${override.account}" in program: "${programName}".`
        );
      }

      // 2. Banned findings (Unbreakable Rules)
      const normalizedFinding = override.finding.toUpperCase();
      if (BANNED_FINDINGS.has(normalizedFinding)) {
        throw new Error(
          `SecurityViolationError: Overriding critical layout mutations (${override.finding}) is strictly forbidden. ` +
          `Offending account: "${override.account}" in program: "${programName}".`
        );
      }

      // 3. Note length check (extra fallback guard)
      if (!override.note || override.note.trim().length < 10) {
        throw new Error(
          `ConfigValidationError: Override note must be at least 10 characters long. ` +
          `Offending account: "${override.account}" in program: "${programName}".`
        );
      }
    }
  }
}
