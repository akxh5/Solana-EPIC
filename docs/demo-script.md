# EPIC Demo Script

## Goal
Showcase EPIC as an essential tool for Solana developers to prevent mainnet state corruption and security regressions.

## Setup
1. Open a clean terminal.
2. Ensure you are in the `Solana EPIC` root directory.
3. Ensure the project is built: `npm run build`

## Act 1: The Promise
"Deploying Solana programs is terrifying. A single changed byte in a struct can corrupt every user's account on mainnet. Security scanners catch bugs, but they don't catch *migrations*. Today, we're introducing EPIC: Upgrade Intelligence for Solana."

## Act 2: Compatibility Analysis (The Star of the Show)
"Let's look at three common upgrade scenarios using `epic check`."

**Scenario A: The Safe Upgrade**
"First, a safe additive upgrade where a brand-new account is introduced."
*Run:* `epic check examples/compatibility-demo/01-compatible/old examples/compatibility-demo/01-compatible/new`
*Highlight:* "Notice the verdict: SAFE. Existing accounts remain valid. The exit code is 0."

**Scenario B: The Migration Required**
"What happens if we append a new field `created_at` to the end of our `Vault` state?"
*Run:* `epic check examples/compatibility-demo/02-migration/old examples/compatibility-demo/02-migration/new`
*Highlight:* "EPIC detects the size expansion. It gives us a MIGRATION verdict, calculates the exact rent top-up required, and gives us a 4-step actionable upgrade plan before we can safely deploy."

**Scenario C: The Corruption (BLOCKED)**
"Now, what if a developer innocently reorders the `bump` and `amount` fields to group them logically?"
*Run:* `epic check examples/compatibility-demo/03-blocked/old examples/compatibility-demo/03-blocked/new`
*Highlight:* "EPIC blocks the deployment. It visually maps the byte-offset shift and explains exactly why `amount` will try to deserialize into `bump`. It returns exit code 1 to halt the CI/CD pipeline immediately."

## Act 3: CI/CD Integration
"All of this intelligence is machine-readable. It pipes directly into GitHub Actions."
*Run:* `epic check examples/compatibility-demo/03-blocked/old examples/compatibility-demo/03-blocked/new --format json | jq .`
*Highlight:* "Stable, deterministic JSON output. We also support SARIF for native GitHub Security tab integration."

## Conclusion
"EPIC answers one question before you merge: 'Can I safely deploy this upgrade?'"
