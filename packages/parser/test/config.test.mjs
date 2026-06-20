import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { config } from "../dist/index.js";

// Helper to write a temporary epic.toml
function createTempConfig(content) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "epic-test-"));
  const configPath = path.join(tempDir, "epic.toml");
  fs.writeFileSync(configPath, content, "utf-8");
  return { tempDir, configPath };
}

// Helper to cleanup temporary folder
function cleanupTemp(tempDir) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

test("config: default configurations are populated correctly", () => {
  const defaults = config.getDefaultConfig();
  assert.equal(defaults.compareMode, "ast");
  assert.equal(defaults.failOnSeverity, "CRITICAL");
  assert.equal(defaults.excludePaths.length, 0);
  assert.equal(defaults.enforcePadding, false);
  assert.equal(defaults.programs.size, 0);
});

test("config: auto-discovery traverses directories upwards", () => {
  const { tempDir, configPath } = createTempConfig(`
    [workspace]
    compare_mode = "ast"
  `);

  const subSubDir = path.join(tempDir, "programs", "drift");
  fs.mkdirSync(subSubDir, { recursive: true });

  const discovered = config.findConfigFile(subSubDir);
  assert.equal(discovered, configPath);

  cleanupTemp(tempDir);
});

test("config: loads, validates, and normalizes a valid epic.toml", () => {
  const { tempDir, configPath } = createTempConfig(`
    [workspace]
    compare_mode = "idl"
    fail_on_severity = "MAJOR"
    rpc_url = "https://api.mainnet-beta.solana.com"
    exclude_paths = ["**/tests/**"]
    enforce_padding = true

    [programs.drift]
    path = "./programs/drift"
    id = "dRifv2G2XadHceee5mK3dB6vJ61g2QskXn8o1sBDR1B"

    [[programs.drift.overrides]]
    account = "User"
    finding = "FIELD_ADDED"
    field = "maker_rebate"
    action = "downgrade"
    severity = "MINOR"
    note = "User state pre-allocated buffer is verified to fit trailing field."
  `);

  const cfg = config.loadEpicConfig(configPath);
  assert.equal(cfg.compareMode, "idl");
  assert.equal(cfg.failOnSeverity, "MAJOR");
  assert.equal(cfg.rpcUrl, "https://api.mainnet-beta.solana.com");
  assert.deepEqual(cfg.excludePaths, ["**/tests/**"]);
  assert.equal(cfg.enforcePadding, true);

  const driftProg = cfg.programs.get("drift");
  assert.ok(driftProg);
  assert.equal(driftProg.programId, "dRifv2G2XadHceee5mK3dB6vJ61g2QskXn8o1sBDR1B");
  assert.equal(driftProg.absolutePath, path.resolve(tempDir, "./programs/drift"));
  assert.equal(driftProg.overrides.length, 1);

  const override = driftProg.overrides[0];
  assert.equal(override.account, "User");
  assert.equal(override.finding, "FIELD_ADDED");
  assert.equal(override.field, "maker_rebate");
  assert.equal(override.action, "downgrade");
  assert.equal(override.severity, "MINOR");
  assert.equal(override.note, "User state pre-allocated buffer is verified to fit trailing field.");

  cleanupTemp(tempDir);
});

test("config: Zod schema rejects invalid shapes", () => {
  // Invalid compare_mode
  const { tempDir: td1, configPath: cp1 } = createTempConfig(`
    [workspace]
    compare_mode = "invalid_mode"
  `);
  assert.throws(() => config.loadEpicConfig(cp1), /fail/i);
  cleanupTemp(td1);

  // Missing note in override
  const { tempDir: td2, configPath: cp2 } = createTempConfig(`
    [programs.drift]
    path = "./programs/drift"
    id = "dRif..."

    [[programs.drift.overrides]]
    account = "User"
    finding = "FIELD_ADDED"
    action = "allow"
  `);
  assert.throws(() => config.loadEpicConfig(cp2), /fail/i);
  cleanupTemp(td2);

  // Downgrade missing severity
  const { tempDir: td3, configPath: cp3 } = createTempConfig(`
    [programs.drift]
    path = "./programs/drift"
    id = "dRif..."

    [[programs.drift.overrides]]
    account = "User"
    finding = "FIELD_ADDED"
    action = "downgrade"
    note = "This is a note that is long enough"
  `);
  assert.throws(() => config.loadEpicConfig(cp3), /fail/i);
  cleanupTemp(td3);
});

test("config: security validator blocks wildcard overrides", () => {
  const { tempDir, configPath } = createTempConfig(`
    [programs.drift]
    path = "./programs/drift"
    id = "dRif..."

    [[programs.drift.overrides]]
    account = "*"
    finding = "FIELD_ADDED"
    action = "allow"
    note = "This is a note that is long enough"
  `);

  assert.throws(() => config.loadEpicConfig(configPath), /Wildcard overrides are forbidden/i);
  cleanupTemp(tempDir);
});

test("config: security validator blocks banned overrides", () => {
  // Attempt to override FIELD_REORDERED
  const { tempDir: td1, configPath: cp1 } = createTempConfig(`
    [programs.drift]
    path = "./programs/drift"
    id = "dRif..."

    [[programs.drift.overrides]]
    account = "User"
    finding = "FIELD_REORDERED"
    action = "allow"
    note = "This is a note that is long enough"
  `);
  assert.throws(() => config.loadEpicConfig(cp1), /Overriding critical layout mutations.*FIELD_REORDERED.*is strictly forbidden/i);
  cleanupTemp(td1);

  // Attempt to override FIELD_REMOVED
  const { tempDir: td2, configPath: cp2 } = createTempConfig(`
    [programs.drift]
    path = "./programs/drift"
    id = "dRif..."

    [[programs.drift.overrides]]
    account = "User"
    finding = "FIELD_REMOVED"
    action = "downgrade"
    severity = "SAFE"
    note = "This is a note that is long enough"
  `);
  assert.throws(() => config.loadEpicConfig(cp2), /Overriding critical layout mutations.*FIELD_REMOVED.*is strictly forbidden/i);
  cleanupTemp(td2);
});

test("config: security validator blocks short notes", () => {
  const { tempDir, configPath } = createTempConfig(`
    [programs.drift]
    path = "./programs/drift"
    id = "dRif..."

    [[programs.drift.overrides]]
    account = "User"
    finding = "FIELD_ADDED"
    action = "allow"
    note = "Short"
  `);

  assert.throws(() => config.loadEpicConfig(configPath), /note must be at least 10/i);
  cleanupTemp(tempDir);
});
