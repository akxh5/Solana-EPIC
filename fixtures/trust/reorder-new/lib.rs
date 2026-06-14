use anchor_lang::prelude::*;

#[account]
pub struct Position {
    pub b: u8,
    pub a: u64,
    pub c: Pubkey,
}
