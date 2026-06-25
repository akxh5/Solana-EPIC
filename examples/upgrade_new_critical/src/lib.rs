use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod epic_demo {
    use super::*;
    // Renamed instruction triggers Discriminator Drift!
    pub fn initialize_user(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[account]
pub struct UserState {
    // authority is removed: triggers Field Removed and Account Shrink!
    pub balance: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub state: Account<'info, UserState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
