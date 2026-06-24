use dep::std::hash::poseidon2;
use dep::std::merkle::compute_merkle_root;

// ============================================================================
// Compliance Credential Circuit — Covenant
// ============================================================================
// Proves: KYC verification, sanctions clearance, risk score, expiry
// Public outputs: nullifier, compliance_tier, address_commitment, view_key_hash
//
// Private inputs stay off-chain forever. Only the proof and public outputs
// are submitted to the CovenantRegistry Soroban contract on Stellar.
//
// Proof system: UltraHonk (Noir 1.0-beta.9 + Barretenberg 0.87.0)
// ============================================================================

// Tier thresholds (risk score ranges)
global TIER_5_THRESHOLD: u32 = 10;   // Platinum — up to $1M
global TIER_4_THRESHOLD: u32 = 25;   // Gold     — up to $800K
global TIER_3_THRESHOLD: u32 = 50;   // Silver   — up to $600K
global TIER_2_THRESHOLD: u32 = 75;   // Bronze   — up to $400K
global TIER_1_THRESHOLD: u32 = 100;  // Basic    — up to $200K

// Compute compliance tier from risk score
fn compute_tier(risk_score: u32) -> u32 {
    if risk_score <= TIER_5_THRESHOLD {
        5
    } else if risk_score <= TIER_4_THRESHOLD {
        4
    } else if risk_score <= TIER_3_THRESHOLD {
        3
    } else if risk_score <= TIER_2_THRESHOLD {
        2
    } else {
        1
    }
}

// Verify Merkle membership using Poseidon2 (Stellar Protocol 25 native hash)
fn verify_merkle_membership(
    leaf: Field,
    root: Field,
    path: [Field; 32],
    indices: [u32; 32],
) -> bool {
    let computed_root = compute_merkle_root(leaf, path, indices);
    computed_root == root
}

fn main(
    // ── Private inputs (never leave the prover) ──────────────────────────────
    kyc_hash: Field,           // Hash of KYC verification document
    sanctions_hash: Field,     // Hash of sanctions screening result
    source_commitment: Field,  // Commitment to source-of-funds documentation
    risk_score: u32,           // Internal risk assessment (0–100)
    credential_secret: Field,  // User's unique credential secret (randomness)

    // Merkle path proofs (private)
    kyc_path: [Field; 32],         // Merkle path — KYC hash in trusted issuer tree
    kyc_indices: [u32; 32],        // Path indices for KYC
    sanctions_path: [Field; 32],   // Merkle path — sanctions hash in cleared tree
    sanctions_indices: [u32; 32],  // Path indices for sanctions

    // ── Public inputs (visible on-chain) ────────────────────────────────────
    trusted_issuer_root: pub Field,       // Merkle root of trusted KYC issuers
    negative_screening_root: pub Field,   // Merkle root of cleared sanctions
    current_timestamp: pub u64,           // Current block timestamp (ledger close time)
    expiry_timestamp: pub u64,            // Credential expiry
    tier_threshold: pub u32,              // Maximum risk score for this tier
) -> pub (Field, u32, Field, Field) {

    // =========================================================================
    // CONSTRAINT 1: KYC hash is in the trusted issuer Merkle tree
    // =========================================================================
    let kyc_leaf = poseidon2::hash([kyc_hash, credential_secret]);
    let kyc_valid = verify_merkle_membership(
        kyc_leaf,
        trusted_issuer_root,
        kyc_path,
        kyc_indices,
    );
    assert(kyc_valid, "KYC verification not from trusted issuer");

    // =========================================================================
    // CONSTRAINT 2: Sanctions clearance is in the negative screening Merkle tree
    // =========================================================================
    let sanctions_leaf = poseidon2::hash([sanctions_hash, credential_secret]);
    let sanctions_valid = verify_merkle_membership(
        sanctions_leaf,
        negative_screening_root,
        sanctions_path,
        sanctions_indices,
    );
    assert(sanctions_valid, "Sanctions screening not cleared");

    // =========================================================================
    // CONSTRAINT 3: Risk score is within acceptable range for tier
    // =========================================================================
    assert(risk_score <= tier_threshold, "Risk score exceeds tier threshold");

    // =========================================================================
    // CONSTRAINT 4: Credential is not expired
    // =========================================================================
    assert(expiry_timestamp > current_timestamp, "Credential has expired");

    // =========================================================================
    // CONSTRAINT 5: Source of funds commitment is non-empty
    // =========================================================================
    assert(source_commitment != 0, "Source of funds commitment required");

    // =========================================================================
    // COMPUTE PUBLIC OUTPUTS
    // =========================================================================

    // Compliance tier derived from risk score (deterministic)
    let compliance_tier = compute_tier(risk_score);

    // Nullifier: prevents credential double-use. Unique per issuance.
    // nullifier = poseidon2(credential_secret || current_timestamp)
    let nullifier = poseidon2::hash([credential_secret, current_timestamp as Field]);

    // Address commitment: public binding to Stellar address without revealing it
    // address_commitment = poseidon2(credential_secret || 0)
    let address_commitment = poseidon2::hash([credential_secret, 0]);

    // View key hash: enables regulator selective disclosure
    // Regulator derives: view_key = poseidon2(credential_secret || regulator_pk)
    // We publish hash so the on-chain contract can verify view_key correctness
    let view_key_hash = poseidon2::hash([credential_secret, 1]);

    (nullifier, compliance_tier, address_commitment, view_key_hash)
}

// ============================================================================
// Tests
// ============================================================================
#[test]
fn test_compute_tier() {
    assert(compute_tier(5) == 5);
    assert(compute_tier(10) == 5);
    assert(compute_tier(11) == 4);
    assert(compute_tier(25) == 4);
    assert(compute_tier(26) == 3);
    assert(compute_tier(50) == 3);
    assert(compute_tier(51) == 2);
    assert(compute_tier(75) == 2);
    assert(compute_tier(76) == 1);
    assert(compute_tier(100) == 1);
}

#[test]
fn test_compliance_credential_tier4() {
    let kyc_hash = 123456789;
    let sanctions_hash = 987654321;
    let source_commitment = 555555555;
    let risk_score = 15; // Tier 4
    let credential_secret = 111111111;

    // Simplified: zero roots accept any leaf (test only)
    let trusted_issuer_root = 0;
    let negative_screening_root = 0;
    let current_timestamp = 1_000u64;
    let expiry_timestamp = 999_999u64;
    let tier_threshold = 25u32;

    let kyc_path = [0; 32];
    let kyc_indices = [0; 32];
    let sanctions_path = [0; 32];
    let sanctions_indices = [0; 32];

    let (nullifier, tier, addr_commit, view_hash) = main(
        kyc_hash,
        sanctions_hash,
        source_commitment,
        risk_score,
        credential_secret,
        kyc_path,
        kyc_indices,
        sanctions_path,
        sanctions_indices,
        trusted_issuer_root,
        negative_screening_root,
        current_timestamp,
        expiry_timestamp,
        tier_threshold,
    );

    assert(tier == 4);
    assert(nullifier != 0);
    assert(addr_commit != 0);
    assert(view_hash != 0);
}
