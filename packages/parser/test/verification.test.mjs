import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAccountStructs, parseAllRawStructs } from "../dist/rust.js";

test("Issue 1.1: Parser resolves custom nested structs recursively using the types registry", () => {
  const source = `
    #[account]
    pub struct Vault {
      pub config: BankConfig,
    }
    pub struct BankConfig {
      pub authority: Pubkey,
    }
  `;

  // 1. Build types registry
  const rawStructs = parseAllRawStructs(source, "lib.rs");
  const typesRegistry = new Map();
  for (const s of rawStructs) {
    typesRegistry.set(s.name, s);
  }

  // 2. Parse accounts passing the registry
  const accounts = parseAccountStructs(source, "lib.rs", typesRegistry);
  assert.equal(accounts.length, 1);
  const vault = accounts[0];
  assert.equal(vault.name, "Vault");
  // 8 (discriminator) + 32 (BankConfig) = 40 bytes
  assert.equal(vault.byteSize, 40);
  
  const configField = vault.fields[0];
  assert.equal(configField.name, "config");
  assert.equal(configField.type, "BankConfig");
  assert.equal(configField.byteSize, 32);
});

test("Issue 1.2: Struct declarations with lifetimes, generics, and where clauses are successfully parsed", () => {
  const source = `
    #[account]
    pub struct UserState<'info, T> where T: AnchorSerialize {
      pub key: Pubkey,
      pub index: u8,
    }
  `;

  const accounts = parseAccountStructs(source, "lib.rs");
  assert.equal(accounts.length, 1);
  const userState = accounts[0];
  assert.equal(userState.name, "UserState");
  // 8 (disc) + 32 (Pubkey) + 1 (u8) = 41 bytes
  assert.equal(userState.byteSize, 41);
  assert.equal(userState.fields[0].name, "key");
  assert.equal(userState.fields[1].name, "index");
});

test("Issue 1.3: Fields with multiline attributes are parsed correctly and never ignored", () => {
  const source = `
    #[account]
    pub struct Vault {
      #[account(
        mut,
        has_one = authority
      )]
      pub admin: Pubkey,
      pub active: bool,
    }
  `;

  const accounts = parseAccountStructs(source, "lib.rs");
  assert.equal(accounts.length, 1);
  const vault = accounts[0];
  assert.equal(vault.name, "Vault");
  
  // Vault size should be correctly calculated: 8 (disc) + 32 (Pubkey) + 1 (bool) = 41 bytes
  assert.equal(vault.byteSize, 41);
  
  // Verify both 'admin' and 'active' are present in parsed fields array
  const fieldNames = vault.fields.map(f => f.name);
  assert.ok(fieldNames.includes("admin"));
  assert.ok(fieldNames.includes("active"));
  assert.equal(vault.fields[0].byteSize, 32);
});
