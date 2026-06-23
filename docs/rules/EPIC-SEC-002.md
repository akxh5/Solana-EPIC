# EPIC-SEC-002: Missing Signer Validation

## Description
Detects scenarios where authority-like accounts are capable of mutating state, authorizing actions, or executing privileged flows without proving signer authority.

## Threat Model
In Solana, callers supply all account inputs. Because any caller can pass arbitrary public keys, the program must verify that the authority-like account signed the transaction. Failing to perform this signer validation allows an attacker to spoof the authority account and perform unauthorized state changes, access controls bypass, or asset theft.

## Vulnerable Example
The accounts struct declares the `authority` as a standard `AccountInfo` or `UncheckedAccount` without the `signer` constraint or wrapping it in the `Signer` type.
```rust
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub config: Account<'info, ProgramConfig>,
    pub authority: AccountInfo<'info>, // Lacks #[account(signer)] or Signer<'info>!
}

pub fn update_config(ctx: Context<UpdateConfig>, new_val: u64) -> Result<()> {
    // Mutates state, but authority was not verified as a signer!
    ctx.accounts.config.admin_value = new_val;
    Ok(())
}
```

## Safe Example
Using Anchor's `Signer` type automatically performs signer verification checks during deserialization:
```rust
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub config: Account<'info, ProgramConfig>,
    pub authority: Signer<'info>, // Safe: verified by Anchor code generator
}
```
Or by checking the `is_signer` flag explicitly:
```rust
pub fn update_config(ctx: Context<UpdateConfig>, new_val: u64) -> Result<()> {
    require!(ctx.accounts.authority.is_signer, ErrorCode::MissingSignature);
    ctx.accounts.config.admin_value = new_val;
    Ok(())
}
```
