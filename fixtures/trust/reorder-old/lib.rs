use anchor_lang::prelude::*;

#[account]
pub struct Position {
    pub a: u64,
    pub b: u8,
    pub c: Pubkey,
}
