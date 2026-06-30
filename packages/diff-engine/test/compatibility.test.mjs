import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateCompatibility } from "../dist/index.js";

// ───────────────────────────────────────────────────────────────────────────
// Fixture helpers: build AnalyzeResult / AccountStruct shapes by hand so the
// simulator can be tested in isolation, without invoking the Rust parser.
// ───────────────────────────────────────────────────────────────────────────

const SIZES = { u8: 1, bool: 1, u16: 2, u32: 4, i32: 4, u64: 8, i64: 8, u128: 16, Pubkey: 32 };

function field(name, type, { byteSize, dynamic = false } = {}) {
  const size = byteSize ?? SIZES[type] ?? 4;
  return { name, type, byteSize: size, dynamic };
}

function account(name, fields, { discriminator = `0x${name}` } = {}) {
  const dataBytes = fields.reduce((sum, f) => sum + f.byteSize, 0);
  return {
    accountId: `lib.rs::${name}`,
    name,
    namespace: "crate::lib",
    byteSize: 8 + dataBytes,
    byteSizeIncludesDiscriminator: true,
    abiFingerprint: `fp:${name}:${fields.map((f) => `${f.name}:${f.type}`).join(",")}`,
    hasDynamicSize: fields.some((f) => f.dynamic),
    layoutWarnings: [],
    fields,
    filePath: "lib.rs",
    discriminator
  };
}

function program(accounts, instructions = []) {
  return { projectPath: "/tmp/prog", accounts, instructions };
}

function only(report) {
  assert.equal(report.accounts.length, 1, "expected exactly one account in report");
  return report.accounts[0];
}

// A canonical Vault layout used across several cases.
const vaultOld = () => account("Vault", [field("owner", "Pubkey"), field("amount", "u64"), field("bump", "u8")]);

// ───────────────────────────────────────────────────────────────────────────
// Compatible
// ───────────────────────────────────────────────────────────────────────────

test("identical layout → Compatible / Exact", () => {
  const report = simulateCompatibility(program([vaultOld()]), program([vaultOld()]));
  assert.equal(report.overall, "Compatible");
  const a = only(report);
  assert.equal(a.status, "Compatible");
  assert.equal(a.certainty, "Exact");
  assert.equal(a.sizeDelta, 0);
  assert.equal(a.rentDeltaLamports, null);
  assert.equal(a.byteReasoning, undefined);
});

test("brand-new account type → Compatible (no prior state)", () => {
  const newAcct = account("Config", [field("admin", "Pubkey")]);
  const report = simulateCompatibility(program([]), program([newAcct]));
  assert.equal(report.overall, "Compatible");
  assert.equal(only(report).status, "Compatible");
});

// ───────────────────────────────────────────────────────────────────────────
// Migration-Required
// ───────────────────────────────────────────────────────────────────────────

test("append field at tail → Migration-Required with exact rent delta", () => {
  const newAcct = account("Vault", [
    field("owner", "Pubkey"),
    field("amount", "u64"),
    field("bump", "u8"),
    field("created_at", "i64")
  ]);
  const report = simulateCompatibility(program([vaultOld()]), program([newAcct]));
  assert.equal(report.overall, "Migration-Required");
  const a = only(report);
  assert.equal(a.status, "Migration-Required");
  assert.equal(a.certainty, "Exact");
  assert.equal(a.sizeDelta, 8);
  // 8 bytes * 3480 lamports/byte-year * 2 years
  assert.equal(a.rentDeltaLamports, 8 * 3480 * 2);
  // Append-only: existing bytes untouched, so no corrupting offset ranges.
  assert.equal(a.byteReasoning.affectedOffsetRanges.length, 0);
  assert.ok(a.byteReasoning.explanations[0].includes("reallocated"));
  assert.ok(a.upgradePlan.some((s) => /realloc/i.test(s)));
});

// ───────────────────────────────────────────────────────────────────────────
// BLOCKED variants
// ───────────────────────────────────────────────────────────────────────────

test("field reorder → BLOCKED with byte-offset reasoning", () => {
  const reordered = account("Vault", [field("owner", "Pubkey"), field("bump", "u8"), field("amount", "u64")]);
  const report = simulateCompatibility(program([vaultOld()]), program([reordered]));
  assert.equal(report.overall, "Blocked");
  const a = only(report);
  assert.equal(a.status, "Blocked");
  assert.equal(a.certainty, "Exact");
  const r = a.byteReasoning.affectedOffsetRanges[0];
  // owner = 8..39, amount started at 40 in the old layout.
  assert.equal(r.start, 40);
  assert.ok(r.was.includes("amount"));
  assert.ok(r.nowReadsAs.includes("bump"));
  assert.ok(a.byteReasoning.explanations[0].includes("40"));
});

test("field removed → BLOCKED", () => {
  const removed = account("Vault", [field("owner", "Pubkey"), field("bump", "u8")]);
  const report = simulateCompatibility(program([vaultOld()]), program([removed]));
  assert.equal(only(report).status, "Blocked");
});

test("in-place type change (same size) → BLOCKED", () => {
  const retyped = account("Vault", [field("owner", "Pubkey"), field("amount", "i64"), field("bump", "u8")]);
  const report = simulateCompatibility(program([vaultOld()]), program([retyped]));
  const a = only(report);
  assert.equal(a.status, "Blocked");
  assert.ok(a.reasons.join(" ").includes("u64→i64"));
});

test("discriminator change → BLOCKED", () => {
  const oldA = account("Vault", [field("owner", "Pubkey")], { discriminator: "0xAAAA" });
  const newA = account("Vault", [field("owner", "Pubkey")], { discriminator: "0xBBBB" });
  const report = simulateCompatibility(program([oldA]), program([newA]));
  const a = only(report);
  assert.equal(a.status, "Blocked");
  assert.equal(a.discriminatorChanged, true);
});

test("middle insertion → BLOCKED", () => {
  const inserted = account("Vault", [
    field("owner", "Pubkey"),
    field("inserted", "u32"),
    field("amount", "u64"),
    field("bump", "u8")
  ]);
  const report = simulateCompatibility(program([vaultOld()]), program([inserted]));
  assert.equal(only(report).status, "Blocked");
});

test("account shrink → BLOCKED", () => {
  // Same field names but a smaller field type → size drops, no removal.
  const oldA = account("Meta", [field("flags", "u64")]);
  const newA = account("Meta", [field("flags", "u32")]);
  const report = simulateCompatibility(program([oldA]), program([newA]));
  const a = only(report);
  assert.equal(a.status, "Blocked");
});

// ───────────────────────────────────────────────────────────────────────────
// Honesty: never claim certainty we don't have
// ───────────────────────────────────────────────────────────────────────────

test("change after a dynamic field → ManualReview + caveat, no false Exact", () => {
  // `data: Vec<u8>` is dynamic; the type change to `bump` lives after it.
  const oldA = account("Doc", [
    field("owner", "Pubkey"),
    field("data", "Vec<u8>", { byteSize: 4, dynamic: true }),
    field("bump", "u8")
  ]);
  const newA = account("Doc", [
    field("owner", "Pubkey"),
    field("data", "Vec<u8>", { byteSize: 4, dynamic: true }),
    field("bump", "u16")
  ]);
  const report = simulateCompatibility(program([oldA]), program([newA]));
  const a = only(report);
  assert.equal(a.status, "Blocked");
  assert.equal(a.certainty, "ManualReview");
  assert.notEqual(a.certainty, "Exact");
  assert.ok(a.caveats.some((c) => /dynamic/i.test(c)));
});

test("append after a dynamic field → Approximate certainty + rent indeterminate", () => {
  const oldA = account("Doc", [field("owner", "Pubkey"), field("data", "Vec<u8>", { byteSize: 4, dynamic: true })]);
  const newA = account("Doc", [
    field("owner", "Pubkey"),
    field("data", "Vec<u8>", { byteSize: 4, dynamic: true }),
    field("extra", "u64")
  ]);
  const report = simulateCompatibility(program([oldA]), program([newA]));
  const a = only(report);
  assert.equal(a.status, "Migration-Required");
  assert.equal(a.certainty, "Approximate");
  // Dynamic account ⇒ rent delta cannot be asserted.
  assert.equal(a.rentDeltaLamports, null);
  assert.ok(a.caveats.some((c) => /rent/i.test(c)));
});

// ───────────────────────────────────────────────────────────────────────────
// Removed account ambiguity + overall aggregation
// ───────────────────────────────────────────────────────────────────────────

test("removed account → Migration-Required / ManualReview with rename caveat", () => {
  const report = simulateCompatibility(program([account("Legacy", [field("x", "u64")])]), program([]));
  const a = only(report);
  assert.equal(a.status, "Migration-Required");
  assert.equal(a.certainty, "ManualReview");
  assert.ok(a.caveats.some((c) => /rename/i.test(c)));
});

test("overall status is the worst account", () => {
  const oldP = program([vaultOld(), account("Config", [field("admin", "Pubkey")])]);
  const reordered = account("Vault", [field("owner", "Pubkey"), field("bump", "u8"), field("amount", "u64")]);
  const newP = program([reordered, account("Config", [field("admin", "Pubkey")])]);
  const report = simulateCompatibility(oldP, newP);
  assert.equal(report.overall, "Blocked");
  assert.equal(report.accounts.length, 2);
});

test("report carries standing Borsh + static assumptions", () => {
  const report = simulateCompatibility(program([vaultOld()]), program([vaultOld()]));
  assert.equal(report.assumptions.length, 2);
  assert.ok(report.assumptions.some((s) => /Borsh/i.test(s)));
  assert.ok(report.assumptions.some((s) => /on-chain|RPC/i.test(s)));
});
