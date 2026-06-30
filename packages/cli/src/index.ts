#!/usr/bin/env node
import { Command } from "commander";
import { analyzePrograms, compareAccountLayouts, createUpgradeIntelligence, simulateCompatibility } from "@solana-epic/diff-engine";
import { config } from "@solana-epic/parser";
import { spawnSync, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const program = new Command();
import { CLI_VERSION } from "./version.js";

program
  .name("epic")
  .description("EPIC CLI for Solana Upgrade Intelligence (powered by parser-v2 Rust AST engine).")
  .version(CLI_VERSION)
  .option("--no-banner", "Disable the startup banner");

import { resolveParserBinary } from "./loader.js";
import { printStartup, getBannerString, printInitSequence, printSection, printRuleFinding, colors, formatSeverity, printEndSummary, printUpgradeReport, printCompatibilityReport, severityBadge, scoreBar, bandForScore, scoreForFinding, DIVIDER, ruleKnowledge } from "./ui.js";
import { generateSarif, generateMarkdown } from "./reports.js";

// Count Rust source files under a path (real, not fabricated metrics).
function countRustFiles(target: string): number {
  let count = 0;
  const skip = new Set([".git", "target", "node_modules", "vendor"]);
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (skip.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".rs")) {
        count++;
      }
    }
  };
  try {
    const stat = fs.statSync(target);
    if (stat.isFile()) return target.endsWith(".rs") ? 1 : 0;
  } catch {
    return 0;
  }
  walk(target);
  return count;
}

function findRustBinary(): string {
  try {
    return resolveParserBinary();
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}

program
  .command("analyze")
  .description("Analyze a Solana program workspace and report state account sizes.")
  .argument("<path>", "Path to an Anchor project, Rust source directory, or Rust file")
  .action((targetPath: string) => {
    const startTime = Date.now();
    try {
      const opts = program.opts();
      printStartup("Workspace Analysis", !opts.banner);

      printInitSequence([
        "Rust AST Loaded",
        "Parsing Anchor Workspace",
        "Building Call Graph"
      ]);
      console.log("");

      const binary = findRustBinary();
      const resolvedPath = path.resolve(targetPath);

      const result = spawnSync(binary, [resolvedPath], { encoding: "utf-8" });
      
      if (result.error) {
        throw new Error(`Failed to execute parser-v2 binary: ${result.error.message}`);
      }
      
      if (result.status !== 0) {
        console.error(result.stderr || `Execution failed with status code ${result.status}`);
        process.exit(result.status ?? 1);
      }

      const report = JSON.parse(result.stdout.trim());
      
      printSection("Workspace", {
        Project: path.basename(resolvedPath),
        Structs: report.structs_found,
        Enums: report.enums_found,
        Aliases: report.aliases_found
      });
      
      printSection("Parser", {
        Engine: "Rust AST v2",
        Status: "Ready"
      });

      if (!report.accounts || report.accounts.length === 0) {
        console.log(colors.info("No state accounts (#[account] structures) found.\n"));
      } else {
        console.log(colors.bold("STATE ACCOUNTS"));
        console.log("");
        for (const account of report.accounts) {
          const layoutType = account.dynamic ? "Dynamic" : "Static";
          const prefix = account.dynamic ? colors.warning("⚠️") : "├──";
          console.log(`${prefix} ${colors.white(account.account)} (${account.size} bytes) [${colors.dim(account.namespace)}] [${colors.cyan(layoutType)}]`);
          if (account.dynamic) {
            console.log(`   └─ ${colors.warning("Warning:")} Dynamic size detected. Static layout realloc checks may be inaccurate.`);
          }
        }
        console.log("");
      }

      printEndSummary(path.basename(resolvedPath) || ".", 0, 0, 0, Date.now() - startTime);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`epic analyze failed: ${message}`);
      process.exit(1);
    }
  });

program
  .command("check")
  .description("Compare two Solana program workspace versions and report upgrade readiness.")
  .option("-c, --config <path>", "Path to epic.toml configuration file")
  .option("-f, --format <format>", "Output format: text, json", "text")
  .argument("<old_path>", "Path to the old program version source directory")
  .argument("<new_path>", "Path to the new program version source directory")
  .action(async (oldPath: string, newPath: string, options: { config?: string; format?: string }) => {
    const startTime = Date.now();
    const isJson = options.format === "json";
    try {
      const opts = program.opts();
      const startupShown = isJson ? false : printStartup("Upgrade Intelligence", !opts.banner);

      if (!isJson) {
        printInitSequence([
          "Rust AST Loaded",
          "Parsing Anchor Workspace",
          "Building Call Graph"
        ]);
        console.log("");
      }

      const resolvedOldPath = path.resolve(oldPath);
      const resolvedNewPath = path.resolve(newPath);

      let epicConfig: config.ResolvedEpicConfig;
      try {
        epicConfig = config.loadEpicConfig(options.config);
      } catch (err: any) {
        console.error(`epic.toml validation error: ${err.message}`);
        process.exit(1);
      }

      // Parse both versions once, then run BOTH the compatibility simulator
      // (state survival) and the existing layout-diff findings off the same AST.
      const { oldProgram, newProgram } = await analyzePrograms(resolvedOldPath, resolvedNewPath, epicConfig);
      const compatibility = simulateCompatibility(oldProgram, newProgram, epicConfig);
      const report = compareAccountLayouts(oldProgram, newProgram, epicConfig);
      const intelligence = createUpgradeIntelligence(report);
      const programName = compatibility.accounts[0]?.account || report.findings[0]?.account || path.basename(resolvedNewPath);

      if (isJson) {
        console.log(
          JSON.stringify(
            {
              program: programName,
              compatibility,
              findings: report.findings,
              severity: report.severity
            },
            null,
            2
          )
        );
        process.exit(compatibility.overall === "Blocked" ? 1 : 0);
      }

      // Lead with the compatibility verdict (the product), then keep the
      // detailed layout findings below it as supporting evidence.
      printCompatibilityReport(compatibility, { program: programName }, { skipTitle: startupShown });

      if (report.findings.length) {
        console.log(colors.gray(DIVIDER));
        console.log(colors.white(colors.bold("LAYOUT FINDINGS (DETAIL)")));
        console.log(colors.gray(DIVIDER));
        console.log("");
        printUpgradeReport(report, intelligence, { program: programName }, { skipTitle: true });
        console.log("");
      }

      // Exit code. BLOCKED always fails CI (state corruption is non-negotiable),
      // overriding fail_on_severity. Other outcomes respect the configured threshold.
      const severityOrder = ["SAFE", "MINOR", "WARNING", "MAJOR", "CRITICAL"];
      const thresholdIndex = severityOrder.indexOf(epicConfig.failOnSeverity);
      const reportSeverityIndex = severityOrder.indexOf(report.severity);
      const severityFails =
        thresholdIndex !== -1 && reportSeverityIndex !== -1 && reportSeverityIndex >= thresholdIndex;
      const blocked = compatibility.overall === "Blocked";
      const fails = blocked || severityFails;

      console.log(colors.gray(DIVIDER));
      console.log("");
      if (blocked) {
        console.log(
          colors.critical(`✖ EPIC Guard Blocked: deploying would corrupt existing on-chain accounts.`)
        );
      } else if (severityFails) {
        console.log(
          colors.critical(`✖ EPIC Guard Blocked: Upgrade severity is ${report.severity} (threshold: ${epicConfig.failOnSeverity}).`)
        );
      } else if (compatibility.overall === "Migration-Required") {
        console.log(colors.warning(`▲ EPIC Guard: Upgrade is safe only after the migration above is performed.`));
      } else {
        console.log(colors.success(`✓ EPIC Guard Approved Upgrade.`));
      }
      console.log("");
      console.log(colors.dim(`Time: ${(Date.now() - startTime) / 1000} s`));
      console.log("");

      process.exit(fails ? 1 : 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`epic check failed: ${message}`);
      process.exit(1);
    }
  });

function getSeverityLevel(sev: string): number {
  const s = sev.toUpperCase();
  if (s === "WARNING" || s === "WARN" || s === "SAFE" || s === "MINOR") return 0;
  if (s === "MEDIUM" || s === "MAJOR") return 1;
  if (s === "HIGH") return 2;
  if (s === "CRITICAL") return 3;
  return 3;
}

program
  .command("doctor")
  .description("Run diagnostics on the environment")
  .action(() => {
    const opts = program.opts();
    const startupShown = printStartup("Environment Diagnostics", !opts.banner);
    if (!startupShown) {
      console.log(colors.gray(DIVIDER));
      console.log(colors.bold(colors.white("Environment Diagnostics")));
      console.log(colors.gray(DIVIDER));
      console.log("");
    }

    let hasErrors = false;

    const checkVersion = (cmd: string, name: string, required: boolean) => {
      try {
        const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        const shortVer = out.split("\n")[0].substring(0, 50);
        console.log(`${colors.success("✓")} ${name.padEnd(10)}: ${colors.dim(shortVer)}`);
      } catch (e) {
        if (required) {
          console.log(`${colors.critical("✖")} ${name.padEnd(10)}: ${colors.critical("Not found (Required)")}`);
          hasErrors = true;
        } else {
          console.log(`${colors.warning("⚠️")} ${name.padEnd(10)}: ${colors.dim("Not found (Optional)")}`);
        }
      }
    };
    
    checkVersion("rustc --version", "Rust", true);
    checkVersion("cargo --version", "Cargo", true);
    checkVersion("node --version", "Node.js", true);
    checkVersion("solana --version", "Solana", false);
    checkVersion("anchor --version", "Anchor", false);
    
    console.log("");

    try {
      const binaryPath = resolveParserBinary();
      fs.accessSync(binaryPath, fs.constants.X_OK);
      console.log(`${colors.success("✓")} parser-v2 : ${colors.dim(binaryPath)}`);
    } catch (e: any) {
      console.log(`${colors.critical("✖")} parser-v2 : ${colors.critical("Binary not found or not executable")}`);
      hasErrors = true;
    }

    const hasAnchor = fs.existsSync(path.join(process.cwd(), "Anchor.toml"));
    const hasCargo = fs.existsSync(path.join(process.cwd(), "Cargo.toml"));
    if (hasAnchor) {
      console.log(`${colors.success("✓")} Workspace : ${colors.dim("Anchor Workspace detected")}`);
    } else if (hasCargo) {
      console.log(`${colors.success("✓")} Workspace : ${colors.dim("Cargo Workspace detected")}`);
    } else {
      console.log(`${colors.warning("⚠️")} Workspace : ${colors.warning("No Anchor.toml or Cargo.toml found in current directory")}`);
    }

    const hasEpicToml = fs.existsSync(path.join(process.cwd(), "epic.toml"));
    if (hasEpicToml) {
      try {
        config.loadEpicConfig();
        console.log(`${colors.success("✓")} Config    : ${colors.dim("Loaded epic.toml successfully")}`);
      } catch(e: any) {
        console.log(`${colors.critical("✖")} Config    : ${colors.critical("Invalid epic.toml: " + e.message)}`);
        hasErrors = true;
      }
    } else {
      console.log(`${colors.success("✓")} Config    : ${colors.dim("Using default configuration")}`);
    }

    const ruleCount = Object.keys(ruleKnowledge).length;
    console.log(`${colors.success("✓")} Rules     : ${colors.dim(`${ruleCount} safety rules loaded`)}`);

    console.log("");
    if (hasErrors) {
      console.log(colors.critical("Diagnostics failed. EPIC may not function correctly."));
      process.exit(1);
    } else {
      console.log(colors.success("Ready for Audit"));
      process.exit(0);
    }
  });

program
  .command("explain <rule_id>")
  .description("Explain a security rule in detail")
  .action((ruleId: string) => {
    const opts = program.opts();
    printStartup("Rule Explanation", !opts.banner);

    const knowledge = ruleKnowledge[ruleId];
    if (!knowledge) {
      console.log(colors.critical(`Rule ${ruleId} not found.`));
      console.log(colors.dim("Run 'epic rules' to list all available rules."));
      process.exit(1);
    }
    const band = bandForScore(knowledge.score);
    console.log(colors.gray(DIVIDER));
    console.log("");
    console.log(`${severityBadge(band)}  ${colors.white(ruleId)}  ${colors.gray("·")}  ${colors.white(knowledge.desc)}`);
    console.log("");
    console.log(`${colors.dim("Risk Score")}   ${scoreBar(knowledge.score)}  ${colors.white(`${knowledge.score} / 100`)}`);
    console.log("");
    console.log(colors.gray(DIVIDER));
    console.log("");
    console.log(colors.bold(colors.white("WHY IT'S DANGEROUS")));
    console.log(colors.dim(knowledge.why));
    console.log("");
    console.log(colors.bold(colors.white("WHAT BREAKS")));
    console.log(colors.warning(knowledge.impact));
    console.log("");
    console.log(colors.bold(colors.white("HOW TO FIX")));
    console.log(colors.green(knowledge.fix));
    console.log("");
    console.log(colors.bold(colors.white("HISTORICAL EXPLOITS")));
    console.log(colors.dim(knowledge.historical));
    console.log("");
    console.log(colors.gray(DIVIDER));
    console.log("");
  });

program
  .command("audit [path]")
  .description("Run security rules against the repository.")
  .option("-f, --format <format>", "Output format: text, json, sarif, markdown", "text")
  .option("-s, --strict", "Exit code 1 if findings severity >= threshold", false)
  .option("-c, --config <path>", "Path to epic.toml configuration file")
  .option("-v, --verbose", "Show all findings without summarizing")
  .option("--include-tests", "Include test and fixture directories")
  .option("--include-fixtures", "Include fixture directories")
  .option("--all", "Do not ignore any directories")
  .option("--ignore <rules>", "Rule IDs to ignore (comma-separated)", (val) => val.split(",").map(r => r.trim()))
  .action(async (targetPath: string = ".", options: any) => {
    const startTime = Date.now();
    try {
      const opts = program.opts();
      if (options.format === "text") printStartup("Security Audit", !opts.banner);

      const binary = findRustBinary();
      const resolvedPath = path.resolve(targetPath);
      const auditStart = Date.now();
      const result = spawnSync(binary, ["audit", resolvedPath], { encoding: "utf-8" });
      const ruleEngineMs = Date.now() - auditStart;
      if (result.status !== 0) throw new Error("Parser failed");
      const findings = JSON.parse(result.stdout.trim());

      let epicConfig = config.loadEpicConfig(options.config);
      const ignoredRules = new Set([...(epicConfig.ignore || []), ...(options.ignore || [])]);
      
      const builtinIgnore = [".git", "target", "node_modules", "vendor"];
      if (!options.all) {
        if (!options.includeTests) builtinIgnore.push("test", "tests", "test-repos");
        if (!options.includeFixtures) builtinIgnore.push("fixtures", "demo", "examples");
      }
      
      const activeFindings = findings.filter((f: any) => {
        if (ignoredRules.has(f.rule_id)) return false;
        const relPath = path.relative(process.cwd(), f.location.file);
        return !builtinIgnore.some(p => relPath.includes(`/${p}/`) || relPath.startsWith(`${p}/`) || relPath === p);
      });

      if (options.format === "text") {
        // Real repository structure from the parser's analyze pass + filesystem.
        const fileCount = countRustFiles(resolvedPath);
        let structsFound = 0, enumsFound = 0, accountsFound = 0;
        let analyzeMs = 0;
        try {
          const analyzeStart = Date.now();
          const analyzeResult = spawnSync(binary, [resolvedPath], { encoding: "utf-8" });
          analyzeMs = Date.now() - analyzeStart;
          if (analyzeResult.status === 0 && analyzeResult.stdout) {
            const overview = JSON.parse(analyzeResult.stdout.trim());
            structsFound = overview.structs_found ?? 0;
            enumsFound = overview.enums_found ?? 0;
            accountsFound = Array.isArray(overview.accounts) ? overview.accounts.length : 0;
          }
        } catch {
          // Analyze enrichment is best-effort; the audit result is authoritative.
        }
        const totalTimeMs = Date.now() - startTime;

        printInitSequence([
          `Scanning Files\n${colors.cyan("█████████████████████████")} ${colors.dim(`${fileCount} / ${fileCount}`)}`,
          `Building AST\n${colors.cyan("█████████████████████████")} ${colors.dim("100%")}`,
          `Running Security Rules\n${colors.cyan("█████████████████████████")} ${colors.dim("100%")}`
        ]);
        console.log("");

        const projName = path.basename(resolvedPath) || ".";

        printSection("Workspace", {
          "Project": projName,
          "Rules Loaded": Object.keys(ruleKnowledge).length,
          "Configuration": options.config || "epic.toml"
        });

        printSection("Repository Overview", {
          "Rust Files": fileCount,
          "Structs": structsFound,
          "Enums": enumsFound,
          "State Accounts": accountsFound
        });

        const criticalCount = activeFindings.filter((f: any) => getSeverityLevel(f.severity) === 3).length;
        const warningCount = activeFindings.filter((f: any) => getSeverityLevel(f.severity) < 3).length;
        const rulesTriggered = new Set(activeFindings.map((f: any) => f.rule_id)).size;

        printSection("Execution Metrics", {
          "Indexed Files": fileCount,
          "Parse + AST": `${Math.max(1, analyzeMs)} ms`,
          "Rule Engine": `${Math.max(1, ruleEngineMs)} ms`,
          "Total": `${(totalTimeMs / 1000).toFixed(2)} s`
        });

        printSection("Security Summary", {
          "Critical": criticalCount,
          "High": warningCount,
          "Rules Triggered": rulesTriggered
        });

        if (options.verbose) {
          activeFindings.forEach((f: any) => printRuleFinding(f));
        } else {
          const grouped: Record<string, any> = {};
          activeFindings.forEach((f: any) => {
            if (!grouped[f.rule_id]) grouped[f.rule_id] = { occurrences: 0, files: new Set(), name: f.rule_name || f.rule_id };
            grouped[f.rule_id].occurrences++;
            grouped[f.rule_id].files.add(f.location.file);
          });
          for (const [id, s] of Object.entries(grouped)) {
            console.log(colors.gray(DIVIDER));
            console.log(colors.violet(id));
            console.log(colors.bold(colors.white(s.name)));
            console.log("");
            console.log(colors.dim("Occurrences: ") + colors.white(s.occurrences));
            console.log(colors.dim("Files: ") + colors.white(s.files.size));
            console.log("");
          }
          if (activeFindings.length > 0) {
            console.log(colors.gray(DIVIDER));
            console.log("");
          }
        }
        
        let mostCommonRule = null;
        let highestOccurrences = 0;
        
        const occurrenceMap: Record<string, number> = {};
        for (const finding of activeFindings) {
          occurrenceMap[finding.rule_id] = (occurrenceMap[finding.rule_id] || 0) + 1;
          if (occurrenceMap[finding.rule_id] > highestOccurrences) {
            highestOccurrences = occurrenceMap[finding.rule_id];
            mostCommonRule = finding.rule_id;
          }
        }
        
        if (mostCommonRule && ruleKnowledge[mostCommonRule]) {
          const knowledge = ruleKnowledge[mostCommonRule];
          console.log(colors.bold(colors.white("Most Common Issue")));
          console.log(colors.dim(`${knowledge.desc}`));
          console.log(colors.cyan(`${highestOccurrences} occurrence${highestOccurrences === 1 ? "" : "s"}`));
          console.log("");
          console.log(colors.dim("Priority"));
          console.log(colors.white(`Resolve this rule first — it accounts for the most findings.`));
          console.log("");
        }

        printEndSummary(projName, 5, criticalCount, warningCount, Date.now() - startTime);
      } else if (options.format === "json") {
        console.log(JSON.stringify(activeFindings, null, 2));
      } else if (options.format === "sarif") {
        console.log(JSON.stringify(generateSarif(activeFindings), null, 2));
      } else if (options.format === "markdown") {
        console.log(generateMarkdown(activeFindings, {
          project: path.basename(resolvedPath) || ".",
          scanMs: Date.now() - startTime
        }));
      }

      if (options.strict) {
        const threshold = epicConfig.failOnSeverity || "CRITICAL";
        const thresholdVal = getSeverityLevel(threshold);
        
        let hasFailingFinding = false;
        for (const finding of activeFindings) {
          const sevVal = getSeverityLevel(finding.severity);
          if (sevVal >= thresholdVal) {
            hasFailingFinding = true;
            break;
          }
        }
        
        if (hasFailingFinding) {
          process.exit(1);
        } else {
          process.exit(0);
        }
      } else {
        process.exit(0);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`epic audit failed: ${message}`);
      process.exit(1);
    }
  });

program
  .command("rules")
  .description("List all available security rules.")
  .action(() => {
    const opts = program.opts();
    const startupShown = printStartup("Security Rules", !opts.banner);

    const rules: Array<[string, string]> = [
      ["EPIC-SEC-001", "Owner Validation"],
      ["EPIC-SEC-002", "Missing Signer Validation"],
      ["EPIC-SEC-003", "Missing Post-CPI Account Reload"],
      ["EPIC-SEC-004", "PDA Cryptographic Seed Collision Risk"],
      ["EPIC-SEC-005", "Arbitrary CPI Target Program Spoofing"]
    ];

    if (!startupShown) {
      console.log(colors.gray(DIVIDER));
      console.log(colors.white(colors.bold("EPIC Security Rules")));
      console.log(colors.gray(DIVIDER));
      console.log("");
    }

    for (const [id, name] of rules) {
      const kb = ruleKnowledge[id];
      const score = kb ? kb.score : 50;
      const band = bandForScore(score);
      console.log(`${severityBadge(band)}  ${colors.white(id)}  ${colors.gray("·")}  ${colors.white(name)}`);
      if (kb) {
        console.log(`   ${scoreBar(score, 16)}  ${colors.dim(`${score} / 100`)}  ${colors.gray("Implemented")}`);
      } else {
        console.log(`   ${colors.gray("Implemented")}`);
      }
      console.log("");
    }

    console.log(colors.dim("Run 'epic explain <RULE-ID>' for a full breakdown of any rule."));
    console.log("");
  });


program.configureHelp({
  formatHelp: (cmd, helper) => {
    const noBannerFlag = !!cmd.opts().noBanner || process.argv.includes("--no-banner");
    const header = getBannerString(noBannerFlag);
    return `${header}
${colors.bold("Commands")}
  ${colors.white("audit".padEnd(14))} Run security rules against the repository.
  ${colors.white("doctor".padEnd(14))} Run diagnostics on the environment.
  ${colors.white("explain".padEnd(14))} Explain a security rule in detail.
  ${colors.white("rules".padEnd(14))} List all available security rules.
  ${colors.white("analyze".padEnd(14))} Analyze a Solana program workspace.
  ${colors.white("check".padEnd(14))} Compare two workspace versions.

${colors.bold("Flags")}
  ${colors.white("-v, --verbose".padEnd(16))} Show all findings instead of grouping
  ${colors.white("--include-tests".padEnd(16))} Include test directories in scan
  ${colors.white("-f, --format".padEnd(16))} Output format: text, json, sarif, markdown
  ${colors.white("--no-banner".padEnd(16))} Disable the startup banner
  ${colors.white("-h, --help".padEnd(16))} Print help
`;
  }
});

program.parse(process.argv);
