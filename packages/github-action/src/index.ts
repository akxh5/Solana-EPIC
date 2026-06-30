import * as core from "@actions/core";
import { runCheck, formatMarkdown, formatSarif } from "@solana-epic/cli";
import { config } from "@solana-epic/parser";
import { upsertPRComment, checkIfConfigChanged } from "./github.js";
import * as fs from "fs";
import * as path from "path";

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput("github_token", { required: true });
    const oldPath = core.getInput("old_path", { required: true });
    const newPath = core.getInput("new_path", { required: true });
    const configPath = core.getInput("config_path") || undefined;
    const sarifOutput = core.getInput("sarif_output") || "epic-report.sarif";

    core.info(`Running EPIC Upgrade Intelligence:`);
    core.info(`Old path: ${oldPath}`);
    core.info(`New path: ${newPath}`);

    // Load epic.toml configuration
    let epicConfig: config.ResolvedEpicConfig;
    try {
      epicConfig = config.loadEpicConfig(configPath);
    } catch (err: any) {
      core.setFailed(`Failed to validate epic.toml configuration: ${err.message}`);
      return;
    }

    // Check if configuration changed in the pull request
    const configChanged = await checkIfConfigChanged(githubToken);

    // Invoke CLI API (Single source of truth)
    const result = await runCheck(oldPath, newPath, epicConfig);
    const { compatibility } = result;

    core.setOutput("severity", compatibility.overall);
    core.setOutput("findings_count", result.report.findings.length.toString());

    // Generate Markdown for PR and Step Summary
    const markdownReport = formatMarkdown(result, configChanged);
    
    // Write GitHub Step Summary
    await core.summary.addRaw(markdownReport).write();

    // Upsert the comment on GitHub Pull Request
    await upsertPRComment(githubToken, markdownReport);

    // Generate and write SARIF
    const sarif = formatSarif(result);
    fs.writeFileSync(path.resolve(sarifOutput), JSON.stringify(sarif, null, 2));
    core.info(`Wrote SARIF report to ${sarifOutput}`);

    // Gate verification
    const severityLevels = ["Compatible", "Migration-Required", "Blocked"];
    const blocked = compatibility.overall === "Blocked";
    const reportSeverityIndex = ["SAFE", "MINOR", "WARNING", "MAJOR", "CRITICAL"].indexOf(result.report.severity);
    const thresholdIndex = ["SAFE", "MINOR", "WARNING", "MAJOR", "CRITICAL"].indexOf(epicConfig.failOnSeverity.toUpperCase());
    
    const failsThreshold = thresholdIndex !== -1 && reportSeverityIndex !== -1 && reportSeverityIndex >= thresholdIndex;

    if (blocked) {
      core.setFailed(`EPIC Guard Blocked: deploying would corrupt existing on-chain accounts.`);
    } else if (failsThreshold) {
      core.setFailed(`EPIC Guard Blocked: Upgrade severity is ${result.report.severity} (threshold: ${epicConfig.failOnSeverity}).`);
    } else {
      core.info("EPIC Guard approved upgrade.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`EPIC Upgrade Intelligence failed: ${message}`);
  }
}

run();

