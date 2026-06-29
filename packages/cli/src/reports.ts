// Report generators for `epic audit`: SARIF 2.1.0 (GitHub code-scanning) and
// a PR-ready Markdown report. Both are plain strings — never colored — so they
// are safe to redirect to a file or paste into a pull request.

import { CLI_VERSION } from "./version.js";
import { ruleKnowledge, scoreForFinding } from "./ui.js";

const RULE_NAMES: Record<string, string> = {
  "EPIC-SEC-001": "Owner Validation",
  "EPIC-SEC-002": "Missing Signer Validation",
  "EPIC-SEC-003": "Missing Post-CPI Account Reload",
  "EPIC-SEC-004": "PDA Cryptographic Seed Collision Risk",
  "EPIC-SEC-005": "Arbitrary CPI Target Program Spoofing"
};

const HELP_BASE = "https://github.com/solana-epic/epic#readme";

const ruleName = (id: string, fallback?: string) => RULE_NAMES[id] || fallback || id;

// Map an EPIC severity string to a SARIF result level.
const sarifLevel = (severity: string): "error" | "warning" | "note" => {
  const s = String(severity || "").toUpperCase();
  if (s === "CRITICAL" || s === "HIGH") return "error";
  if (s === "MAJOR" || s === "MEDIUM" || s === "WARNING") return "warning";
  return "note";
};

const securityScore = (finding: any): string => (scoreForFinding(finding) / 10).toFixed(1); // 0.0–10.0

// Build a valid SARIF 2.1.0 log. Rule metadata is derived from the knowledge
// base so GitHub renders full descriptions and help text, and security-severity
// drives ordering in the Security tab.
export function generateSarif(findings: any[]): object {
  const ruleIds = Array.from(new Set(findings.map((f) => f.rule_id)));

  const rules = ruleIds.map((id) => {
    const kb = ruleKnowledge[id];
    const name = ruleName(id);
    return {
      id,
      name,
      shortDescription: { text: kb ? kb.desc : name },
      fullDescription: { text: kb ? kb.why : name },
      helpUri: HELP_BASE,
      help: kb
        ? { text: `${kb.why}\n\nImpact: ${kb.impact}\n\nFix: ${kb.fix}` }
        : { text: name },
      defaultConfiguration: { level: kb && kb.score >= 80 ? "error" : "warning" },
      properties: {
        tags: ["security", "solana", "anchor"],
        "security-severity": kb ? (kb.score / 10).toFixed(1) : "5.0"
      }
    };
  });

  const ruleIndex = new Map(ruleIds.map((id, i) => [id, i]));

  const results = findings.map((f) => {
    const kb = ruleKnowledge[f.rule_id];
    const messageText = kb
      ? `${f.message}\n\nWhy it's dangerous: ${kb.why}\n\nWhat breaks: ${kb.impact}\n\nHow to fix: ${kb.fix}`
      : f.message;
    return {
      ruleId: f.rule_id,
      ruleIndex: ruleIndex.get(f.rule_id),
      level: sarifLevel(f.severity),
      message: { text: messageText },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: f.location.file },
            region: {
              startLine: Math.max(1, f.location.line || 1),
              startColumn: Math.max(1, (f.location.column || 0) + 1)
            }
          }
        }
      ],
      partialFingerprints: {
        epicFingerprint: `${f.rule_id}:${f.location.file}:${f.location.line}`
      },
      properties: { "security-severity": securityScore(f) }
    };
  });

  return {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "EPIC",
            informationUri: HELP_BASE,
            version: CLI_VERSION,
            rules
          }
        },
        results
      }
    ]
  };
}

const SEV_EMOJI: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MAJOR: "🟡",
  WARNING: "🟡",
  SAFE: "🟢"
};

const bandForScore = (score: number): string => {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MAJOR";
  if (score >= 20) return "WARNING";
  return "SAFE";
};

// A GitHub-ready Markdown report: badge-style summary, a severity table, and a
// full What/Why/Breaks/Fix breakdown per finding — the kind of artifact a
// developer attaches to a pull request or audit.
export function generateMarkdown(findings: any[], meta: { project: string; scanMs: number }): string {
  const critical = findings.filter((f) => scoreForFinding(f) >= 80).length;
  const high = findings.filter((f) => { const s = scoreForFinding(f); return s >= 60 && s < 80; }).length;
  const lower = findings.length - critical - high;

  const healthScore = Math.max(0, 100 - (critical * 20 + high * 10 + lower * 4));
  const verdict =
    healthScore >= 95 ? "✅ Production Ready" :
    healthScore >= 80 ? "🟢 Minor Issues" :
    healthScore >= 60 ? "🟡 Needs Review" :
    healthScore >= 40 ? "🟠 High Risk" :
    "🔴 Unsafe For Deployment";

  const lines: string[] = [];
  lines.push("# 🛡️ EPIC Security Report");
  lines.push("");
  lines.push(`> **${verdict}** — Health Score **${healthScore} / 100**`);
  lines.push("");
  lines.push(`**Repository:** \`${meta.project}\`  `);
  lines.push(`**Scan time:** ${(meta.scanMs / 1000).toFixed(2)}s  `);
  lines.push(`**Generated by:** EPIC v${CLI_VERSION}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Severity | Count |");
  lines.push("| --- | --- |");
  lines.push(`| 🔴 Critical | ${critical} |`);
  lines.push(`| 🟠 High | ${high} |`);
  lines.push(`| 🟡 Other | ${lower} |`);
  lines.push(`| **Total** | **${findings.length}** |`);
  lines.push("");

  if (findings.length === 0) {
    lines.push("No security findings. This program passed all EPIC rules. ✅");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## Findings");
  lines.push("");

  findings.forEach((f, idx) => {
    const kb = ruleKnowledge[f.rule_id];
    const score = scoreForFinding(f);
    const band = bandForScore(score);
    const emoji = SEV_EMOJI[band] || "🟡";
    const name = ruleName(f.rule_id, f.rule_name);

    lines.push(`### ${idx + 1}. ${emoji} ${f.rule_id} · ${name}`);
    lines.push("");
    lines.push(`**Risk Score:** ${score} / 100 (${band})  `);
    lines.push(`**Location:** \`${f.location.file}:${f.location.line}\``);
    lines.push("");
    lines.push(`**What happened**  `);
    lines.push(f.message || (kb ? kb.desc : "Security rule triggered."));
    lines.push("");
    if (kb) {
      lines.push(`**Why it's dangerous**  `);
      lines.push(kb.why);
      lines.push("");
      lines.push(`**What breaks**  `);
      lines.push(kb.impact);
      lines.push("");
      lines.push(`**How to fix**  `);
      lines.push(kb.fix);
      lines.push("");
    } else if (f.recommendation) {
      lines.push(`**Recommendation**  `);
      lines.push(f.recommendation);
      lines.push("");
    }
  });

  lines.push("---");
  lines.push("*Generated by [EPIC](https://github.com/solana-epic/epic) — upgrade intelligence for Solana programs.*");
  lines.push("");
  return lines.join("\n");
}
