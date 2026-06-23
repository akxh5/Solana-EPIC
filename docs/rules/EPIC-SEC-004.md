# EPIC-SEC-004: PDA Cryptographic Seed Collision Risk

## Description
Detects Program Derived Address (PDA) derivation where adjacent variable-length seeds are not separated by delimiters or fixed-length boundaries.

## Threat Model
Solana's runtime derives Program Derived Addresses (PDAs) by concatenating the input bytes provided in the `seeds` slice without any runtime length prefixing or boundary delimiters. When two variable-length seeds (such as dynamic strings or raw vectors) are placed directly next to each other, boundary bytes can shift from the end of the first seed to the beginning of the second seed while keeping the concatenated byte stream identical. Different logical accounts can thus map to the identical PDA, allowing an attacker to hijack a PDA, overwrite state, or access unauthorized funds.

## Vulnerable Example
Adjacent variable-length string seeds passed to `find_program_address` without delimiters or fixed-width separators:
```rust
Pubkey::find_program_address(
    &[
        user_name.as_bytes(),
        folder_name.as_bytes()
    ],
    program_id
)
```

## Safe Example
Variable-length seeds separated by a fixed-length public key or a static literal string delimiter:
```rust
// Separated by a static literal string delimiter
Pubkey::find_program_address(
    &[
        user_name.as_bytes(),
        b"|",              // Static delimiter (1 byte)
        folder_name.as_bytes()
    ],
    program_id
)
```
Or separated by a fixed-length key:
```rust
// Separated by a fixed-size public key
Pubkey::find_program_address(
    &[
        user_name.as_bytes(),
        user_key.as_ref(), // Fixed-length (32 bytes)
        folder_name.as_bytes()
    ],
    program_id
)
```
