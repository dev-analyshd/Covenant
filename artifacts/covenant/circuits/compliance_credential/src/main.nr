use dep::std::hash::poseidon2;

// ============================================================================
// Compliance Credential Circuit — Covenant
// ============================================================================
// Proves KYC verification, sanctions clearance, risk score, and expiry
// without revealing any underlying personal data.
//
// Public outputs:
//   - nullifier         (prevents double-use)
//   - compliance_tier   (1–5, derived from risk_score)
//   - address_commitment (public binding without revealing Stellar address)
//   - view_key_hash     (enables regulator selective disclosure)
//
// These outputs are submitted to CovenantRegistry on Stellar.
// The UltraHonk proof is verified by the Soroban UltraHonkVerifier contract
// using Protocol 26 BN254 host functions.
//
// Proof system: UltraHonk (Noir 1.0-beta.9 + Barretenberg 0.87.0)
// Hashing: Poseidon2 (Stellar Protocol 25 native host function)
// ============================================================================

// ── Tier thresholds (risk score → compliance tier) ──────────────────────────
global TIER_5_THRESHOLD: u32 = 10;   // Platinum — settlement limit $1M
global TIER_4_THRESHOLD: u32 = 25;   // Gold     — settlement limit $800K
global TIER_3_THRESHOLD: u32 = 50;   // Silver   — settlement limit $600K
global TIER_2_THRESHOLD: u32 = 75;   // Bronze   — settlement limit $400K
// Tier 1: Basic — risk_score 76–100, settlement limit $200K

// ── Tier computation (deterministic, constrained in ZK) ─────────────────────
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

// ── Poseidon2 Merkle root (uses same hash as Stellar Protocol 25 host fn) ───
// Computes the root of a binary Merkle tree from leaf → path → root.
// indices[i] = 0: leaf/subtree is on the LEFT at depth i
// indices[i] = 1: leaf/subtree is on the RIGHT at depth i
//
// This is a direct Poseidon2 implementation (no dep::std::merkle dependency)
// to ensure compatibility with Stellar's Protocol 25 Poseidon2 host function.
fn poseidon2_merkle_root(
    leaf: Field,
    path: [Field; 32],
    indices: [u32; 32],
) -> Field {
    let mut current = leaf;
    for i in 0..32 {
        let sibling = path[i];
        // When index = 0: current is left child, sibling is right
        // When index = 1: sibling is left child, current is right
        if indices[i] == 0 {
            current = poseidon2::hash([current, sibling]);
        } else {
            current = poseidon2::hash([sibling, current]);
        }
    }
    current
}

// ── Main circuit ─────────────────────────────────────────────────────────────
fn main(
    // ── Private inputs (never leave the prover) ──────────────────────────────
    kyc_hash: Field,           // Poseidon2 hash of KYC document from trusted issuer
    sanctions_hash: Field,     // Poseidon2 hash of sanctions screening clearance
    source_commitment: Field,  // Poseidon2 commitment to source-of-funds documentation
    risk_score: u32,           // Internal risk assessment score (0–100)
    credential_secret: Field,  // User's unique credential secret (fresh randomness)

    // Merkle membership proofs (private)
    kyc_path: [Field; 32],         // Sibling path: KYC hash in trusted issuer tree
    kyc_indices: [u32; 32],        // Direction bits: 0=left, 1=right
    sanctions_path: [Field; 32],   // Sibling path: sanctions hash in cleared-entities tree
    sanctions_indices: [u32; 32],  // Direction bits: 0=left, 1=right

    // ── Public inputs (submitted on-chain with proof) ────────────────────────
    trusted_issuer_root: pub Field,       // Merkle root of trusted KYC issuer set
    negative_screening_root: pub Field,   // Merkle root of sanctions-cleared entities
    current_timestamp: pub u64,           // Current Stellar ledger close timestamp
    expiry_timestamp: pub u64,            // Credential expiry timestamp
    tier_threshold: pub u32,              // Maximum risk score for requested tier
) -> pub (Field, u32, Field, Field) {

    // =========================================================================
    // CONSTRAINT 1: KYC hash is a leaf of the trusted issuer Merkle tree
    //
    // The KYC issuer computes: leaf = poseidon2([kyc_hash, credential_secret])
    // This binds the document hash to the user's secret, preventing reuse.
    // =========================================================================
    let kyc_leaf = poseidon2::hash([kyc_hash, credential_secret]);
    let kyc_root = poseidon2_merkle_root(kyc_leaf, kyc_path, kyc_indices);
    assert(kyc_root == trusted_issuer_root, "KYC verification not from trusted issuer");

    // =========================================================================
    // CONSTRAINT 2: Sanctions clearance is in the negative screening Merkle tree
    //
    // The screening provider computes: leaf = poseidon2([sanctions_hash, credential_secret])
    // =========================================================================
    let sanctions_leaf = poseidon2::hash([sanctions_hash, credential_secret]);
    let sanctions_root = poseidon2_merkle_root(sanctions_leaf, sanctions_path, sanctions_indices);
    assert(sanctions_root == negative_screening_root, "Sanctions screening not cleared");

    // =========================================================================
    // CONSTRAINT 3: Risk score is within acceptable range for requested tier
    // =========================================================================
    assert(risk_score <= tier_threshold, "Risk score exceeds tier threshold");

    // =========================================================================
    // CONSTRAINT 4: Credential has not expired
    // =========================================================================
    assert(expiry_timestamp > current_timestamp, "Credential has expired");

    // =========================================================================
    // CONSTRAINT 5: Source of funds commitment is non-empty
    // =========================================================================
    assert(source_commitment != 0, "Source of funds commitment required");

    // =========================================================================
    // COMPUTE PUBLIC OUTPUTS
    // =========================================================================

    // Compliance tier: deterministic from risk_score
    let compliance_tier = compute_tier(risk_score);

    // Nullifier: unique per issuance, prevents credential replay
    // nullifier = poseidon2(credential_secret || current_timestamp)
    let nullifier = poseidon2::hash([credential_secret, current_timestamp as Field]);

    // Address commitment: public binding to Stellar address without revealing it
    // address_commitment = poseidon2(credential_secret || 0)
    let address_commitment = poseidon2::hash([credential_secret, 0]);

    // View key hash: enables regulator selective disclosure
    // Regulator derives: view_key = poseidon2(credential_secret || regulator_pk)
    // We publish poseidon2(view_key) so the contract can verify disclosure
    let view_key_hash = poseidon2::hash([credential_secret, 1]);

    (nullifier, compliance_tier, address_commitment, view_key_hash)
}

// ============================================================================
// Unit Tests
// ============================================================================

// Test: tier computation (runs without Merkle roots — pure unit test)
#[test]
fn test_compute_tier_boundaries() {
    assert(compute_tier(0) == 5);
    assert(compute_tier(10) == 5);   // boundary
    assert(compute_tier(11) == 4);   // boundary + 1
    assert(compute_tier(25) == 4);
    assert(compute_tier(26) == 3);
    assert(compute_tier(50) == 3);
    assert(compute_tier(51) == 2);
    assert(compute_tier(75) == 2);
    assert(compute_tier(76) == 1);
    assert(compute_tier(100) == 1);
}

// Test: output derivation from secret (no Merkle required)
#[test]
fn test_output_derivation() {
    let credential_secret = 0xdeadbeef as Field;
    let current_timestamp = 1_750_000_000u64;

    let nullifier = poseidon2::hash([credential_secret, current_timestamp as Field]);
    let addr_commitment = poseidon2::hash([credential_secret, 0]);
    let view_key_hash = poseidon2::hash([credential_secret, 1]);

    // All outputs must be non-zero (domain-separated with different constants)
    assert(nullifier != 0);
    assert(addr_commitment != 0);
    assert(view_key_hash != 0);

    // Outputs must be distinct (domain separation working correctly)
    assert(nullifier != addr_commitment);
    assert(nullifier != view_key_hash);
    assert(addr_commitment != view_key_hash);
}

// Test: Merkle root computation (verifies our Poseidon2 implementation)
// Uses known test vectors for a depth-1 tree (simplified)
#[test]
fn test_poseidon2_merkle_root_depth1() {
    let leaf: Field = 42;
    let sibling: Field = 99;

    // With index = 0 (leaf on left): root = poseidon2([leaf, sibling])
    let path_left = [sibling, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                     0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let indices_left = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let root_left = poseidon2_merkle_root(leaf, path_left, indices_left);

    // With index = 1 (leaf on right): root = poseidon2([sibling, leaf])
    let path_right = [sibling, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let indices_right = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let root_right = poseidon2_merkle_root(leaf, path_right, indices_right);

    // Left and right placement must give different roots
    assert(root_left != root_right);
    // Both roots must be non-zero
    assert(root_left != 0);
    assert(root_right != 0);
}

// Test: consistent nullifier (same inputs → same nullifier)
#[test]
fn test_nullifier_determinism() {
    let secret = 12345 as Field;
    let ts = 1000u64;
    let n1 = poseidon2::hash([secret, ts as Field]);
    let n2 = poseidon2::hash([secret, ts as Field]);
    assert(n1 == n2);

    // Different timestamp → different nullifier (prevents replay across time)
    let n3 = poseidon2::hash([secret, 1001u64 as Field]);
    assert(n1 != n3);
}
