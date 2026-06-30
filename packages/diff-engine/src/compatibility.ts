import type { AccountField, AccountStruct, AnalyzeResult, config } from "@solana-epic/parser";

// ───────────────────────────────────────────────────────────────────────────
// Account Compatibility Simulator
//
// EPIC's signature capability. Instead of merely reporting that a layout
// changed, this module answers the question a protocol founder actually asks
// before a mainnet upgrade:
//
//   "If I deploy this upgrade today, what happens to the accounts already
//    living on mainnet — do they survive, must they be migrated, or will
//    deploying corrupt live state?"
//
// It is pure and deterministic: given two parsed programs (old + new) it
// classifies every account as Compatible / Migration-Required / BLOCKED,
// explains the consequence at byte-offset granularity, and produces a
// diff-conditioned upgrade plan — while being explicit about what it cannot
// know with certainty (dynamic Borsh types, zero-copy layouts).
//
// v1 is static: it reasons about old-layout vs new-layout only. Sampling real
// on-chain accounts via RPC (getProgramAccounts) is a deliberately deferred
// escalation, not a silent omission.
// ───────────────────────────────────────────────────────────────────────────

export type CompatibilityStatus = "Compatible" | "Migration-Required" | "Blocked";

// How much we trust the byte-level reasoning for this account.
//  - Exact:        fully fixed-size Borsh layout, offsets are authoritative.
//  - Approximate:  a dynamic field exists; offsets before it are exact, offsets
//                  after it are not asserted.
//  - ManualReview: the change lands in or after a dynamic region; a human must
//                  confirm the on-disk consequence.
export type Certainty = "Exact" | "Approximate" | "ManualReview";

export type FieldOffset = {
  name: string;
  type: string;
  offset: number; // byte offset from account start; data fields start at 8 (discriminator)
  byteSize: number;
  dynamic: boolean;
  // True once this field sits at or after the first dynamic field, so its
  // offset is a lower bound rather than an exact position.
  offsetApproximate: boolean;
};

export type AffectedOffsetRange = {
  start: number;
  end: number;
  was: string; // what the old program stored in these bytes
  nowReadsAs: string; // what the new program will decode them as
};

export type ByteReasoning = {
  account: string;
  oldLayout: FieldOffset[];
  newLayout: FieldOffset[];
  explanations: string[];
  affectedOffsetRanges: AffectedOffsetRange[];
};

export type AccountCompatibility = {
  account: string;
  status: CompatibilityStatus;
  certainty: Certainty;
  reasons: string[];
  discriminatorChanged: boolean;
  oldSize: number | null;
  newSize: number | null;
  sizeDelta: number | null;
  byteReasoning?: ByteReasoning;
  rentDeltaLamports: number | null; // additional rent for grown accounts; null if indeterminate
  upgradePlan: string[];
  caveats: string[];
};

export type CompatibilityReport = {
  oldProgramPath: string;
  newProgramPath: string;
  overall: CompatibilityStatus;
  accounts: AccountCompatibility[];
  // Standing assumptions that apply to the whole analysis (rendered once).
  assumptions: string[];
};

// ───────────────────────────────────────────────────────────────────────────
// Rent
// Solana rent-exempt minimum = (data_len + ACCOUNT_STORAGE_OVERHEAD)
//   * LAMPORTS_PER_BYTE_YEAR * EXEMPTION_THRESHOLD.
// For a *delta* the constant 128-byte overhead cancels, so the extra rent for
// growing an account by N bytes is simply N * LAMPORTS_PER_BYTE_YEAR * 2.
// These are Solana's default Rent parameters.
// ───────────────────────────────────────────────────────────────────────────
const LAMPORTS_PER_BYTE_YEAR = 3480;
const EXEMPTION_THRESHOLD = 2;
const DISCRIMINATOR_BYTES = 8;

const BORSH_ASSUMPTION =
  "Layouts are analyzed under Borsh serialization rules. Zero-copy (#[account(zero_copy)] / repr(C)) accounts use different alignment and padding and are not modeled in v1.";

const STATIC_ASSUMPTION =
  "Static analysis only: this compares the declared old and new layouts. It does not yet sample real on-chain accounts via RPC.";

// ───────────────────────────────────────────────────────────────────────────
// Offset derivation
// ───────────────────────────────────────────────────────────────────────────

// Compute per-field byte offsets by prefix-summing field sizes, starting after
// the 8-byte Anchor discriminator. Once a dynamic field is reached, every
// subsequent offset is a lower bound (marked approximate) because the dynamic
// field's real on-chain size is unknown statically.
function computeFieldOffsets(account: AccountStruct): FieldOffset[] {
  const layout: FieldOffset[] = [];
  let offset = DISCRIMINATOR_BYTES;
  let seenDynamic = false;
  for (const field of account.fields) {
    layout.push({
      name: field.name,
      type: field.type,
      offset,
      byteSize: field.byteSize,
      dynamic: field.dynamic,
      offsetApproximate: seenDynamic
    });
    if (field.dynamic) seenDynamic = true;
    offset += field.byteSize;
  }
  return layout;
}

function firstDynamicIndex(account: AccountStruct): number {
  return account.fields.findIndex((f) => f.dynamic);
}

// The field whose byte span [offset, offset + byteSize) contains `byteOffset`.
// Only meaningful for fixed-layout regions (before the first dynamic field).
function fieldAtOffset(layout: FieldOffset[], byteOffset: number): FieldOffset | undefined {
  return layout.find((f) => byteOffset >= f.offset && byteOffset < f.offset + f.byteSize);
}

// ───────────────────────────────────────────────────────────────────────────
// Field-level diff (by name, order-aware)
// ───────────────────────────────────────────────────────────────────────────

type FieldDiff = {
  removed: AccountField[];
  added: AccountField[];
  typeChanged: Array<{ name: string; oldType: string; newType: string; oldSize: number; newSize: number }>;
  reordered: boolean;
  // An added field is followed by at least one retained field → insertion in
  // the middle shifts every later persisted field.
  middleInsertion: boolean;
};

function diffFields(oldAccount: AccountStruct, newAccount: AccountStruct): FieldDiff {
  const oldByName = new Map(oldAccount.fields.map((f) => [f.name, f]));
  const newByName = new Map(newAccount.fields.map((f) => [f.name, f]));

  const removed = oldAccount.fields.filter((f) => !newByName.has(f.name));
  const added = newAccount.fields.filter((f) => !oldByName.has(f.name));

  const typeChanged: FieldDiff["typeChanged"] = [];
  for (const oldField of oldAccount.fields) {
    const newField = newByName.get(oldField.name);
    if (newField && newField.type !== oldField.type) {
      typeChanged.push({
        name: oldField.name,
        oldType: oldField.type,
        newType: newField.type,
        oldSize: oldField.byteSize,
        newSize: newField.byteSize
      });
    }
  }

  // Reorder: the relative order of retained (intersecting) fields changed.
  const retainedOld = oldAccount.fields.filter((f) => newByName.has(f.name)).map((f) => f.name);
  const retainedNew = newAccount.fields.filter((f) => oldByName.has(f.name)).map((f) => f.name);
  const reordered = retainedOld.some((name, i) => retainedNew[i] !== name);

  // Middle insertion: any added field has a retained field after it in the new
  // ordering. Tail-only appends are the safe, migratable direction.
  let middleInsertion = false;
  for (let i = 0; i < newAccount.fields.length; i++) {
    if (!oldByName.has(newAccount.fields[i].name)) {
      const trailing = newAccount.fields.slice(i + 1);
      if (trailing.some((f) => oldByName.has(f.name))) {
        middleInsertion = true;
        break;
      }
    }
  }

  return { removed, added, typeChanged, reordered, middleInsertion };
}

// ───────────────────────────────────────────────────────────────────────────
// Byte-level reasoning
// ───────────────────────────────────────────────────────────────────────────

// Find the first declaration-order position at which the old and new fixed
// layouts diverge (different name, type, or offset). Returns the index into the
// OLD layout, or -1 if the shared prefix is identical.
function firstDivergence(oldLayout: FieldOffset[], newLayout: FieldOffset[]): number {
  const min = Math.min(oldLayout.length, newLayout.length);
  for (let i = 0; i < min; i++) {
    const a = oldLayout[i];
    const b = newLayout[i];
    if (a.name !== b.name || a.type !== b.type || a.offset !== b.offset) return i;
  }
  return -1;
}

function buildByteReasoning(
  oldAccount: AccountStruct,
  newAccount: AccountStruct,
  oldLayout: FieldOffset[],
  newLayout: FieldOffset[],
  diff: FieldDiff,
  appendOnly: boolean
): { reasoning: ByteReasoning; certainty: Certainty; caveats: string[] } {
  const explanations: string[] = [];
  const ranges: AffectedOffsetRange[] = [];
  const caveats: string[] = [];

  const oldDyn = firstDynamicIndex(oldAccount);
  const newDyn = firstDynamicIndex(newAccount);
  const hasDynamic = oldDyn !== -1 || newDyn !== -1;

  let certainty: Certainty = "Exact";

  if (appendOnly) {
    // Existing bytes are untouched; the new field(s) live beyond the old end.
    const oldEnd = oldAccount.byteSize;
    const newEnd = newAccount.byteSize;
    const names = diff.added.map((f) => `\`${f.name}: ${f.type}\``).join(", ");
    explanations.push(
      `Existing accounts occupy bytes ${DISCRIMINATOR_BYTES}–${oldEnd - 1}. The appended field(s) ${names} require bytes ${oldEnd}–${newEnd - 1}, which existing accounts do not have until they are reallocated and zero-initialized.`
    );
    if (hasDynamic) {
      certainty = "Approximate";
      caveats.push(
        "Account contains a dynamically-sized field, so the appended-bytes range is a lower bound on the real on-chain size."
      );
    }
    return { reasoning: { account: oldAccount.name, oldLayout, newLayout, explanations, affectedOffsetRanges: ranges }, certainty, caveats };
  }

  // Corrupting change: locate where the on-disk interpretation first diverges.
  const divergenceIndex = firstDivergence(oldLayout, newLayout);

  if (divergenceIndex === -1) {
    // Shared prefix identical but a destructive change exists deeper (e.g. a
    // removed/typed field at the tail). Anchor the explanation on the first
    // affected field we know about.
    const anchor = diff.removed[0] || oldAccount.fields[oldAccount.fields.length - 1];
    if (anchor) {
      const of = oldLayout.find((f) => f.name === anchor.name);
      if (of) {
        explanations.push(
          `Field \`${anchor.name}: ${anchor.type}\` at bytes ${of.offset}–${of.offset + of.byteSize - 1} no longer matches the new layout, so bytes from offset ${of.offset} onward are reinterpreted.`
        );
        ranges.push({
          start: of.offset,
          end: oldAccount.byteSize - 1,
          was: `${anchor.name}: ${anchor.type}`,
          nowReadsAs: fieldDescAtOffset(newLayout, of.offset)
        });
      }
    }
  } else {
    const oldField = oldLayout[divergenceIndex];
    const divergesInDynamicRegion =
      (oldDyn !== -1 && divergenceIndex >= oldDyn) || (newDyn !== -1 && divergenceIndex >= newDyn);

    if (divergesInDynamicRegion) {
      certainty = "ManualReview";
      caveats.push(
        `The change lands in or after a dynamically-sized field (\`${oldField.name}\`), so exact byte offsets cannot be asserted. Manual review of the on-disk consequence is recommended.`
      );
      explanations.push(
        `The persisted layout of \`${oldAccount.name}\` diverges at field \`${oldField.name}\`, which follows a dynamically-sized field. Existing accounts will deserialize incorrectly, but the precise affected byte range is not statically determinable.`
      );
    } else {
      if (hasDynamic) {
        certainty = "Approximate";
        caveats.push(
          "Account contains a dynamically-sized field; offsets after it are not asserted, though the divergence above occurs in the fixed region and is exact."
        );
      }
      const start = oldField.offset;
      const end = oldField.offset + oldField.byteSize - 1;
      const nowReads = fieldDescAtOffset(newLayout, start);
      explanations.push(
        `Bytes ${start}–${end} previously held \`${oldField.name}: ${oldField.type}\`. Under the new layout those same bytes deserialize as ${nowReads}. Existing on-chain accounts will silently decode into the wrong fields.`
      );
      ranges.push({
        start,
        end: oldAccount.byteSize - 1,
        was: `${oldField.name}: ${oldField.type}`,
        nowReadsAs: nowReads
      });
    }
  }

  return {
    reasoning: { account: oldAccount.name, oldLayout, newLayout, explanations, affectedOffsetRanges: ranges },
    certainty,
    caveats
  };
}

function fieldDescAtOffset(layout: FieldOffset[], byteOffset: number): string {
  const f = fieldAtOffset(layout, byteOffset);
  if (!f) return "unmapped bytes (out of bounds / shifted past end)";
  return `\`${f.name}: ${f.type}\``;
}

// ───────────────────────────────────────────────────────────────────────────
// Upgrade plan (diff-conditioned, never boilerplate)
// ───────────────────────────────────────────────────────────────────────────

function buildUpgradePlan(status: CompatibilityStatus, account: string, primaryReason: string, additionalBytes: number): string[] {
  if (status === "Compatible") {
    return [
      `No migration required — existing \`${account}\` accounts remain valid.`,
      "Deploy the upgraded program."
    ];
  }
  if (status === "Migration-Required") {
    return [
      `Deploy a migration instruction that reallocs \`${account}\` and zero-initializes the ${additionalBytes} new byte(s).`,
      "Reallocate all existing accounts in batches (top up rent for the added bytes).",
      "Verify every account reached the new size before relying on the new field(s).",
      "Deploy the upgraded program once all accounts are migrated."
    ];
  }
  // Blocked
  return [
    `DO NOT deploy over existing \`${account}\` accounts — ${primaryReason}`,
    "Keep the persisted layout backward-compatible (append fields at the tail; never reorder, remove, retype, or shrink in place).",
    "If the new shape is required, introduce a versioned account (new discriminator) and migrate state explicitly into it.",
    "Re-run `epic check` and verify the migration against a forked mainnet state before shipping."
  ];
}

// ───────────────────────────────────────────────────────────────────────────
// Per-account classification
// ───────────────────────────────────────────────────────────────────────────

function classifyMatchedAccount(oldAccount: AccountStruct, newAccount: AccountStruct): AccountCompatibility {
  const oldLayout = computeFieldOffsets(oldAccount);
  const newLayout = computeFieldOffsets(newAccount);
  const diff = diffFields(oldAccount, newAccount);

  const oldSize = oldAccount.byteSize;
  const newSize = newAccount.byteSize;
  const sizeDelta = newSize - oldSize;

  // Same struct name ⇒ same Anchor discriminator. Kept for completeness.
  const discriminatorChanged = Boolean(
    oldAccount.discriminator && newAccount.discriminator && oldAccount.discriminator !== newAccount.discriminator
  );

  const reasons: string[] = [];
  const caveats: string[] = [];

  // Determine status, worst-first.
  let status: CompatibilityStatus;
  let primaryReason = "";
  let appendOnly = false;

  if (discriminatorChanged) {
    status = "Blocked";
    primaryReason = "the account discriminator changed; existing accounts are no longer recognized.";
    reasons.push("Discriminator changed — existing accounts become unrecognizable to the new program.");
  } else if (diff.reordered) {
    status = "Blocked";
    primaryReason = "fields were reordered, so existing bytes decode into the wrong fields.";
    reasons.push("Persisted fields were reordered — Borsh offsets shift and existing accounts decode incorrectly.");
  } else if (diff.removed.length > 0) {
    status = "Blocked";
    primaryReason = "a persisted field was removed, shifting every later field.";
    reasons.push(
      `Field(s) removed: ${diff.removed.map((f) => `\`${f.name}\``).join(", ")} — removing persisted fields shifts subsequent offsets.`
    );
  } else if (diff.typeChanged.length > 0) {
    status = "Blocked";
    const tc = diff.typeChanged[0];
    primaryReason = `field \`${tc.name}\` changed type (${tc.oldType} → ${tc.newType}), reinterpreting existing bytes.`;
    reasons.push(
      `Type change(s): ${diff.typeChanged.map((t) => `\`${t.name}\` ${t.oldType}→${t.newType}`).join(", ")} — existing bytes are reinterpreted.`
    );
  } else if (sizeDelta < 0) {
    status = "Blocked";
    primaryReason = "the account shrank; trailing bytes from existing accounts are truncated or misread.";
    reasons.push(`Account size decreased (${oldSize} → ${newSize} bytes) — existing accounts are larger than the new layout.`);
  } else if (diff.added.length > 0 && diff.middleInsertion) {
    status = "Blocked";
    primaryReason = "a field was inserted before the end, shifting every later field.";
    reasons.push("Field inserted in the middle — every field after the insertion point shifts on disk.");
  } else if (diff.added.length > 0) {
    status = "Migration-Required";
    primaryReason = "new fields were appended and existing accounts are too short.";
    reasons.push(
      `Append-only growth: ${diff.added.map((f) => `\`${f.name}: ${f.type}\``).join(", ")} added at the tail (+${sizeDelta} bytes).`
    );
    appendOnly = true;
  } else {
    status = "Compatible";
    reasons.push("No persisted layout change — field names, types, order, size, and discriminator are unchanged.");
  }

  // Byte-level reasoning + certainty (only when something changed).
  let byteReasoning: ByteReasoning | undefined;
  let certainty: Certainty = "Exact";

  if (status === "Compatible") {
    certainty = oldAccount.hasDynamicSize || newAccount.hasDynamicSize ? "Approximate" : "Exact";
  } else {
    const built = buildByteReasoning(oldAccount, newAccount, oldLayout, newLayout, diff, appendOnly);
    byteReasoning = built.reasoning;
    certainty = built.certainty;
    caveats.push(...built.caveats);
  }

  // Rent delta — only meaningful (and asserted) for fixed-size growth.
  let rentDeltaLamports: number | null = null;
  if (sizeDelta > 0) {
    if (oldAccount.hasDynamicSize || newAccount.hasDynamicSize) {
      caveats.push("Rent delta is indeterminate because the account is dynamically sized.");
    } else {
      rentDeltaLamports = sizeDelta * LAMPORTS_PER_BYTE_YEAR * EXEMPTION_THRESHOLD;
    }
  }

  const upgradePlan = buildUpgradePlan(status, oldAccount.name, primaryReason, Math.max(sizeDelta, 0));

  return {
    account: oldAccount.name,
    status,
    certainty,
    reasons,
    discriminatorChanged,
    oldSize,
    newSize,
    sizeDelta,
    byteReasoning,
    rentDeltaLamports,
    upgradePlan,
    caveats
  };
}

// An account that exists in old but not new: its live on-chain state is no
// longer referenced by the program. Not necessarily corrupting, but it demands
// a migration decision — and it may be a rename (which would be a discriminator
// break), so we flag the ambiguity rather than guessing.
function classifyRemovedAccount(oldAccount: AccountStruct): AccountCompatibility {
  return {
    account: oldAccount.name,
    status: "Migration-Required",
    certainty: "ManualReview",
    reasons: [
      `Account type \`${oldAccount.name}\` was removed from the program. Existing on-chain accounts of this type are no longer referenced.`
    ],
    discriminatorChanged: false,
    oldSize: oldAccount.byteSize,
    newSize: null,
    sizeDelta: null,
    rentDeltaLamports: null,
    upgradePlan: [
      `Decide the fate of existing \`${oldAccount.name}\` accounts before deploying.`,
      "If this is a rename, treat it as a discriminator change (BLOCKED) and migrate state into the renamed type explicitly.",
      "If genuinely retired, drain/close existing accounts via a migration instruction before removing support."
    ],
    caveats: [
      "EPIC cannot statically distinguish a removed account type from a rename. Confirm which case applies."
    ]
  };
}

// An account that exists in new but not old: no prior on-chain state, so
// deploying cannot corrupt anything for this type.
function classifyAddedAccount(newAccount: AccountStruct): AccountCompatibility {
  return {
    account: newAccount.name,
    status: "Compatible",
    certainty: "Exact",
    reasons: [`New account type \`${newAccount.name}\` — no pre-existing on-chain state to break.`],
    discriminatorChanged: false,
    oldSize: null,
    newSize: newAccount.byteSize,
    sizeDelta: null,
    rentDeltaLamports: null,
    upgradePlan: [`No migration required — \`${newAccount.name}\` has no existing accounts.`, "Deploy the upgraded program."],
    caveats: []
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Entry point
// ───────────────────────────────────────────────────────────────────────────

const STATUS_RANK: Record<CompatibilityStatus, number> = {
  Compatible: 0,
  "Migration-Required": 1,
  Blocked: 2
};

function worst(a: CompatibilityStatus, b: CompatibilityStatus): CompatibilityStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export function simulateCompatibility(
  oldProgram: AnalyzeResult,
  newProgram: AnalyzeResult,
  _cfg?: config.ResolvedEpicConfig
): CompatibilityReport {
  const oldByName = new Map(oldProgram.accounts.map((a) => [a.name, a]));
  const newByName = new Map(newProgram.accounts.map((a) => [a.name, a]));
  const names = Array.from(new Set([...oldByName.keys(), ...newByName.keys()])).sort();

  const accounts: AccountCompatibility[] = [];
  for (const name of names) {
    const oldAccount = oldByName.get(name);
    const newAccount = newByName.get(name);
    if (oldAccount && newAccount) {
      accounts.push(classifyMatchedAccount(oldAccount, newAccount));
    } else if (oldAccount) {
      accounts.push(classifyRemovedAccount(oldAccount));
    } else if (newAccount) {
      accounts.push(classifyAddedAccount(newAccount));
    }
  }

  const overall = accounts.reduce<CompatibilityStatus>((acc, a) => worst(acc, a.status), "Compatible");

  return {
    oldProgramPath: oldProgram.projectPath,
    newProgramPath: newProgram.projectPath,
    overall,
    accounts,
    assumptions: [STATIC_ASSUMPTION, BORSH_ASSUMPTION]
  };
}
