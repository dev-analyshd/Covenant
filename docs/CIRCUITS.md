# Covenant — Noir Circuit Specifications

## Overview

Covenant uses two Noir circuits compiled with the UltraHonk proving backend (Barretenberg 0.87.0). Both circuits use Poseidon2 hashing (Stellar Protocol 25 native host function) for Merkle tree operations.

---

## Circuit 1: `compliance_credential`

**File**: `circuits/compliance_credential/src/main.nr`  
**Purpose**: Proves KYC verification, sanctions clearance, risk score, and credential expiry without revealing any private data.

### Private Inputs

| Input | Type | Description |
|-------|------|-------------|
| `kyc_hash` | `Field` | Poseidon2 hash of KYC verification document |
| `sanctions_hash` | `Field` | Poseidon2 hash of sanctions screening result |
| `source_commitment` | `Field` | Commitment to source-of-funds documentation |
| `risk_score` | `u32` | Internal compliance risk score (0–100) |
| `credential_secret` | `Field` | User's unique credential secret (randomness) |
| `kyc_path` | `[Field; 32]` | Merkle path for KYC hash in trusted issuer tree |
| `kyc_indices` | `[u32; 32]` | Path direction indices for KYC |
| `sanctions_path` | `[Field; 32]` | Merkle path for sanctions hash in cleared tree |
| `sanctions_indices` | `[u32; 32]` | Path direction indices for sanctions |

### Public Inputs

| Input | Type | Description |
|-------|------|-------------|
| `trusted_issuer_root` | `Field` | Merkle root of trusted KYC issuer set |
| `negative_screening_root` | `Field` | Merkle root of sanctions-cleared set |
| `current_timestamp` | `u64` | Current Stellar ledger close timestamp |
| `expiry_timestamp` | `u64` | Credential expiry timestamp |
| `tier_threshold` | `u32` | Maximum risk score for requested tier |

### Outputs (public)

| Output | Type | Description |
|--------|------|-------------|
| `nullifier` | `Field` | `poseidon2(credential_secret, current_timestamp)` — prevents replay |
| `compliance_tier` | `u32` | Computed tier 1–5 from risk score |
| `address_commitment` | `Field` | `poseidon2(credential_secret, 0)` — public binding |
| `view_key_hash` | `Field` | `poseidon2(credential_secret, 1)` — enables regulator disclosure |

### Constraints

```noir
// C1: KYC issuer is trusted
let kyc_leaf = poseidon2::hash([kyc_hash, credential_secret]);
assert(compute_merkle_root(kyc_leaf, kyc_path, kyc_indices) == trusted_issuer_root);

// C2: Sanctions status is cleared
let sanctions_leaf = poseidon2::hash([sanctions_hash, credential_secret]);
assert(compute_merkle_root(sanctions_leaf, sanctions_path, sanctions_indices) == negative_screening_root);

// C3: Risk score within tier threshold
assert(risk_score <= tier_threshold);

// C4: Credential not expired
assert(expiry_timestamp > current_timestamp);

// C5: Source of funds is committed
assert(source_commitment != 0);
```

### Tier Computation

```noir
fn compute_tier(risk_score: u32) -> u32 {
    if risk_score <= 10 { 5 }      // Platinum
    else if risk_score <= 25 { 4 } // Gold
    else if risk_score <= 50 { 3 } // Silver
    else if risk_score <= 75 { 2 } // Bronze
    else { 1 }                     // Basic
}
```

### Proof Generation Commands

```bash
# Compile
nargo compile

# Export verification key (for Soroban contract)
bb write_vk -b target/compliance_credential.json -o vk.bin

# Generate proof
nargo execute witness
bb prove -b target/compliance_credential.json -w target/witness.gz -o proof.bin

# Verify locally
bb verify -k vk.bin -p proof.bin
```

---

## Circuit 2: `private_settlement`

**File**: `circuits/private_settlement/src/main.nr`  
**Purpose**: Proves sender has sufficient balance, settlement is within tier-adjusted limits, and recipient meets compliance requirements — without revealing amounts on-chain.

### Private Inputs

| Input | Type | Description |
|-------|------|-------------|
| `amount` | `u64` | Transfer amount (in asset base units) |
| `sender_balance` | `u64` | Sender's current verified balance |
| `compliance_tier` | `u32` | Sender's compliance tier (1–5) |
| `sender_secret` | `Field` | Sender's credential secret |
| `recipient_tier` | `u32` | Recipient's compliance tier |

### Public Inputs

| Input | Type | Description |
|-------|------|-------------|
| `settlement_id` | `Field` | Unique settlement identifier |
| `min_recipient_tier` | `u32` | Minimum tier required for this settlement type |
| `max_amount` | `u64` | Global maximum settlement amount |
| `asset_id` | `Field` | Hash of asset being transferred |
| `compliance_nullifier` | `Field` | Nullifier from sender's compliance credential |
| `current_timestamp` | `u64` | Current Stellar ledger timestamp |

### Outputs (public)

| Output | Type | Description |
|--------|------|-------------|
| `settlement_hash` | `Field` | `poseidon2(settlement_id, amount, asset_id, sender_secret, timestamp)` |
| `compliance_attestation` | `bool` | `true` if all constraints satisfied |
| `sender_commitment` | `Field` | `poseidon2(sender_secret, 0)` — sender's public identity |
| `tier_limit` | `u64` | Tier-adjusted maximum amount |

### Constraints

```noir
// C1: Positive amount within global cap
assert(amount > 0);
assert(amount <= max_amount);

// C2: Balance range proof
assert(sender_balance >= amount);

// C3: Sender tier validity
assert(compliance_tier >= 1 && compliance_tier <= 5);

// C4: Recipient meets minimum tier
assert(recipient_tier >= min_recipient_tier);

// C5: Non-null compliance credential
assert(compliance_nullifier != 0);

// C6: Tier-adjusted limit
let tier_limit = match compliance_tier {
    5 => max_amount,           // 100% of cap
    4 => max_amount * 4 / 5,  // 80% of cap
    3 => max_amount * 3 / 5,  // 60% of cap
    2 => max_amount * 2 / 5,  // 40% of cap
    1 => max_amount * 1 / 5,  // 20% of cap
    _ => 0,
};
assert(amount <= tier_limit);
```

---

## Noir Configuration

### `Nargo.toml` (compliance_credential)

```toml
[package]
name = "compliance_credential"
type = "bin"
authors = ["Covenant"]
compiler_version = ">=1.0.0-beta.9"

[dependencies]
std = { path = "../../noir-stdlib" }
```

### `Nargo.toml` (private_settlement)

```toml
[package]
name = "private_settlement"
type = "bin"
authors = ["Covenant"]
compiler_version = ">=1.0.0-beta.9"

[dependencies]
std = { path = "../../noir-stdlib" }
```

---

## Proof System: UltraHonk

**Backend**: Barretenberg 0.87.0 by Aztec Protocol  
**Proof type**: UltraHonk (PLONK variant with custom gates)

UltraHonk provides:
- **Recursive composition**: Proofs can be verified inside other proofs
- **Custom gates**: Efficient Poseidon2 hashing and range proofs
- **BN254 native**: Matches Stellar Protocol 26 host functions exactly
- **Proof size**: ~256 bytes (compact for on-chain storage)
- **Verification**: O(1) on-chain — single pairing check

### On-Chain Verification Pipeline

```
proof.bin (256 bytes)
    │
    ↓ Fiat-Shamir transcript (hash-based challenge)
    │
    ↓ Sumcheck verification (log₂(n) rounds)
    │
    ↓ Gemini polynomial commitment opening
    │
    ↓ Shplonk batched KZG verification
    │
    ↓ Final pairing check
    │  e(P₁, [x]₂) == e(P₂, [1]₂)
    │  via bn254_pairing (Protocol 26 host function)
    │
    ↓ Result: valid / invalid
```

---

## Poseidon2 Hashing

Covenant uses Poseidon2 (the Protocol 25 native hash) for all Merkle tree operations and commitment construction:

```noir
use dep::std::hash::poseidon2;

// Leaf computation
let kyc_leaf = poseidon2::hash([kyc_hash, credential_secret]);

// Merkle root verification
use dep::std::merkle::compute_merkle_root;
let computed_root = compute_merkle_root(leaf, path, indices);
assert(computed_root == expected_root);
```

Poseidon2 over BN254 scalar field matches Stellar's native host function exactly, ensuring that Merkle proofs computed off-chain verify efficiently on Soroban.

---

## Security Properties

| Property | Guarantee |
|----------|-----------|
| **Soundness** | Invalid proofs cannot pass verification (computational hardness of BN254 DLP) |
| **Zero-knowledge** | Verifier learns nothing beyond the public outputs |
| **Completeness** | Valid witnesses always produce valid proofs |
| **Binding** | Commitments are collision-resistant (Poseidon2) |
| **Non-malleability** | Fiat-Shamir with random oracle ensures proof uniqueness |
| **Nullifier uniqueness** | `poseidon2(secret, timestamp)` — unique per issuance |
| **Expiry enforcement** | Circuit constraint: `expiry > current_timestamp` |
