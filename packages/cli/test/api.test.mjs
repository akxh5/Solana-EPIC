import test from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { runCheck, formatMarkdown, formatSarif } from "../dist/api.js";
import { config } from "@solana-epic/parser";

test("API: runCheck produces a valid UpgradeReport", async () => {
  // Use undefined so it loads defaults
  const epicConfig = config.loadEpicConfig(undefined);
  
  // Find project root by looking for "examples" directory
  let rootPath = path.resolve(".");
  while (!fs.existsSync(path.join(rootPath, "examples")) && rootPath !== "/") {
    rootPath = path.dirname(rootPath);
  }
  
  const oldPath = path.join(rootPath, "examples/compatibility-demo/02-migration/old");
  const newPath = path.join(rootPath, "examples/compatibility-demo/02-migration/new");

  const report = await runCheck(oldPath, newPath, epicConfig);
  
  assert.strictEqual(report.compatibility.overall, "Migration-Required");
  assert.ok(report.programName);
  
  const markdown = formatMarkdown(report, false);
  assert.ok(markdown.includes("MIGRATION REQUIRED"));
  assert.ok(markdown.includes("Rent Delta:"));
  
  const sarif = formatSarif(report);
  assert.strictEqual(sarif.version, "2.1.0");
  assert.strictEqual(sarif.runs[0].tool.driver.name, "EPIC Upgrade Intelligence");
});
