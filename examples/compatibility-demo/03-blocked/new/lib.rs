use anchor_lang::prelude::*;

declare_id!("Vau1t3333333333333333333333333333333333333");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.payer.key();
        vault.amount = amount;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }
}

// DANGER: `bump` and `amount` were REORDERED. The field set is unchanged, but
// in Borsh the byte offsets shift: bytes that stored `amount` (u64) on every
// existing account now decode as `bump` (u8) plus a shifted `amount`. Deploying
// over live accounts silently corrupts balances.
#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub bump: u8,
    pub amount: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, space = 8 + 32 + 1 + 8)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
