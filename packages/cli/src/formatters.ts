import { UpgradeReport } from "./api.js";

export function formatMarkdown(result: UpgradeReport, configChanged: boolean = false): string {
  const { compatibility, report, programName, epicConfig } = result;
  const lines: string[] = [];

  const blocked = compatibility.overall === "Blocked";
  const migration = compatibility.overall === "Migration-Required";
  const safe = compatibility.overall === "Compatible";
  
  if (blocked) {
    lines.push("## 🔴 EPIC Guard: UPGRADE BLOCKED");
  } else if (migration) {
    lines.push("## 🟡 EPIC Guard: MIGRATION REQUIRED");
  } else {
    lines.push("## 🟢 EPIC Guard: APPROVED");
  }
  lines.push("");

  if (configChanged) {
    lines.push("> [!WARNING]");
    lines.push("> **UPGRADE CONFIGURATION GATE MODIFIED**");
    lines.push("> This Pull Request contains changes to `epic.toml` configuration rules.");
    lines.push("> Signers must audit the modifications below to ensure safety limits are not bypassed.");
    lines.push("");
  }

  lines.push(`### Upgrade Compatibility: \`${programName}\``);
  lines.push("");

  if (compatibility.accounts.length === 0) {
    lines.push("No state accounts found. Upgrade is safe.");
    return lines.join("\n");
  }

  for (const acc of compatibility.accounts) {
    const isBlocked = acc.status === "Blocked";
    const isMigration = acc.status === "Migration-Required";
    const icon = isBlocked ? "🔴" : isMigration ? "🟡" : "🟢";
    lines.push(`#### ${icon} Struct \`${acc.account}\` (${acc.status})`);
    
    if (acc.reasons && acc.reasons.length > 0) {
      lines.push("");
      lines.push("**Reasoning:**");
      for (const r of acc.reasons) {
        lines.push(`* ${r}`);
      }
    }

    if (acc.upgradePlan && acc.upgradePlan.length > 0) {
      lines.push("");
      lines.push("**Migration Plan:**");
      if (acc.rentDeltaLamports !== null) {
        lines.push(`* Rent Delta: \`${acc.rentDeltaLamports} lamports\` (\`${acc.sizeDelta} bytes\`)`);
      }
      for (const step of acc.upgradePlan) {
        lines.push(`* ${step}`);
      }
    }
    lines.push("");
  }

  // Overrides section
  const appliedOverrides = report.findings.filter(f => f.severity !== (f.kind === "FIELD_ADDED" ? "MAJOR" : "CRITICAL"));
  if (appliedOverrides.length > 0) {
    lines.push("### 🔑 Applied Layout Overrides");
    lines.push("");
    lines.push("| Struct | Finding | Field | Severity Shift | Note |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const o of appliedOverrides) {
      const original = o.kind === "FIELD_ADDED" ? "MAJOR" : "CRITICAL";
      // Find note
      let note = "No note provided.";
      for (const [name, program] of epicConfig.programs.entries()) {
        const match = program.overrides.find(override => 
          override.account.toLowerCase() === o.account.toLowerCase() &&
          override.finding.toUpperCase() === o.kind.toUpperCase()
        );
        if (match) { note = match.note; break; }
      }
      lines.push(`| \`${o.account}\` | \`${o.kind}\` | \`${o.field?.name || "global"}\` | \`${original}\` ──► \`${o.severity}\` | ${note} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatSarif(result: UpgradeReport): any {
  // Return a valid SARIF structure based on the findings
  const sarif = {
    version: "2.1.0",
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "EPIC Upgrade Intelligence",
            version: "0.2.0-beta.0",
            informationUri: "https://github.com/solana-epic/epic",
            rules: [] as any[]
          }
        },
        results: [] as any[]
      }
    ]
  };

  const run = sarif.runs[0];
  const rules = new Map<string, any>();

  for (const finding of result.report.findings) {
    const ruleId = `EPIC-LAYOUT-${finding.kind}`;
    if (!rules.has(ruleId)) {
      rules.set(ruleId, {
        id: ruleId,
        shortDescription: { text: `State Layout Drift: ${finding.kind}` },
        helpUri: "https://github.com/solana-epic/epic"
      });
    }
    
    // Map severity
    let level = "warning";
    if (finding.severity === "CRITICAL") level = "error";
    if (finding.severity === "SAFE") level = "note";

    run.results.push({
      ruleId,
      level,
      message: {
        text: `Account \`${finding.account}\` changed: ${finding.kind}. Field: ${finding.field?.name || 'N/A'}`
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: "epic.toml" },
            region: { startLine: 1 }
          }
        }
      ]
    });
  }

  run.tool.driver.rules = Array.from(rules.values());
  return sarif;
}
