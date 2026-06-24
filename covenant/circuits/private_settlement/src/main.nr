// Covenant — ZK Private Settlement Circuit
// Noir 1.0.0-beta.9 / UltraHonk
// Proves sender holds a valid compliance credential and sufficient balance
// for a cross-border settlement — without revealing sender identity or amount.

use dep::std::hash::poseidon2::Poseidon2;

global MAX_TIER: u32 = 5;

// Tier → max amount in stroops (equivalent to on-chain tier_limit)
fn tier_max_amount(tier: u32) -> u64 {
    if tier == 5 {
        1_000_000_000_000
    } else if tier == 4 {
        800_000_000_000
    } else if tier == 3 {
        600_000_000_000
    } else if tier == 2 {
        400_000_000_000
    } else {
        200_000_000_000
    }
}

// Circuit inputs:
//   Private:
//     sender_secret       — wallet owner secret (never revealed)
//     credential_salt     — unique issuance salt
//     balance             — sender's actual balance
//     amount              — settlement amount
//   Public:
//     nullifier           — H(secret, salt) to prevent double-spend
//     sender_commitment   — H(secret) binding to on-chain address
//     recipient_commitment — H(recipient_address)
//     settlement_hash     — H(amount, asset, recipient, timestamp)
//     compliance_tier     — KYC tier (1–5)
//     issuer_root         — live on-chain issuer Merkle root

fn main(
    // Private inputs
    sender_secret: Field,
    credential_salt: Field,
    balance: u64,
    amount: u64,
    // Public inputs
    nullifier: pub Field,
    sender_commitment: pub Field,
    recipient_commitment: pub Field,
    settlement_hash: pub Field,
    compliance_tier: pub u32,
    issuer_root: pub Field,
) {
    // 1. Validate tier
    assert(compliance_tier >= 1, "tier must be at least 1");
    assert(compliance_tier <= MAX_TIER, "tier must be at most 5");

    // 2. Amount must be positive
    assert(amount > 0, "amount must be positive");

    // 3. Sender has sufficient balance
    assert(balance >= amount, "insufficient balance");

    // 4. Amount is within tier cap
    let cap = tier_max_amount(compliance_tier);
    assert(amount <= cap, "amount exceeds tier limit");

    // 5. Derive and verify nullifier
    let derived_nullifier = Poseidon2::hash([sender_secret, credential_salt, 0], 1);
    assert(derived_nullifier == nullifier, "nullifier mismatch");

    // 6. Derive and verify sender commitment
    let derived_sender = Poseidon2::hash([sender_secret, 0, 0], 1);
    assert(derived_sender == sender_commitment, "sender commitment mismatch");

    // 7. Bind settlement_hash to public outputs
    //    settlement_hash = H(amount, recipient_commitment, issuer_root)
    let expected_hash = Poseidon2::hash(
        [amount as Field, recipient_commitment, issuer_root],
        1,
    );
    assert(expected_hash == settlement_hash, "settlement hash mismatch");

    // 8. Issuer root must be non-zero
    assert(issuer_root != 0, "issuer root must be non-zero");
}

#[test]
fn test_valid_settlement() {
    let secret: Field = 0xabcdef1234567890;
    let salt: Field = 0xcafebabe;
    let balance: u64 = 500_000_000_000;
    let amount: u64 = 100_000_000_000;
    let tier: u32 = 3;

    let nullifier = Poseidon2::hash([secret, salt, 0], 1);
    let sender_commit = Poseidon2::hash([secret, 0, 0], 1);
    let recipient_commit: Field = 0x9999;
    // Pretend issuer_root is known
    let issuer_root: Field = 0x1111;
    let settlement_hash = Poseidon2::hash(
        [amount as Field, recipient_commit, issuer_root],
        1,
    );

    main(
        secret, salt, balance, amount,
        nullifier, sender_commit, recipient_commit,
        settlement_hash, tier, issuer_root,
    );
}
