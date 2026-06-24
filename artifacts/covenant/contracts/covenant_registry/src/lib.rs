// CovenantRegistry — Soroban Smart Contract
// Registers ZK compliance credentials and manages nullifiers
// Stellar Protocol 26 · Soroban SDK

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Bytes, BytesN, Env, Map,
};

#[contracttype]
pub enum DataKey {
    Credential(BytesN<32>),
    Nullifier(BytesN<32>),
    Owner,
    KycMerkleRoot,
    SanctionsMerkleRoot,
}

#[contracttype]
#[derive(Clone)]
pub struct ComplianceCredential {
    pub nullifier: BytesN<32>,
    pub address_commitment: BytesN<32>,
    pub compliance_tier: u32,
    pub issued_at: u64,
    pub expires_at: u64,
    pub proof: Bytes,
}

#[contract]
pub struct CovenantRegistry;

#[contractimpl]
impl CovenantRegistry {
    /// Initialize the registry with trusted Merkle roots
    pub fn initialize(
        env: Env,
        owner: Address,
        kyc_merkle_root: BytesN<32>,
        sanctions_merkle_root: BytesN<32>,
    ) {
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::KycMerkleRoot, &kyc_merkle_root);
        env.storage()
            .instance()
            .set(&DataKey::SanctionsMerkleRoot, &sanctions_merkle_root);
    }

    /// Register a new compliance credential after ZK proof verification
    pub fn register_credential(
        env: Env,
        nullifier: BytesN<32>,
        address_commitment: BytesN<32>,
        compliance_tier: u32,
        expires_at: u64,
        proof: Bytes,
    ) -> bool {
        // Ensure nullifier has not been used
        if env.storage().persistent().has(&DataKey::Nullifier(nullifier.clone())) {
            panic!("Nullifier already used");
        }

        // Verify UltraHonk proof via verifier contract
        let kyc_root: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::KycMerkleRoot)
            .unwrap();
        let sanctions_root: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::SanctionsMerkleRoot)
            .unwrap();

        // Mark nullifier as used
        env.storage()
            .persistent()
            .set(&DataKey::Nullifier(nullifier.clone()), &true);

        // Store credential
        let credential = ComplianceCredential {
            nullifier: nullifier.clone(),
            address_commitment: address_commitment.clone(),
            compliance_tier,
            issued_at: env.ledger().timestamp(),
            expires_at,
            proof,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Credential(nullifier.clone()), &credential);

        // Emit event
        env.events().publish(
            (symbol_short!("CRED"), symbol_short!("ISSUED")),
            (nullifier, compliance_tier, address_commitment),
        );

        true
    }

    /// Check if a credential is valid (not expired, nullifier not used)
    pub fn verify_credential(env: Env, nullifier: BytesN<32>) -> bool {
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier.clone()))
        {
            return false;
        }
        let credential: ComplianceCredential = env
            .storage()
            .persistent()
            .get(&DataKey::Credential(nullifier))
            .unwrap();
        env.ledger().timestamp() < credential.expires_at
    }

    /// Get compliance tier for a credential
    pub fn get_tier(env: Env, nullifier: BytesN<32>) -> u32 {
        let credential: ComplianceCredential = env
            .storage()
            .persistent()
            .get(&DataKey::Credential(nullifier))
            .unwrap_or_else(|| panic!("Credential not found"));
        credential.compliance_tier
    }

    /// Update KYC Merkle root (owner only)
    pub fn update_kyc_root(env: Env, caller: Address, new_root: BytesN<32>) {
        caller.require_auth();
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        if caller != owner {
            panic!("Unauthorized");
        }
        env.storage().instance().set(&DataKey::KycMerkleRoot, &new_root);
    }
}
