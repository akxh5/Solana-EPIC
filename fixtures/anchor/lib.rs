use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub bump: u8,
    pub total_deposits: u64,
}

#[account(zero_copy)]
pub struct Position {
    pub owner: Pubkey,
    pub liquidity: u128,
}
