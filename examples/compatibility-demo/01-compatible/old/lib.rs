use anchor_lang::prelude::*;

declare_id!("Vau1t1111111111111111111111111111111111111");

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

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, space = 8 + 32 + 8 + 1)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
