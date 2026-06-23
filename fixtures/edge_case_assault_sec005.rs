use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod edge_case_assault_sec005 {
    use super::*;

    // 1. SAFE: Alias chain validation
    pub fn alias_chain_safe(ctx: Context<CpiTargets>) -> Result<()> {
        let p = ctx.accounts.token_program.to_account_info();
        let alias1 = p;
        let alias2 = alias1.clone();
        require_keys_eq!(alias2.key(), anchor_spl::token::ID);
        let ix = solana_program::instruction::Instruction {
            program_id: alias2.key(),
            accounts: vec![],
            data: vec![],
        };
        solana_program::program::invoke(&ix, &[alias1])?;
        Ok(())
    }

    // 2. UNSAFE: Alias chain missing validation
    pub fn alias_chain_unsafe(ctx: Context<CpiTargets>) -> Result<()> {
        let p = ctx.accounts.token_program.to_account_info();
        let alias1 = p;
        let alias2 = alias1.clone();
        let ix = solana_program::instruction::Instruction {
            program_id: alias2.key(),
            accounts: vec![],
            data: vec![],
        };
        solana_program::program::invoke(&ix, &[alias1])?;
        Ok(())
    }

    // 3. UNSAFE: Shadowing makes validation stale
    pub fn shadowing_unsafe(ctx: Context<CpiTargets>) -> Result<()> {
        let p = ctx.accounts.token_program.to_account_info();
        require_keys_eq!(p.key(), anchor_spl::token::ID);
        {
            let p = ctx.accounts.other_program.to_account_info();
            let ix = solana_program::instruction::Instruction {
                program_id: p.key(),
                accounts: vec![],
                data: vec![],
            };
            solana_program::program::invoke(&ix, &[p])?;
        }
        Ok(())
    }

    // 4. UNSAFE: Validation inside loop does not dominate the invocation outside
    pub fn loop_unsafe(ctx: Context<CpiTargets>) -> Result<()> {
        let p = ctx.accounts.token_program.to_account_info();
        for _i in 0..10 {
            require_keys_eq!(p.key(), anchor_spl::token::ID);
        }
        let ix = solana_program::instruction::Instruction {
            program_id: p.key(),
            accounts: vec![],
            data: vec![],
        };
        solana_program::program::invoke(&ix, &[p])?;
        Ok(())
    }

    // 5. SAFE: Nested scopes and normal dominance
    pub fn nested_scopes_safe(ctx: Context<CpiTargets>) -> Result<()> {
        let p = ctx.accounts.token_program.to_account_info();
        require_keys_eq!(p.key(), anchor_spl::token::ID);
        {
            let ix = solana_program::instruction::Instruction {
                program_id: p.key(),
                accounts: vec![],
                data: vec![],
            };
            solana_program::program::invoke(&ix, &[p])?;
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CpiTargets<'info> {
    pub token_program: AccountInfo<'info>,
    pub other_program: AccountInfo<'info>,
}
