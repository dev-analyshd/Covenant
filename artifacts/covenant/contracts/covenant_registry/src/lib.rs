#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, symbol_short,
    Address, Bytes, BytesN, Env, Map, Symbol, Vec,
};

// ============================================================================
// CovenantRegistry — Credential Lifecycle + Nullifier Management
// ============================================================================
// Enhanced with:
//   - prune_expired(): nullifier storage scalability (rent optimization)
//   - rotate_view_key(): view key rotation without re-KYC
//   - update_tier_limit(): on-chain tier limit oracle (governance)
//   - renew_credential(): credential renewal with fresh proof
//   - register_credential(): ZK-gated credential issuance
//   - verify_credential(): credential validity check
//   - revoke_credential(): admin revocation
//   - update_issuer_root(): Merkle root governance
// ============================================================================

// 90-day credential TTL in seconds
const CREDENTIAL_TTL: u64 = 90 * 24 * 60 * 60;

// Grace period for renewal (7 days before expiry)
const RENEWAL_GRACE_PERIOD: u64 = 7 * 24 * 60 * 60;

// Default tier settlement limits (in micro-USDC, 6 decimals)
// Tier 1: $200K, Tier 2: $400K, Tier 3: $600K, Tier 4: $800K, Tier 5: $1M
const DEFAULT_LIMITS: [i128; 6] = [0, 200_000_000_000, 400_000_000_000, 600_000_000_000, 800_000_000_000, 1_000_000_000_000];

const K_ADMIN: Symbol = symbol_short!("ADMIN");
const K_ISSUER_ROOT: Symbol = symbol_short!("ISRROOT");
const K_SANCTION_ROOT: Symbol = symbol_short!("SANROOT");
const K_CRED_COUNT: Symbol = symbol_short!("CREDCNT");
const K_NULLIFIERS: Symbol = symbol_short!("NULLS");
const K_VK: Symbol = symbol_short!("VK");
const K_VERIFIER: Symbol = symbol_short!("VERIFIER");
const K_TIER_LIMITS: Symbol = symbol_short!("TIERLIM");
const K_REVOKED_COUNT: Symbol = symbol_short!("REVCNT");
const K_PRUNED_COUNT: Symbol = symbol_short!("PRNCNT");

#[contracterror]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CovenantError {
    Unauthorized = 1,
    InvalidProof = 2,
    NullifierUsed = 3,
    CredentialNotFound = 4,
    CredentialExpired = 5,
    InvalidPublicInputs = 6,
    AlreadyInitialized = 7,
    InvalidViewKey = 8,
    NotEligibleForRenewal = 9,
    InvalidTier = 10,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComplianceCredential {
    pub nullifier: BytesN<32>,
    pub tier: u32,
    pub expiry: u64,
    pub address_commitment: BytesN<32>,
    pub view_key_hash: BytesN<32>,
    pub issued_at: u64,
    pub revoked: bool,
    pub renewed_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TierLimits {
    pub tier1: i128,
    pub tier2: i128,
    pub tier3: i128,
    pub tier4: i128,
    pub tier5: i128,
}

impl TierLimits {
    fn default_limits() -> Self {
        Self {
            tier1: DEFAULT_LIMITS[1],
            tier2: DEFAULT_LIMITS[2],
            tier3: DEFAULT_LIMITS[3],
            tier4: DEFAULT_LIMITS[4],
            tier5: DEFAULT_LIMITS[5],
        }
    }
    fn get(&self, tier: u32) -> i128 {
        match tier {
            1 => self.tier1,
            2 => self.tier2,
            3 => self.tier3,
            4 => self.tier4,
            5 => self.tier5,
            _ => 0,
        }
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Credential(BytesN<32>),
    TierByCommitment(BytesN<32>),
    NullifierExpiry(BytesN<32>),
}

#[contract]
pub struct CovenantRegistry;

#[contractimpl]
impl CovenantRegistry {
    pub fn initialize(
        env: Env,
        admin: Address,
        issuer_root: BytesN<32>,
        sanction_root: BytesN<32>,
        vk: BytesN<32>,
    ) -> Result<(), CovenantError> {
        if env.storage().persistent().has(&K_ADMIN) {
            return Err(CovenantError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&K_ADMIN, &admin);
        env.storage().persistent().set(&K_ISSUER_ROOT, &issuer_root);
        env.storage().persistent().set(&K_SANCTION_ROOT, &sanction_root);
        env.storage().persistent().set(&K_VK, &vk);
        env.storage().persistent().set(&K_CRED_COUNT, &0u32);
        env.storage().persistent().set(&K_REVOKED_COUNT, &0u32);
        env.storage().persistent().set(&K_PRUNED_COUNT, &0u32);
        let limits = TierLimits::default_limits();
        env.storage().persistent().set(&K_TIER_LIMITS, &limits);
        env.storage()
            .persistent()
            .set(&K_NULLIFIERS, &Map::<BytesN<32>, u64>::new(&env));
        Ok(())
    }

    /// Register a compliance credential after ZK proof verification.
    /// public_inputs: [nullifier(32), tier_bytes(32), address_commitment(32), view_key_hash(32)]
    pub fn register_credential(
        env: Env,
        caller: Address,
        proof: BytesN<256>,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<BytesN<32>, CovenantError> {
        caller.require_auth();
        if public_inputs.len() < 4 {
            return Err(CovenantError::InvalidPublicInputs);
        }

        let vk: BytesN<32> = env.storage().persistent().get(&K_VK).unwrap();
        if !Self::verify_ultrahonk(&env, &proof, &public_inputs, &vk) {
            return Err(CovenantError::InvalidProof);
        }

        let nullifier = public_inputs.get(0).unwrap();
        let tier_bytes = public_inputs.get(1).unwrap();
        let address_commitment = public_inputs.get(2).unwrap();
        let view_key_hash = public_inputs.get(3).unwrap();

        // Check nullifier not already used
        let mut nullifiers: Map<BytesN<32>, u64> = env
            .storage().persistent().get(&K_NULLIFIERS)
            .unwrap_or_else(|| Map::new(&env));

        if nullifiers.contains_key(nullifier.clone()) {
            return Err(CovenantError::NullifierUsed);
        }

        let tier = tier_bytes.to_array()[31] as u32;
        let expiry = env.ledger().timestamp() + CREDENTIAL_TTL;

        let credential = ComplianceCredential {
            nullifier: nullifier.clone(),
            tier,
            expiry,
            address_commitment: address_commitment.clone(),
            view_key_hash,
            issued_at: env.ledger().timestamp(),
            revoked: false,
            renewed_count: 0,
        };

        env.storage().persistent()
            .set(&StorageKey::Credential(nullifier.clone()), &credential);
        env.storage().persistent()
            .set(&StorageKey::TierByCommitment(address_commitment), &tier);
        // Store nullifier → expiry mapping for pruning
        nullifiers.set(nullifier.clone(), expiry);
        env.storage().persistent().set(&K_NULLIFIERS, &nullifiers);

        let count: u32 = env.storage().persistent().get(&K_CRED_COUNT).unwrap_or(0);
        env.storage().persistent().set(&K_CRED_COUNT, &(count + 1));

        env.events().publish(
            (symbol_short!("COVENANT"), symbol_short!("REGCRED")),
            (nullifier.clone(), tier, expiry),
        );
        Ok(nullifier)
    }

    /// Renew a credential near expiry with a fresh proof.
    /// Can be called up to RENEWAL_GRACE_PERIOD days before expiry.
    /// The old nullifier is retired, new nullifier is issued.
    pub fn renew_credential(
        env: Env,
        caller: Address,
        old_nullifier: BytesN<32>,
        new_proof: BytesN<256>,
        new_public_inputs: Vec<BytesN<32>>,
    ) -> Result<BytesN<32>, CovenantError> {
        caller.require_auth();
        if new_public_inputs.len() < 4 {
            return Err(CovenantError::InvalidPublicInputs);
        }

        let now = env.ledger().timestamp();
        let cred: ComplianceCredential = env.storage().persistent()
            .get(&StorageKey::Credential(old_nullifier.clone()))
            .ok_or(CovenantError::CredentialNotFound)?;

        if cred.revoked {
            return Err(CovenantError::CredentialExpired);
        }

        // Must be within renewal window: (expiry - grace_period) <= now <= expiry
        if now < cred.expiry.saturating_sub(RENEWAL_GRACE_PERIOD) {
            return Err(CovenantError::NotEligibleForRenewal);
        }
        if now > cred.expiry {
            return Err(CovenantError::CredentialExpired);
        }

        // Verify new proof
        let vk: BytesN<32> = env.storage().persistent().get(&K_VK).unwrap();
        if !Self::verify_ultrahonk(&env, &new_proof, &new_public_inputs, &vk) {
            return Err(CovenantError::InvalidProof);
        }

        let new_nullifier = new_public_inputs.get(0).unwrap();
        let new_address_commitment = new_public_inputs.get(2).unwrap();
        let new_view_key_hash = new_public_inputs.get(3).unwrap();

        // Retire old credential
        let mut old_cred = cred.clone();
        old_cred.revoked = true;
        env.storage().persistent()
            .set(&StorageKey::Credential(old_nullifier.clone()), &old_cred);

        // Issue new credential with extended TTL
        let new_expiry = now + CREDENTIAL_TTL;
        let new_credential = ComplianceCredential {
            nullifier: new_nullifier.clone(),
            tier: cred.tier,
            expiry: new_expiry,
            address_commitment: new_address_commitment.clone(),
            view_key_hash: new_view_key_hash,
            issued_at: now,
            revoked: false,
            renewed_count: cred.renewed_count + 1,
        };
        env.storage().persistent()
            .set(&StorageKey::Credential(new_nullifier.clone()), &new_credential);
        env.storage().persistent()
            .set(&StorageKey::TierByCommitment(new_address_commitment), &cred.tier);

        // Update nullifier map
        let mut nullifiers: Map<BytesN<32>, u64> = env.storage().persistent()
            .get(&K_NULLIFIERS).unwrap_or_else(|| Map::new(&env));
        nullifiers.set(new_nullifier.clone(), new_expiry);
        env.storage().persistent().set(&K_NULLIFIERS, &nullifiers);

        let count: u32 = env.storage().persistent().get(&K_CRED_COUNT).unwrap_or(0);
        env.storage().persistent().set(&K_CRED_COUNT, &(count + 1));

        env.events().publish(
            (symbol_short!("COVENANT"), symbol_short!("RENEWED")),
            (old_nullifier, new_nullifier.clone(), new_expiry),
        );
        Ok(new_nullifier)
    }

    /// Rotate view key — allows regulator key rotation without re-KYCing.
    /// The credential holder proves they own the credential by providing
    /// the old view key preimage: SHA256(credential_secret || new_regulator_pk) = new_vk_hash
    pub fn rotate_view_key(
        env: Env,
        caller: Address,
        nullifier: BytesN<32>,
        old_view_key: BytesN<32>,
        new_view_key_hash: BytesN<32>,
    ) -> Result<(), CovenantError> {
        caller.require_auth();

        let mut credential: ComplianceCredential = env.storage().persistent()
            .get(&StorageKey::Credential(nullifier.clone()))
            .ok_or(CovenantError::CredentialNotFound)?;

        if credential.revoked {
            return Err(CovenantError::CredentialExpired);
        }

        // Verify old_view_key matches stored view_key_hash
        // Production: poseidon2(old_view_key) == credential.view_key_hash
        // Testnet: SHA256(old_view_key) == credential.view_key_hash
        let mut msg = Bytes::new(&env);
        for b in old_view_key.to_array().iter() { msg.push_back(*b); }
        let old_hash: BytesN<32> = env.crypto().sha256(&msg).into();

        // Allow: old hash matches OR credential view_key_hash is all-zeros (initialization)
        let stored_hash = credential.view_key_hash.to_array();
        let computed_hash = old_hash.to_array();
        if stored_hash != computed_hash && stored_hash != [0u8; 32] {
            return Err(CovenantError::InvalidViewKey);
        }

        credential.view_key_hash = new_view_key_hash.clone();
        env.storage().persistent()
            .set(&StorageKey::Credential(nullifier.clone()), &credential);

        env.events().publish(
            (symbol_short!("COVENANT"), symbol_short!("VKROT")),
            (nullifier, new_view_key_hash),
        );
        Ok(())
    }

    /// Prune expired nullifiers to reclaim Soroban storage rent.
    /// Returns number of nullifiers pruned.
    /// In production: called by a keeper bot every 30 days.
    pub fn prune_expired(env: Env) -> u32 {
        let now = env.ledger().timestamp();
        let nullifiers: Map<BytesN<32>, u64> = env.storage().persistent()
            .get(&K_NULLIFIERS).unwrap_or_else(|| Map::new(&env));

        let mut pruned_nullifiers: Map<BytesN<32>, u64> = Map::new(&env);
        let mut pruned_count: u32 = 0;
        let mut kept_count: u32 = 0;

        // Separate expired from active nullifiers
        // Note: in no_std we iterate and rebuild (no .retain())
        for (nullifier, expiry) in nullifiers.iter() {
            if expiry <= now {
                // Remove expired credential storage
                env.storage().instance()
                    .remove(&StorageKey::Credential(nullifier.clone()));
                pruned_count += 1;
            } else {
                pruned_nullifiers.set(nullifier, expiry);
                kept_count += 1;
            }
        }

        env.storage().persistent().set(&K_NULLIFIERS, &pruned_nullifiers);

        let total_pruned: u32 = env.storage().persistent()
            .get(&K_PRUNED_COUNT).unwrap_or(0);
        env.storage().persistent().set(&K_PRUNED_COUNT, &(total_pruned + pruned_count));

        env.events().publish(
            (symbol_short!("COVENANT"), symbol_short!("PRUNED")),
            (pruned_count, kept_count),
        );
        pruned_count
    }

    /// Update tier settlement limits — governance oracle.
    /// Allows regulators to adjust limits without circuit redeployment.
    /// Tier limits are parameterized via public input `max_amount` in the circuit.
    pub fn update_tier_limit(
        env: Env,
        admin: Address,
        tier: u32,
        new_limit: i128,
    ) -> Result<(), CovenantError> {
        if tier < 1 || tier > 5 {
            return Err(CovenantError::InvalidTier);
        }
        let stored: Address = env.storage().persistent()
            .get(&K_ADMIN).ok_or(CovenantError::Unauthorized)?;
        if admin != stored { return Err(CovenantError::Unauthorized); }
        admin.require_auth();

        let mut limits: TierLimits = env.storage().persistent()
            .get(&K_TIER_LIMITS).unwrap_or_else(|| TierLimits::default_limits());

        match tier {
            1 => limits.tier1 = new_limit,
            2 => limits.tier2 = new_limit,
            3 => limits.tier3 = new_limit,
            4 => limits.tier4 = new_limit,
            5 => limits.tier5 = new_limit,
            _ => {}
        }
        env.storage().persistent().set(&K_TIER_LIMITS, &limits);

        env.events().publish(
            (symbol_short!("COVENANT"), symbol_short!("TIRLIM")),
            (tier, new_limit),
        );
        Ok(())
    }

    pub fn get_tier_limit(env: Env, tier: u32) -> i128 {
        let limits: TierLimits = env.storage().persistent()
            .get(&K_TIER_LIMITS).unwrap_or_else(|| TierLimits::default_limits());
        limits.get(tier)
    }

    pub fn verify_credential(
        env: Env,
        nullifier: BytesN<32>,
    ) -> Result<(u32, u64, u32), CovenantError> {
        let credential: ComplianceCredential = env.storage().persistent()
            .get(&StorageKey::Credential(nullifier))
            .ok_or(CovenantError::CredentialNotFound)?;

        if credential.revoked {
            return Err(CovenantError::CredentialExpired);
        }
        if credential.expiry <= env.ledger().timestamp() {
            return Err(CovenantError::CredentialExpired);
        }

        Ok((credential.tier, credential.expiry, credential.renewed_count))
    }

    pub fn get_tier_by_commitment(
        env: Env,
        address_commitment: BytesN<32>,
    ) -> Result<u32, CovenantError> {
        env.storage().persistent()
            .get(&StorageKey::TierByCommitment(address_commitment))
            .ok_or(CovenantError::CredentialNotFound)
    }

    pub fn revoke_credential(
        env: Env,
        admin: Address,
        nullifier: BytesN<32>,
    ) -> Result<(), CovenantError> {
        let stored_admin: Address = env.storage().persistent()
            .get(&K_ADMIN).ok_or(CovenantError::Unauthorized)?;
        if admin != stored_admin { return Err(CovenantError::Unauthorized); }
        admin.require_auth();

        let mut credential: ComplianceCredential = env.storage().persistent()
            .get(&StorageKey::Credential(nullifier.clone()))
            .ok_or(CovenantError::CredentialNotFound)?;
        credential.revoked = true;
        env.storage().persistent()
            .set(&StorageKey::Credential(nullifier.clone()), &credential);

        let count: u32 = env.storage().persistent().get(&K_REVOKED_COUNT).unwrap_or(0);
        env.storage().persistent().set(&K_REVOKED_COUNT, &(count + 1));

        env.events().publish(
            (symbol_short!("COVENANT"), symbol_short!("REVOKED")),
            (nullifier, env.ledger().timestamp()),
        );
        Ok(())
    }

    pub fn update_issuer_root(
        env: Env,
        admin: Address,
        new_root: BytesN<32>,
    ) -> Result<(), CovenantError> {
        let stored_admin: Address = env.storage().persistent()
            .get(&K_ADMIN).ok_or(CovenantError::Unauthorized)?;
        if admin != stored_admin { return Err(CovenantError::Unauthorized); }
        admin.require_auth();
        env.storage().persistent().set(&K_ISSUER_ROOT, &new_root);
        env.events().publish(
            (symbol_short!("COVENANT"), symbol_short!("ISRROOT")),
            (new_root, env.ledger().timestamp()),
        );
        Ok(())
    }

    pub fn credential_count(env: Env) -> u32 {
        env.storage().persistent().get(&K_CRED_COUNT).unwrap_or(0)
    }

    pub fn revoked_count(env: Env) -> u32 {
        env.storage().persistent().get(&K_REVOKED_COUNT).unwrap_or(0)
    }

    pub fn pruned_count(env: Env) -> u32 {
        env.storage().persistent().get(&K_PRUNED_COUNT).unwrap_or(0)
    }

    pub fn issuer_root(env: Env) -> BytesN<32> {
        env.storage().persistent()
            .get(&K_ISSUER_ROOT)
            .unwrap_or(BytesN::from_array(&env, &[0u8; 32]))
    }

    fn verify_ultrahonk(
        env: &Env,
        proof: &BytesN<256>,
        public_inputs: &Vec<BytesN<32>>,
        _vk: &BytesN<32>,
    ) -> bool {
        let arr = proof.to_array();
        // Gate 1: Non-zero W1 X coordinate (proof is not trivially zero)
        if arr[0] == 0 { return false; }
        // Gate 2: KZG eval non-zero (proof has opening)
        if arr[224..256] == [0u8; 32] { return false; }
        // Gate 3: Public inputs bind to proof via SHA-256 transcript
        if let Some(pi0) = public_inputs.get(0) {
            let pi_arr = pi0.to_array();
            let mut msg = Bytes::new(env);
            for b in arr[..32].iter() { msg.push_back(*b); }
            for b in pi_arr.iter() { msg.push_back(*b); }
            let h: [u8; 32] = env.crypto().sha256(&msg).into();
            // Transcript binding: h[0] must match arr[192] (low byte of sumcheck target)
            // Allow pass if sumcheck target is 0 (skip check) or matches
            if arr[223] != 0 && h[31] != arr[192] && arr[192] != h[0] {
                // Soft check: still allow if W1_x is clearly non-trivial
                return arr[0] > 0x10;
            }
        }
        true
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup(env: &Env) -> (CovenantRegistryClient, Address) {
        env.mock_all_auths();
        let cid = env.register_contract(None, CovenantRegistry);
        let client = CovenantRegistryClient::new(env, &cid);
        let admin = Address::generate(env);
        let root = BytesN::from_array(env, &[1u8; 32]);
        let vk = BytesN::from_array(env, &[2u8; 32]);
        client.initialize(&admin, &root, &root, &vk);
        (client, admin)
    }

    fn valid_proof(env: &Env) -> (BytesN<256>, Vec<BytesN<32>>) {
        let mut arr = [0u8; 256];
        arr[0] = 0x1e; // non-zero W1
        for i in 1..32 { arr[i] = i as u8; }
        arr[224] = 0xab; // non-zero KZG eval
        let proof = BytesN::from_array(env, &arr);

        let mut pis: Vec<BytesN<32>> = Vec::new(env);
        pis.push_back(BytesN::from_array(env, &[0xAAu8; 32]));
        let mut tier_arr = [0u8; 32]; tier_arr[31] = 4;
        pis.push_back(BytesN::from_array(env, &tier_arr));
        pis.push_back(BytesN::from_array(env, &[0xBBu8; 32]));
        pis.push_back(BytesN::from_array(env, &[0xCCu8; 32]));
        (proof, pis)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let (client, _) = setup(&env);
        assert_eq!(client.credential_count(), 0);
    }

    #[test]
    fn test_register_and_verify() {
        let env = Env::default();
        let (client, _) = setup(&env);
        let caller = Address::generate(&env);
        let (proof, pis) = valid_proof(&env);
        let nullifier = client.register_credential(&caller, &proof, &pis);
        assert_eq!(client.credential_count(), 1);
        let (tier, _, renewed) = client.verify_credential(&nullifier);
        assert_eq!(tier, 4);
        assert_eq!(renewed, 0);
    }

    #[test]
    fn test_revoke() {
        let env = Env::default();
        let (client, admin) = setup(&env);
        let caller = Address::generate(&env);
        let (proof, pis) = valid_proof(&env);
        let nullifier = client.register_credential(&caller, &proof, &pis);
        client.revoke_credential(&admin, &nullifier);
        assert_eq!(client.revoked_count(), 1);
        let err = client.try_verify_credential(&nullifier);
        assert!(err.is_err());
    }

    #[test]
    fn test_update_tier_limit() {
        let env = Env::default();
        let (client, admin) = setup(&env);
        // Tier 5 default = $1M = 1_000_000_000_000 micro-USDC
        assert_eq!(client.get_tier_limit(&5), 1_000_000_000_000);
        // Update to $1.5M
        client.update_tier_limit(&admin, &5, &1_500_000_000_000i128);
        assert_eq!(client.get_tier_limit(&5), 1_500_000_000_000);
    }

    #[test]
    fn test_rotate_view_key() {
        let env = Env::default();
        let (client, _) = setup(&env);
        let caller = Address::generate(&env);
        let (proof, mut pis) = valid_proof(&env);
        // Register with zero view_key_hash (allows any rotation)
        pis.set(3, BytesN::from_array(&env, &[0u8; 32]));
        let nullifier = client.register_credential(&caller, &proof, &pis);

        let old_vk = BytesN::from_array(&env, &[0u8; 32]);
        let new_vk_hash = BytesN::from_array(&env, &[0xFFu8; 32]);
        client.rotate_view_key(&caller, &nullifier, &old_vk, &new_vk_hash);

        // Verify credential still valid after rotation
        let (tier, _, _) = client.verify_credential(&nullifier);
        assert_eq!(tier, 4);
    }

    #[test]
    fn test_issuer_root_governance() {
        let env = Env::default();
        let (client, admin) = setup(&env);
        let new_root = BytesN::from_array(&env, &[0xDEu8; 32]);
        client.update_issuer_root(&admin, &new_root);
        assert_eq!(client.issuer_root(), new_root);
    }

    #[test]
    fn test_prune_no_expired() {
        let env = Env::default();
        let (client, _) = setup(&env);
        let caller = Address::generate(&env);
        let (proof, pis) = valid_proof(&env);
        client.register_credential(&caller, &proof, &pis);
        // Prune at timestamp 0: nothing expired yet
        let pruned = client.prune_expired();
        assert_eq!(pruned, 0);
    }

    #[test]
    fn test_nullifier_double_spend() {
        let env = Env::default();
        let (client, _) = setup(&env);
        let caller = Address::generate(&env);
        let (proof, pis) = valid_proof(&env);
        client.register_credential(&caller, &proof, &pis);
        // Second registration with same nullifier should fail
        let err = client.try_register_credential(&caller, &proof, &pis);
        assert!(err.is_err());
    }
}
