use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod security_vulnerable {
    use super::*;

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        // Vulnerable: vault is raw AccountInfo and lacks owner check! (SEC-001)
        let mut vault_data = vault.try_borrow_mut_data()?;
        vault_data[0] = 9;

        // Vulnerable: CPI to token_program without program validation! (SEC-005)
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(), // Lacks signer check (SEC-002)
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        anchor_spl::token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// CHECK: raw AccountInfo lacks owner verification
    #[account(mut)]
    pub vault: AccountInfo<'info>,
    /// CHECK: raw AccountInfo used as authority lacks signer check
    pub authority: AccountInfo<'info>,
    /// CHECK: raw AccountInfo used as program target lacks validation
    pub token_program: AccountInfo<'info>,
}
