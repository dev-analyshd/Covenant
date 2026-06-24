// Covenant — Private Settlement Circuit
// Proves balance sufficiency and compliance tier without revealing amount or identity
// Noir v1.0+ · UltraHonk proof system

use dep::std;
use dep::std::hash::pedersen_hash;

fn main(
    // Public inputs
    settlement_commitment: pub Field,
    compliance_tier: pub u8,
    credential_nullifier: pub Field,
    recipient_commitment: pub Field,
    view_key_hash: pub Field,
    min_required_tier: pub u8,

    // Private inputs
    sender_address: Field,
    sender_balance: u64,
    settlement_amount: u64,
    recipient_address: Field,
    blinding_factor: Field,
    view_key: Field,
    credential_blinding: Field,
    kyc_hash: Field,
    risk_score: u8,
) {
    // 1. Verify settlement amount does not exceed balance
    assert(sender_balance >= settlement_amount, "Insufficient balance");

    // 2. Verify compliance tier meets minimum requirement
    assert(compliance_tier >= min_required_tier, "Compliance tier insufficient");

    // 3. Verify tier matches risk score (reproving compliance inline)
    let expected_tier = compute_tier(risk_score);
    assert(expected_tier == compliance_tier, "Tier mismatch");

    // 4. Verify amount is within tier limit
    let tier_limit = tier_to_limit(compliance_tier);
    assert(settlement_amount as u64 <= tier_limit, "Amount exceeds tier limit");

    // 5. Compute and verify settlement commitment
    let computed_commitment = pedersen_hash([
        sender_address,
        recipient_address,
        settlement_amount as Field,
        blinding_factor,
    ]);
    assert(computed_commitment == settlement_commitment, "Settlement commitment mismatch");

    // 6. Compute and verify recipient commitment
    let computed_recipient = pedersen_hash([recipient_address, blinding_factor]);
    assert(computed_recipient == recipient_commitment, "Recipient commitment mismatch");

    // 7. Compute and verify view key hash (for regulator access)
    let computed_view_key_hash = pedersen_hash([view_key, credential_blinding]);
    assert(computed_view_key_hash == view_key_hash, "View key hash mismatch");

    // 8. Compute and verify credential nullifier
    let computed_nullifier = pedersen_hash([kyc_hash, credential_blinding]);
    assert(computed_nullifier == credential_nullifier, "Credential nullifier mismatch");
}

fn compute_tier(risk_score: u8) -> u8 {
    if risk_score <= 10 {
        5
    } else if risk_score <= 25 {
        4
    } else if risk_score <= 50 {
        3
    } else if risk_score <= 75 {
        2
    } else {
        1
    }
}

fn tier_to_limit(tier: u8) -> u64 {
    if tier == 5 {
        1_000_000_000_000 // $1M in stroops
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
