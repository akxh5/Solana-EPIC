# EPIC-SEC-001: Owner Validation

## Description
Tracks mutable account write operations to ensure they are protected by an ownership check (`account.owner == program_id`) that dominates the write path.

## Threat Model
In Solana, any account can be passed to an instruction. If a program writes data to a mutable account without verifying that the account is owned by the program itself (or another trusted program), an attacker can pass a forged account (e.g., owned by a malicious program) with malicious data. The program will execute instructions thinking the account is valid, leading to unauthorized state mutation, theft of funds, or key bypasses.

## Vulnerable Example
```rust
#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// CHECK: This is unsafe because it is UncheckedAccount and lacks any owner constraint/validation
    #[account(mut)]
    pub vault: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let mut vault_data = vault.try_borrow_mut_data()?;
    vault_data[0] = 9; // Unchecked mutable write!
    Ok(())
}
```

## Safe Example
Using Anchor's typed `Account` wrapper automatically performs ownership checks against the program ID:
```rust
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, VaultState>,
    pub authority: Signer<'info>,
}

pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.amount -= amount; // Safe: owner validated by Account type wrapper
    Ok(())
}
```

## Historical Exploit References
* **Cashio App ($52M, March 2022)**: The Cashio application accepted unchecked accounts that were supposed to be LP token pools. Because the program failed to validate the owner of these accounts, the attacker passed forged accounts, minted billions of CASH tokens, and drained the LP pools.
