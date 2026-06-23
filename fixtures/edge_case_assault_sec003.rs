use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod edge_case_assault_sec003 {
    use super::*;

    // 1. UNSAFE: access inside loop without reload
    pub fn loop_unsafe(ctx: Context<DataFlow>, amount: u64) -> Result<()> {
        token::transfer(ctx.accounts.transfer_ctx(), amount)?;
        for _i in 0..10 {
            // Vulnerable: reading amount in loop without reload
            let _val = ctx.accounts.vault.amount;
        }
        Ok(())
    }

    // 2. SAFE: access inside loop after reload
    pub fn loop_safe(ctx: Context<DataFlow>, amount: u64) -> Result<()> {
        token::transfer(ctx.accounts.transfer_ctx(), amount)?;
        ctx.accounts.vault.reload()?;
        for _i in 0..10 {
            let _val = ctx.accounts.vault.amount;
        }
        Ok(())
    }

    // 3. UNSAFE: conditional reload (only reloaded on then branch, but written on merge/else)
    pub fn conditional_unsafe(ctx: Context<DataFlow>, amount: u64, cond: bool) -> Result<()> {
        token::transfer(ctx.accounts.transfer_ctx(), amount)?;
        if cond {
            ctx.accounts.vault.reload()?;
        }
        // Vulnerable: reload does not dominate this access
        ctx.accounts.vault.amount += 10;
        Ok(())
    }

    // 4. SAFE: reload dominates access in both branches
    pub fn conditional_safe(ctx: Context<DataFlow>, amount: u64, cond: bool) -> Result<()> {
        token::transfer(ctx.accounts.transfer_ctx(), amount)?;
        if cond {
            ctx.accounts.vault.reload()?;
            ctx.accounts.vault.amount += 10;
        } else {
            ctx.accounts.vault.reload()?;
            ctx.accounts.vault.amount += 20;
        }
        Ok(())
    }

    // 5. UNSAFE: alias shadow chain (reload on one reference but access on original variable or vice versa)
    pub fn alias_unsafe(ctx: Context<DataFlow>, amount: u64) -> Result<()> {
        token::transfer(ctx.accounts.transfer_ctx(), amount)?;
        let alias = &mut ctx.accounts.vault;
        // Reload is missing on both alias and original
        alias.amount += 10;
        Ok(())
    }

    // 6. SAFE: alias chain reload
    pub fn alias_safe(ctx: Context<DataFlow>, amount: u64) -> Result<()> {
        token::transfer(ctx.accounts.transfer_ctx(), amount)?;
        let alias = &mut ctx.accounts.vault;
        alias.reload()?;
        alias.amount += 10;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct DataFlow<'info> {
    #[account(mut)]
    pub vault: Account<'info, VaultState>,
    #[account(mut)]
    pub user_tokens: AccountInfo<'info>,
    pub user_authority: Signer<'info>,
    pub token_program: AccountInfo<'info>,
}

impl<'info> DataFlow<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.user_tokens.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.user_authority.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}

#[account]
pub struct VaultState {
    pub amount: u64,
}
