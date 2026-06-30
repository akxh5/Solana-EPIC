# EPIC Account Compatibility — Demo Fixtures

Three old/new program pairs that exercise each verdict of the Account
Compatibility Simulator. Run from the repo root after building:

```bash
# 1. Compatible — Vault layout unchanged; a brand-new Config account is added.
epic check examples/compatibility-demo/01-compatible/old \
           examples/compatibility-demo/01-compatible/new
# → Verdict: SAFE (exit 0)

# 2. Migration-Required — `created_at: i64` appended at the tail of Vault.
epic check examples/compatibility-demo/02-migration/old \
           examples/compatibility-demo/02-migration/new
# → Verdict: MIGRATION (exit respects fail_on_severity), with realloc plan + rent delta

# 3. BLOCKED — `bump` and `amount` reordered; existing accounts would corrupt.
epic check examples/compatibility-demo/03-blocked/old \
           examples/compatibility-demo/03-blocked/new
# → Verdict: BLOCKED (exit 1, always), with byte-offset reasoning

# Machine-readable output for CI:
epic check examples/compatibility-demo/03-blocked/old \
           examples/compatibility-demo/03-blocked/new --format json
```

Each run answers the same five questions: what changed, why it matters, what
breaks, can I deploy, and exactly what to do next.
