import fs from "node:fs";
import process from "node:process";
import { CLI_VERSION } from "./version.js";

// Colors
const isColorsEnabled = () => {
  if (process.env.NO_COLOR) return false;
  if (!process.stdout.isTTY) return false;
  return true;
};

export const colors = {
  bold: (text: string) => isColorsEnabled() ? `\x1b[1m${text}\x1b[0m` : text,
  dim: (text: string) => isColorsEnabled() ? `\x1b[2m${text}\x1b[0m` : text,
  white: (text: string) => isColorsEnabled() ? `\x1b[1;97m${text}\x1b[0m` : text,
  cyan: (text: string) => isColorsEnabled() ? `\x1b[36m${text}\x1b[0m` : text,
  gray: (text: string) => isColorsEnabled() ? `\x1b[90m${text}\x1b[0m` : text,
  success: (text: string) => isColorsEnabled() ? `\x1b[32m${text}\x1b[0m` : text,
  warning: (text: string) => isColorsEnabled() ? `\x1b[33m${text}\x1b[0m` : text,
  critical: (text: string) => isColorsEnabled() ? `\x1b[31m${text}\x1b[0m` : text,
  info: (text: string) => isColorsEnabled() ? `\x1b[34m${text}\x1b[0m` : text,
  violet: (text: string) => isColorsEnabled() ? `\x1b[35m${text}\x1b[0m` : text,
  green: (text: string) => isColorsEnabled() ? `\x1b[32m${text}\x1b[0m` : text,
  // Champagne Gold — EPIC's single brand accent (256-color, soft warm gold).
  gold: (text: string) => isColorsEnabled() ? `\x1b[38;5;222m${text}\x1b[0m` : text,
};

// Inverted "chip" badge — premium severity pills.
const chip = (text: string, fg: string, bg: string) =>
  isColorsEnabled() ? `\x1b[${fg};${bg}m ${text} \x1b[0m` : `[ ${text} ]`;

export const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
const THIN = "──────────────────────────────────────────────────";

let bannerPrinted = false;

// The EPIC wordmark — a bold, geometric block font. Rendered as the single
// brand accent (Champagne Gold) so it reads as a premium product wordmark.
const EPIC_WORDMARK = [
  "███████╗ ██████╗  ██╗  ██████╗",
  "██╔════╝ ██╔══██╗ ██║ ██╔════╝",
  "█████╗   ██████╔╝ ██║ ██║     ",
  "██╔══╝   ██╔═══╝  ██║ ██║     ",
  "███████╗ ██║      ██║ ╚██████╗",
  "╚══════╝ ╚═╝      ╚═╝  ╚═════╝",
];

const EPIC_SUBTITLE = "Upgrade Intelligence for Solana";

// Single source of truth for when the startup experience is suppressed.
// Identical conditions to the legacy banner: explicit flag, env var, non-TTY.
const bannerSuppressed = (noBannerFlag: boolean): boolean => {
  if (noBannerFlag || process.env.EPIC_NO_BANNER === "1") return true;
  if (!process.stdout.isTTY) return true;
  return false;
};

export const printBanner = (noBannerFlag: boolean = false) => {
  if (bannerPrinted) return;
  if (bannerSuppressed(noBannerFlag)) {
    bannerPrinted = true;
    return;
  }

  console.log("");
  for (const row of EPIC_WORDMARK) {
    console.log("  " + colors.gold(row));
  }
  console.log("");
  console.log("  " + colors.white(EPIC_SUBTITLE));
  console.log("  " + colors.gray(`v${CLI_VERSION}`));
  console.log("");

  bannerPrinted = true;
};

// The single reusable startup component: brand banner + contextual mode label.
// Every interactive command consumes this. Returns true when the experience was
// actually rendered (TTY, not suppressed) so callers can drop a now-redundant
// in-body title while leaving non-TTY output byte-for-byte unchanged.
export const printStartup = (mode: string, noBannerFlag: boolean = false): boolean => {
  printBanner(noBannerFlag);
  if (bannerSuppressed(noBannerFlag)) return false;

  console.log("  " + colors.gold("▌") + " " + colors.white(colors.bold(mode)));
  console.log("");
  return true;
};

export const printFinalSignature = () => {
  // Replaced by end summary
};

export const printInitSequence = (steps: string[]) => {
  if (!process.stdout.isTTY) return;
  for (const step of steps) {
    console.log(`${colors.success("✓")} ${colors.dim(step)}`);
  }
};

export const printSection = (title: string, data: Record<string, string | number>) => {
  console.log(colors.gray(DIVIDER));
  console.log(colors.white(colors.bold(title)));
  console.log(colors.gray(DIVIDER));
  console.log("");
  for (const [key, value] of Object.entries(data)) {
    const dots = colors.gray(".".repeat(Math.max(3, 20 - key.length)));
    console.log(`${colors.white(key)} ${dots} ${colors.cyan(String(value))}`);
  }
  console.log("");
};

export const formatSeverity = (sev: string) => {
  const s = sev.toUpperCase();
  if (s === "CRITICAL") return colors.critical(s);
  if (s === "HIGH") return colors.warning(s);
  if (s === "MAJOR" || s === "MEDIUM") return colors.warning(s);
  if (s === "WARNING") return colors.warning(s);
  if (s === "INFO") return colors.info(s);
  if (s === "SAFE" || s === "MINOR") return colors.success(s);
  return s;
};

// ───────────────────────────────────────────────────────────────────────────
// Risk scoring & visual primitives
// ───────────────────────────────────────────────────────────────────────────

export type RiskBand = "CRITICAL" | "HIGH" | "MAJOR" | "WARNING" | "SAFE";

export const bandForScore = (score: number): RiskBand => {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MAJOR";
  if (score >= 20) return "WARNING";
  return "SAFE";
};

// Colored severity pill, e.g.  CRITICAL .
export const severityBadge = (band: string) => {
  const b = band.toUpperCase();
  if (b === "CRITICAL") return chip("CRITICAL", "97", "41"); // white on red
  if (b === "HIGH") return chip("HIGH", "30", "43");         // black on yellow
  if (b === "MAJOR" || b === "MEDIUM") return chip("MAJOR", "30", "43");
  if (b === "WARNING") return chip("WARNING", "30", "43");
  if (b === "SAFE" || b === "MINOR") return chip("SAFE", "30", "42"); // black on green
  return chip(b, "30", "47");
};

// A 20-cell score meter colored by band. Higher score = more risk.
export const scoreBar = (score: number, width = 20): string => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  const band = bandForScore(clamped);
  const paint =
    band === "CRITICAL" ? colors.critical :
    band === "HIGH" || band === "MAJOR" || band === "WARNING" ? colors.warning :
    colors.success;
  return `${paint("█".repeat(filled))}${colors.gray("░".repeat(empty))}`;
};

// Wrap prose to a soft width so paragraphs read like a report, not a log line.
const wrap = (text: string, width = 74): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.length ? lines : [""];
};

// A labelled prose block: heading in white caps, wrapped body indented.
const block = (heading: string, body: string, paint = colors.dim) => {
  console.log(colors.bold(colors.white(heading)));
  for (const line of wrap(body)) console.log(paint(line));
  console.log("");
};

// ───────────────────────────────────────────────────────────────────────────
// Security rule knowledge (audit)
// Each rule answers: what happened, why it's dangerous, what breaks, how to fix.
// ───────────────────────────────────────────────────────────────────────────

const ruleNames: Record<string, string> = {
  "EPIC-SEC-001": "Owner Validation",
  "EPIC-SEC-002": "Missing Signer Validation",
  "EPIC-SEC-003": "Missing Post-CPI Account Reload",
  "EPIC-SEC-004": "PDA Cryptographic Seed Collision Risk",
  "EPIC-SEC-005": "Arbitrary CPI Target Program Spoofing"
};

export type RuleKnowledge = {
  desc: string;
  fix: string;
  why: string;
  historical: string;
  impact: string;
  score: number;
};

export const ruleKnowledge: Record<string, RuleKnowledge> = {
  "EPIC-SEC-001": {
    desc: "Missing Owner Validation",
    fix: "Use `#[account(owner = program_id)]`, or type the account as `Account<'info, T>` which enforces the program-owner check automatically.",
    why: "Without an owner check, the runtime will happily accept an account owned by a different program. An attacker crafts a look-alike account, the program trusts its bytes, and privileged logic executes on attacker-controlled state.",
    impact: "Forged accounts pass validation. Funds can be drained or protocol state corrupted, because every downstream check trusts data the attacker fully controls.",
    historical: "Multiple yield aggregators have been drained when forged state accounts passed checks that omitted owner validation.",
    score: 90
  },
  "EPIC-SEC-002": {
    desc: "Missing Signer Validation",
    fix: "Type the authority account as `Signer<'info>`, or add `#[account(signer)]` so the runtime requires a valid signature.",
    why: "A privileged instruction mutates state on behalf of an 'authority', but never verifies that the authority actually signed the transaction. Anyone can pass another user's public key in that slot.",
    impact: "Attackers can act as any user — withdrawing funds, changing parameters, or transferring ownership — without that user's authorization.",
    historical: "Missing signer checks are a top cause of unauthorized withdrawals and admin-takeover bugs on Solana.",
    score: 92
  },
  "EPIC-SEC-003": {
    desc: "Missing Post-CPI Account Reload",
    fix: "Call `account.reload()?` after the CPI and before reading the account's fields again.",
    why: "After a cross-program invocation mutates an account, Anchor's in-memory copy is stale. Reading it returns pre-CPI values while the on-chain state has already changed.",
    impact: "Logic runs on stale balances or flags — enabling double-spends, bypassed checks, and incorrect accounting that only appears under real CPI flows.",
    historical: "Protocols have shipped stale-account bugs from missing reloads after CPIs, leading to double-spends and logic bypasses.",
    score: 78
  },
  "EPIC-SEC-004": {
    desc: "PDA Cryptographic Seed Collision Risk",
    fix: "Insert a fixed-length seed or a literal delimiter between adjacent variable-length seeds so concatenations are unambiguous.",
    why: "Two adjacent variable-length seeds can be re-sliced into a different but equally valid pair. ['ab','c'] and ['a','bc'] hash to the same PDA, so an attacker can derive a colliding address.",
    impact: "An attacker can craft a PDA that collides with a legitimate user's account, spoofing identity or front-running account creation.",
    historical: "Improper PDA derivation has let attackers front-run legitimate users by crafting colliding seeds.",
    score: 70
  },
  "EPIC-SEC-005": {
    desc: "Arbitrary CPI Target Program Spoofing",
    fix: "Replace `AccountInfo<'info>` with `Program<'info, Token>`, or assert `require_keys_eq!(token_program.key(), spl_token::ID)` before the invoke.",
    why: "The program to call is read from an unchecked account, so the caller decides which code runs. An attacker substitutes a malicious program that mimics the expected interface.",
    impact: "The CPI executes attacker-controlled code with your program's authority — token transfers, mints, or burns can be redirected or faked.",
    historical: "Major DEXs have suffered exploits when attacker-controlled programs were passed into CPIs in place of the legitimate token program.",
    score: 88
  }
};

// Derive a numeric risk score from a finding's declared severity, falling back
// to the rule's knowledge-base score when available.
export const scoreForFinding = (finding: any): number => {
  const kb = ruleKnowledge[finding.rule_id];
  if (kb) return kb.score;
  const s = String(finding.severity || "").toUpperCase();
  if (s === "CRITICAL") return 88;
  if (s === "HIGH") return 72;
  if (s === "MAJOR" || s === "MEDIUM") return 50;
  if (s === "WARNING") return 30;
  return 10;
};

// ───────────────────────────────────────────────────────────────────────────
// Audit finding card — the "intelligent" rendering of a single finding.
// ───────────────────────────────────────────────────────────────────────────

export const printRuleFinding = (finding: any) => {
  const ruleName = finding.rule_name || ruleNames[finding.rule_id] || finding.rule_id;
  const knowledge = ruleKnowledge[finding.rule_id];
  const score = scoreForFinding(finding);
  const band = bandForScore(score);

  console.log(colors.gray(THIN));
  console.log("");
  console.log(`${severityBadge(band)}  ${colors.white(finding.rule_id)}  ${colors.gray("·")}  ${colors.white(ruleName)}`);
  console.log("");
  console.log(`${colors.dim("Risk Score")}   ${scoreBar(score)}  ${colors.white(`${score} / 100`)}`);
  console.log(`${colors.dim("Location")}     ${colors.cyan(`${finding.location.file}:${finding.location.line}`)}`);
  console.log("");

  // What happened — prefer the engine's concrete message.
  block("WHAT HAPPENED", finding.message || (knowledge ? knowledge.desc : "Security rule triggered."));

  if (knowledge) {
    block("WHY IT'S DANGEROUS", knowledge.why);
    block("WHAT BREAKS", knowledge.impact, colors.warning);
    block("HOW TO FIX", knowledge.fix, colors.green);
  } else {
    block("RECOMMENDATION", finding.recommendation || "Review and validate.", colors.green);
  }
};

// ───────────────────────────────────────────────────────────────────────────
// Upgrade intelligence knowledge (check) — keyed by RiskCategory.
// ───────────────────────────────────────────────────────────────────────────

export type UpgradeRisk = { score: number; why: string; impact: string };

export const upgradeRiskKnowledge: Record<string, UpgradeRisk> = {
  "Serialization Break": {
    score: 90,
    why: "The on-disk byte layout of this account changed. Every account already stored on-chain was serialized with the previous layout, so the offset of every field after the change no longer lines up with what the new program expects.",
    impact: "Existing accounts will fail to deserialize after deployment, or silently decode into the wrong fields. Users may be unable to access funds or state created before the upgrade."
  },
  "Account Shrink": {
    score: 88,
    why: "The account's serialized size decreased. Anchor allocates a fixed buffer per account; shrinking the layout means trailing bytes from the old layout are now reinterpreted or truncated.",
    impact: "Accounts created before the upgrade are larger than the new layout. Deserialization can truncate data or fail outright, and realloc cannot recover bytes that were already written."
  },
  "Account Expansion": {
    score: 42,
    why: "A new field was appended, increasing the account's serialized size. Appending is the safe direction for layout evolution, but only if existing accounts are grown to match.",
    impact: "Accounts created before this upgrade are smaller than the new layout. Without an explicit realloc and rent top-up, reads of the new field run past the allocated buffer."
  },
  "Field Reorder": {
    score: 86,
    why: "Persisted fields were reordered. In Borsh serialization, field order defines byte offsets — moving a field changes where every later field lives on disk.",
    impact: "Every existing account decodes into the wrong fields. Values are silently swapped rather than erroring, which is harder to detect and can corrupt accounting."
  },
  "Dynamic Type Introduction": {
    score: 72,
    why: "A dynamically-sized type (Vec, String, HashMap, …) was introduced into a persisted account. The account no longer has a fixed, predictable byte size.",
    impact: "Fixed-size accounts created before the upgrade cannot represent the new layout without migration, and unbounded growth can exceed the rent-exempt allocation."
  },
  "Enum Expansion": {
    score: 48,
    why: "An enum used in a persisted account gained or changed a variant. Old clients and indexers were compiled against the previous variant set.",
    impact: "Clients and indexers that don't know the new variant can panic or mis-decode. IDLs and SDKs must be regenerated before the new variant is written."
  },
  "Discriminator Mismatch": {
    score: 95,
    why: "An account struct or instruction was renamed, which changes its 8-byte Anchor discriminator. The discriminator is how the runtime identifies which type or instruction it is looking at.",
    impact: "Accounts stored under the old discriminator are no longer recognized, and clients calling the old instruction name fail. This breaks both existing state and existing callers."
  }
};

const KIND_TITLES: Record<string, string> = {
  FIELD_ADDED: "Field Added",
  FIELD_REMOVED: "Field Removed",
  FIELD_REORDERED: "Field Reordered",
  TYPE_CHANGED: "Type Changed",
  SIZE_REDUCED: "Account Size Reduced",
  DISCRIMINATOR_CHANGED: "Discriminator Changed"
};

// Concrete, human "what happened" sentence built from the structured finding.
const upgradeWhatHappened = (finding: any): string => {
  const f = finding.field || {};
  switch (finding.kind) {
    case "FIELD_ADDED":
      return `A new field \`${f.name}: ${f.newType ?? "?"}\` was added to account \`${finding.account}\`. Serialized size grows from ${finding.oldSize} to ${finding.newSize} bytes.`;
    case "FIELD_REMOVED":
      return `Field \`${f.name}: ${f.oldType ?? "?"}\` was removed from account \`${finding.account}\`. Serialized size changes from ${finding.oldSize} to ${finding.newSize} bytes.`;
    case "FIELD_REORDERED":
      return `The field order of account \`${finding.account}\` changed. Persisted byte offsets shift even though the set of fields is unchanged.`;
    case "TYPE_CHANGED":
      return `Field \`${f.name}\` on account \`${finding.account}\` changed type from \`${f.oldType ?? "?"}\` to \`${f.newType ?? "?"}\`.`;
    case "SIZE_REDUCED":
      return `Account \`${finding.account}\` shrank from ${finding.oldSize} to ${finding.newSize} bytes.`;
    case "DISCRIMINATOR_CHANGED":
      return `\`${f?.name ?? finding.account}\` was renamed, changing its 8-byte discriminator${f?.oldType ? ` (was ${f.oldType})` : ""}.`;
    default:
      return `Layout change detected on account \`${finding.account}\`.`;
  }
};

// item: UpgradeIntelligenceItem from diff-engine (riskCategory, affectedSurface, recommendation)
export const printUpgradeFinding = (finding: any, item: any) => {
  const knowledge = upgradeRiskKnowledge[item.riskCategory];
  const score = knowledge ? knowledge.score : scoreForFinding({ severity: finding.severity });
  const band = bandForScore(score);
  const title = KIND_TITLES[finding.kind] || "Layout Change";

  console.log(colors.gray(THIN));
  console.log("");
  console.log(`${severityBadge(band)}  ${colors.white(finding.account)}  ${colors.gray("·")}  ${colors.white(title)}  ${colors.gray("·")}  ${colors.violet(item.riskCategory)}`);
  console.log("");
  console.log(`${colors.dim("Risk Score")}   ${scoreBar(score)}  ${colors.white(`${score} / 100`)}`);
  console.log("");

  block("WHAT HAPPENED", upgradeWhatHappened(finding));
  if (knowledge) {
    block("WHY IT'S DANGEROUS", knowledge.why);
    block("WHAT BREAKS", knowledge.impact, colors.warning);
  }

  // Affected surface as a concrete bullet list.
  if (item.affectedSurface && item.affectedSurface.length) {
    console.log(colors.bold(colors.white("AFFECTED SURFACE")));
    for (const surface of item.affectedSurface) {
      console.log(colors.warning(`  • ${surface}`));
    }
    console.log("");
  }

  block("HOW TO FIX", item.recommendation, colors.green);
};

// Full upgrade report header + verdict for `epic check`.
export const printUpgradeReport = (
  report: { findings: any[]; severity: string },
  intelligence: { items: any[] },
  meta: { program: string },
  opts: { skipTitle?: boolean } = {}
) => {
  // The startup mode label ("Upgrade Intelligence") already announced the mode
  // in TTY mode; skip the redundant title there. In non-TTY the label is
  // suppressed, so the title still prints — keeping piped output unchanged.
  if (!opts.skipTitle) {
    console.log(colors.gray(DIVIDER));
    console.log(colors.white(colors.bold("EPIC UPGRADE INTELLIGENCE")));
    console.log(colors.gray(DIVIDER));
    console.log("");
  }

  if (!report.findings.length) {
    console.log(`${severityBadge("SAFE")}  ${colors.white(meta.program)}`);
    console.log("");
    block(
      "WHAT HAPPENED",
      `No structural account layout changes were detected between the two versions of \`${meta.program}\`. Field layouts, sizes, and discriminators are unchanged.`
    );
    block("WHY IT'S SAFE", "Existing on-chain accounts will continue to deserialize correctly against the new program. This upgrade does not alter persisted state layout.", colors.green);
    return 0;
  }

  // Overall risk = the worst single finding; one break dooms the migration.
  const scores = report.findings.map((f, i) => {
    const item = intelligence.items[i];
    const kb = item ? upgradeRiskKnowledge[item.riskCategory] : undefined;
    return kb ? kb.score : scoreForFinding({ severity: f.severity });
  });
  const overall = Math.max(...scores);
  const band = bandForScore(overall);

  console.log(`${colors.dim("Program")}       ${colors.white(meta.program)}`);
  console.log(`${colors.dim("Findings")}      ${colors.white(String(report.findings.length))}`);
  console.log(`${colors.dim("Upgrade Risk")}  ${scoreBar(overall)}  ${colors.white(`${overall} / 100`)}  ${severityBadge(band)}`);
  console.log("");

  report.findings.forEach((finding, i) => {
    printUpgradeFinding(finding, intelligence.items[i]);
  });

  return overall;
};

// ───────────────────────────────────────────────────────────────────────────
// End summary (audit)
// ───────────────────────────────────────────────────────────────────────────

export const printEndSummary = (projectName: string, rulesExec: number, critical: number, high: number, timeMs: number, nextSteps: string[] = []) => {
  console.log(colors.gray(DIVIDER));
  console.log("");
  console.log(colors.bold(colors.white("EPIC Security Report")));
  console.log("");

  const deduction = (critical * 20) + (high * 10);
  let score = 100 - deduction;
  if (score < 0) score = 0;

  let status = "Unsafe For Deployment";
  let statusColor = colors.critical;
  if (score >= 95) { status = "Production Ready"; statusColor = colors.success; }
  else if (score >= 80) { status = "Minor Issues"; statusColor = colors.info; }
  else if (score >= 60) { status = "Needs Review"; statusColor = colors.warning; }
  else if (score >= 40) { status = "High Risk"; statusColor = colors.warning; }

  const printLine = (key: string, val: string | number) => {
    const spaces = " ".repeat(Math.max(1, 15 - key.length));
    console.log(`${colors.dim(key)}${spaces}${colors.white(String(val))}`);
  };

  printLine("Repository", projectName);
  console.log("");
  printLine("Score", `${score} / 100`);
  console.log(`${colors.dim("Health")}         ${scoreBar(100 - score)}  ${statusColor(status)}`);
  console.log("");
  printLine("Critical", critical);
  printLine("High", high);
  console.log("");
  printLine("Scan Time", (timeMs / 1000).toFixed(2) + " seconds");
  printLine("Generated by", `EPIC v${CLI_VERSION}`);
  console.log("");
  console.log(colors.dim("Know your upgrade before mainnet."));
  console.log("");
  console.log(colors.gray(DIVIDER));
  console.log("");

  // Tips
  const tips = [
    "Run: epic explain EPIC-SEC-003 to understand this vulnerability.",
    "Use: epic audit . --format markdown to generate a GitHub-ready report.",
    "Use: epic audit . --format sarif to upload findings to GitHub code scanning.",
    "Run: epic doctor to check your environment.",
    "Run: epic audit . --include-tests to analyze test directories.",
  ];
  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  console.log(colors.bold(colors.white("Tip")));
  console.log(colors.cyan(randomTip));
  console.log("");
};
