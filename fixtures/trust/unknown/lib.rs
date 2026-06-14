use anchor_lang::prelude::*;

#[account]
pub struct Position {
    pub config: NestedConfig,
}
