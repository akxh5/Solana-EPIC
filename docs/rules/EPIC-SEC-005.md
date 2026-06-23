# EPIC-SEC-005: Arbitrary CPI Target Program Spoofing

## Description
Detects scenarios where a program invokes another program via CPI without verifying that the target program matches a trusted program ID.

## Threat Model
In Solana, instructions are completely stateless and accept a list of accounts supplied by the caller, including the executable program accounts that the program interacts with. When a program performs a Cross-Program Invocation (CPI) to an external program (e.g., calling SPL Token transfer), it passes the target program's account info. If the program fails to verify that the target program account key matches the trusted, expected program ID (such as the official SPL Token program address), an attacker can pass a custom, malicious program. When the program invokes CPI on the attacker-supplied program, the malicious program executes arbitrary code under the authority of the calling program (or its PDAs), allowing the attacker to steal funds, falsify state, or hijack execution.

## Vulnerable Example
Invoking CPI on an executable program account passed in by the caller without owner validation or static program validation:
```rust
pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let cpi_program = ctx.accounts.token_program.to_account_info(); // Untrusted AccountInfo
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_vault.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}
```

## Safe Example
Using Anchor's `Program<'info, T>` type ensures that the program ID is statically checked against the trusted program ID during deserialization:
```rust
#[derive(Accounts)]
pub struct Deposit<'info> {
    pub token_program: Program<'info, Token>, // Safe: program ID is validated as spl-token
}
```
Or by explicitly asserting the program ID key:
```rust
require_keys_eq!(ctx.accounts.token_program.key(), token::ID);
```
