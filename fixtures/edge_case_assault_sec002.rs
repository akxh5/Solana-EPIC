use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod edge_case_assault_sec002 {
    use super::*;

    // 1. Alias Chain (Safe)
    pub fn test_alias_chain(ctx: Context<TestAccounts>) -> Result<()> {
        let auth = &ctx.accounts.admin_authority;
        let alias = auth;
        if !alias.is_signer {
            return Err(ProgramError::MissingRequiredSignature.into());
        }
        let vault = &mut ctx.accounts.vault;
        let mut data = vault.try_borrow_mut_data()?;
        data[0] = 1;
        Ok(())
    }

    // 2. Variable Shadowing (Safe - original target checked)
    pub fn test_shadowing(ctx: Context<TestAccounts>) -> Result<()> {
        let auth = &ctx.accounts.admin_authority;
        if !auth.is_signer {
            return Err(ProgramError::MissingRequiredSignature.into());
        }
        {
            let _auth = &ctx.accounts.other_account;
        }
        let vault = &mut ctx.accounts.vault;
        let mut data = vault.try_borrow_mut_data()?;
        data[0] = 1;
        Ok(())
    }

    // 3. Nested Block Validation (Safe)
    pub fn test_nested_block(ctx: Context<TestAccounts>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        {
            if !ctx.accounts.admin_authority.is_signer {
                return Err(ProgramError::MissingRequiredSignature.into());
            }
            let mut data = vault.try_borrow_mut_data()?;
            data[0] = 1;
        }
        Ok(())
    }

    // 4. Loop Validation (Safe if check dominates the block)
    pub fn test_loop_validation(ctx: Context<TestAccounts>) -> Result<()> {
        for _ in 0..10 {
            if !ctx.accounts.admin_authority.is_signer {
                return Err(ProgramError::MissingRequiredSignature.into());
            }
        }
        let vault = &mut ctx.accounts.vault;
        let mut data = vault.try_borrow_mut_data()?;
        data[0] = 1;
        Ok(())
    }

    // 5. Match Expression Branching (Unsafe - only validated in one branch)
    pub fn test_match_branching(ctx: Context<TestAccounts>, check: bool) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        match check {
            true => {
                if !ctx.accounts.admin_authority.is_signer {
                    return Err(ProgramError::MissingRequiredSignature.into());
                }
                let mut data = vault.try_borrow_mut_data()?;
                data[0] = 1;
            }
            false => {
                // Vulnerable path: mutates without validation!
                let mut data = vault.try_borrow_mut_data()?;
                data[0] = 2;
            }
        }
        Ok(())
    }

    // 6. Dynamic Helper Function (Unsafe / Inconclusive)
    pub fn test_dynamic_helper(ctx: Context<TestAccounts>) -> Result<()> {
        check_helper(&ctx.accounts.admin_authority)?;
        let vault = &mut ctx.accounts.vault;
        let mut data = vault.try_borrow_mut_data()?;
        data[0] = 1;
        Ok(())
    }
}

pub fn check_helper(_auth: &AccountInfo) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct TestAccounts<'info> {
    #[account(mut)]
    pub vault: AccountInfo<'info>,
    pub admin_authority: AccountInfo<'info>, // Heuristically parsed as authority, needs signer validation
    pub other_account: AccountInfo<'info>,
}
