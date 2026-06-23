use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

const DELIMITER: &[u8] = b"-";
const CONST_PREFIX: [u8; 4] = [1, 2, 3, 4];

#[program]
pub mod edge_case_assault_sec004 {
    use super::*;

    // 1. SAFE: Alias chains resolving constant delimiters
    pub fn alias_chain_safe(ctx: Context<DerivePda>, name: String, symbol: String) -> Result<()> {
        let sep = DELIMITER;
        let sep_alias = sep;
        let (pda, bump) = Pubkey::find_program_address(
            &[
                name.as_bytes(),
                sep_alias,
                symbol.as_bytes(),
            ],
            ctx.program_id,
        );
        Ok(())
    }

    // 2. SAFE: Imported/file-scope constants as boundary separator
    pub fn imported_constants_safe(ctx: Context<DerivePda>, name: String, symbol: String) -> Result<()> {
        let (pda, bump) = Pubkey::find_program_address(
            &[
                name.as_bytes(),
                &CONST_PREFIX,
                symbol.as_bytes(),
            ],
            ctx.program_id,
        );
        Ok(())
    }

    // 3. UNSAFE: Variable-width wrappers adjacent to other variable-width
    pub fn variable_width_wrappers_unsafe(ctx: Context<DerivePda>, vec_a: Vec<u8>, vec_b: Vec<u8>) -> Result<()> {
        let (pda, bump) = Pubkey::find_program_address(
            &[
                vec_a.as_slice(),
                vec_b.as_slice(),
            ],
            ctx.program_id,
        );
        Ok(())
    }

    // 4. SAFE: Fixed-width wrapper adjacent to variable-width
    pub fn fixed_width_wrappers_safe(ctx: Context<DerivePda>, name: String, key: Pubkey) -> Result<()> {
        let (pda, bump) = Pubkey::find_program_address(
            &[
                name.as_bytes(),
                key.as_ref(),
            ],
            ctx.program_id,
        );
        Ok(())
    }

    // 5. SAFE: Nested PDA derivations / builders
    pub fn nested_pda_builders_safe(ctx: Context<DerivePda>, name: String, bump: u8) -> Result<()> {
        let (pda, _bump) = Pubkey::find_program_address(
            &[
                name.as_bytes(),
                &[bump], // u8 array of size 1 (fixed length)
            ],
            ctx.program_id,
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct DerivePda<'info> {
    pub authority: Signer<'info>,
}
