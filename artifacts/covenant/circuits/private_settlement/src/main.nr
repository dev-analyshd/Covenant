use dep::std::hash::poseidon2;

// ============================================================================
// Private Settlement Circuit — Covenant
// ============================================================================
// Proves: Sufficient balance, valid compliance, amount within tier limits
// Public outputs: settlement_hash, compliance_attestation, sender_commitment, tier_limit
//
// Called by CovenantSettlement and CovenantComplianceBridge contracts.
// The SAC token transfer is only executed if this proof verifies on-chain.
//
// Proof system: UltraHonk (Noir 1.0-beta.9 + Barretenberg 0.87.0)
// ============================================================================

fn main(
    // ── Private inputs (never leave the prover) ──────────────────────────────
    amount: u64,           // Transfer amount (in asset base units)
    sender_balance: u64,   // Sender's verified current balance
    compliance_tier: u32,  // Sender's compliance tier (1–5)
    sender_secret: Field,  // Sender's credential secret
    recipient_tier: u32,   // Recipient's compliance tier

    // ── Public inputs (visible on-chain) ────────────────────────────────────
    settlement_id: pub Field,           // Unique settlement identifier (counter-derived)
    min_recipient_tier: pub u32,        // Minimum tier required for this settlement
    max_amount: pub u64,                // Maximum amount per settlement (tier-independent cap)
    asset_id: pub Field,               // Asset being transferred (hash of asset code)
    compliance_nullifier: pub Field,   // Nullifier from the sender's compliance credential
    current_timestamp: pub u64,         // Current block timestamp
) -> pub (Field, bool, Field, u64) {

    // =========================================================================
    // CONSTRAINT 1: Amount is positive and within the global cap
    // =========================================================================
    assert(amount > 0, "Amount must be positive");
    assert(amount <= max_amount, "Amount exceeds maximum limit");

    // =========================================================================
    // CONSTRAINT 2: Sender has sufficient balance (range proof)
    // =========================================================================
    assert(sender_balance >= amount, "Insufficient balance");

    // =========================================================================
    // CONSTRAINT 3: Sender's compliance tier is valid
    // =========================================================================
    assert(compliance_tier >= 1, "Invalid compliance tier (min 1)");
    assert(compliance_tier <= 5, "Invalid compliance tier (max 5)");

    // =========================================================================
    // CONSTRAINT 4: Recipient meets minimum compliance tier for this settlement
    // =========================================================================
    assert(
        recipient_tier >= min_recipient_tier,
        "Recipient does not meet minimum compliance tier",
    );

    // =========================================================================
    // CONSTRAINT 5: Compliance nullifier is non-zero (credential exists)
    // =========================================================================
    assert(compliance_nullifier != 0, "Invalid compliance credential (zero nullifier)");

    // =========================================================================
    // CONSTRAINT 6: Amount is within the tier-adjusted limit
    // =========================================================================
    let tier_limit = match compliance_tier {
        5 => max_amount,           // Tier 5 (Platinum): full max_amount
        4 => max_amount * 4 / 5,   // Tier 4 (Gold): 80%
        3 => max_amount * 3 / 5,   // Tier 3 (Silver): 60%
        2 => max_amount * 2 / 5,   // Tier 2 (Bronze): 40%
        1 => max_amount * 1 / 5,   // Tier 1 (Basic): 20%
        _ => 0,
    };
    assert(amount <= tier_limit, "Amount exceeds tier-adjusted settlement limit");

    // =========================================================================
    // COMPUTE PUBLIC OUTPUTS
    // =========================================================================

    // Settlement hash: deterministic identifier for this settlement
    // hash = poseidon2(settlement_id || amount || asset_id || sender_secret || timestamp)
    let settlement_hash = poseidon2::hash([
        settlement_id,
        amount as Field,
        asset_id,
        sender_secret,
        current_timestamp as Field,
    ]);

    // Compliance attestation: true if all constraints are satisfied
    let compliance_attestation = true;

    // Sender commitment: public binding without revealing sender address
    // sender_commitment = poseidon2(sender_secret || 0)
    let sender_commitment = poseidon2::hash([sender_secret, 0]);

    (settlement_hash, compliance_attestation, sender_commitment, tier_limit)
}

// ============================================================================
// Tests
// ============================================================================
#[test]
fn test_private_settlement_tier4() {
    let amount = 1000u64;
    let sender_balance = 5000u64;
    let compliance_tier = 4u32;
    let sender_secret = 111111111;
    let recipient_tier = 3u32;

    let settlement_id = 999999;
    let min_recipient_tier = 2u32;
    let max_amount = 10000u64;
    let asset_id = 1;
    let compliance_nullifier = 12345;
    let current_timestamp = 1000u64;

    let (hash, attestation, commitment, limit) = main(
        amount,
        sender_balance,
        compliance_tier,
        sender_secret,
        recipient_tier,
        settlement_id,
        min_recipient_tier,
        max_amount,
        asset_id,
        compliance_nullifier,
        current_timestamp,
    );

    assert(attestation == true);
    assert(hash != 0);
    assert(commitment != 0);
    assert(limit == 8000); // Tier 4: 4/5 of max_amount = 8000
}

#[test]
fn test_tier_limits() {
    // Tier 5: full amount
    let (_, _, _, limit5) = main(
        100u64, 10000u64, 5u32, 1, 3u32,
        1, 1u32, 1000u64, 1, 1, 0u64,
    );
    assert(limit5 == 1000); // 5/5 * 1000

    // Tier 3: 60%
    let (_, _, _, limit3) = main(
        100u64, 10000u64, 3u32, 1, 1u32,
        1, 1u32, 1000u64, 1, 1, 0u64,
    );
    assert(limit3 == 600); // 3/5 * 1000
}
