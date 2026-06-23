use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod security_safe {
    use super::*;

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        // Safe: owner is checked by Account<'info, TokenAccount> (SEC-001)
        // Safe: authority is checked as Signer (SEC-002)
        // Safe: token_program is statically validated Program<'info, Token> (SEC-005)
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, token::TokenAccount>,
    #[account(mut)]
    pub user_vault: Account<'info, token::TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
