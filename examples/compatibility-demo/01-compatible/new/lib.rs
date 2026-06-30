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

    // New instruction + a brand-new account type. No existing on-chain state
    // is affected because `Config` accounts do not exist yet.
    pub fn set_config(ctx: Context<SetConfig>) -> Result<()> {
        ctx.accounts.config.admin = ctx.accounts.admin.key();
        Ok(())
    }
}

// Vault layout is byte-for-byte identical to the old version.
#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

// Newly introduced account type — no pre-existing accounts to break.
#[account]
pub struct Config {
    pub admin: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, space = 8 + 32 + 8 + 1)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetConfig<'info> {
    #[account(init, payer = admin, space = 8 + 32)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}
