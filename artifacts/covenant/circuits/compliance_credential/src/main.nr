// Covenant — Compliance Credential Circuit
// Proves KYC validity, sanctions clearance, and risk score without revealing identity
// Noir v1.0+ · UltraHonk proof system

use dep::std;
use dep::std::hash::pedersen_hash;

// --- Public Inputs ---
// compliance_tier: 1–5 (5 = highest trust, lowest risk)
// nullifier: unique per credential, prevents double-use
// address_commitment: binding to Stellar address without revealing it
// merkle_root: trusted KYC issuer set root

// --- Private Inputs ---
// kyc_hash: hash of KYC document from trusted provider
// sanctions_hash: hash of sanctions screening result
// risk_score: 0–100 (lower is better)
// expiry_timestamp: unix timestamp credential expires
// stellar_address: actual Stellar address (never revealed)
// blinding_factor: randomness for address commitment
// kyc_merkle_path: Merkle proof that issuer is trusted
// sanctions_merkle_path: Merkle proof clearing sanctions

fn main(
    // Public inputs
    compliance_tier: pub u8,
    nullifier: pub Field,
    address_commitment: pub Field,
    kyc_merkle_root: pub Field,
    sanctions_merkle_root: pub Field,
    current_timestamp: pub u64,

    // Private inputs
    kyc_hash: Field,
    sanctions_hash: Field,
    risk_score: u8,
    expiry_timestamp: u64,
    stellar_address: Field,
    blinding_factor: Field,
    kyc_merkle_path: [Field; 20],
    kyc_merkle_indices: [u1; 20],
    sanctions_merkle_path: [Field; 20],
    sanctions_merkle_indices: [u1; 20],
) {
    // 1. Verify credential is not expired
    assert(expiry_timestamp > current_timestamp, "Credential has expired");

    // 2. Verify KYC issuer is in the trusted set via Merkle proof
    let computed_kyc_root = compute_merkle_root(kyc_hash, kyc_merkle_path, kyc_merkle_indices);
    assert(computed_kyc_root == kyc_merkle_root, "KYC issuer not in trusted set");

    // 3. Verify sanctions screening passed
    let computed_sanctions_root = compute_merkle_root(
        sanctions_hash,
        sanctions_merkle_path,
        sanctions_merkle_indices,
    );
    assert(
        computed_sanctions_root == sanctions_merkle_root,
        "Sanctions screening not cleared",
    );

    // 4. Compute and verify compliance tier from risk score
    let expected_tier = compute_tier(risk_score);
    assert(expected_tier == compliance_tier, "Tier does not match risk score");

    // 5. Compute and verify address commitment
    let computed_commitment = pedersen_hash([stellar_address, blinding_factor]);
    assert(computed_commitment == address_commitment, "Address commitment mismatch");

    // 6. Compute and verify nullifier
    let computed_nullifier = pedersen_hash([kyc_hash, blinding_factor, current_timestamp as Field]);
    assert(computed_nullifier == nullifier, "Nullifier computation failed");
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

fn compute_merkle_root(leaf: Field, path: [Field; 20], indices: [u1; 20]) -> Field {
    let mut current = leaf;
    for i in 0..20 {
        let sibling = path[i];
        let index = indices[i];
        if index == 0 {
            current = pedersen_hash([current, sibling]);
        } else {
            current = pedersen_hash([sibling, current]);
        }
    }
    current
}
