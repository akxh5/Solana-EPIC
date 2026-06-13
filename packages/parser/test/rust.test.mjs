import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAccountStructs } from "../dist/rust.js";

test("parses Anchor account structs and calculates account byte sizes", () => {
  const source = `
    use anchor_lang::prelude::*;

    #[account]
    pub struct Vault {
      pub authority: Pubkey,
      pub bump: u8,
      pub total_deposits: u64,
      pub flags: [bool; 3],
      pub optional_delegate: Option<Pubkey>,
      pub memo: String,
    }

    pub struct Ignored {
      pub value: u64,
    }

    #[account(zero_copy)]
    pub struct Position {
      pub owner: Pubkey,
      pub liquidity: u128,
    }
  `;

  const accounts = parseAccountStructs(source, "/tmp/lib.rs");

  assert.deepEqual(
    accounts.map((account) => ({ name: account.name, byteSize: account.byteSize })),
    [
      { name: "Vault", byteSize: 89 },
      { name: "Position", byteSize: 56 }
    ]
  );
});
