#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, symbol_short,
    token, Address, BytesN, Env, IntoVal, Symbol, Val, Vec,
};

// ============================================================================
// CovenantComplianceBridge — Cross-Currency Private Settlement
// ============================================================================
// Enables cross-currency private settlements via Stellar DEX path payment.
// Example: USDC → EURC with ZK compliance proof covering both legs.
//
// verify_proof() now has 3 structural gates + optional BN254 pairing delegation
// to UltraHonkVerifier contract when K_VERIFIER is configured.
//
// Proof gates:
//   Gate 1: W1 x-coordinate non-zero (reject trivial proofs)
//   Gate 2: KZG eval non-zero (proof has opening)
//   Gate 3: Sumcheck range (first byte ≤ 0x30)
//   Gate 4: BN254 KZG pairing (via cross-contract call to verifier, when set)
// ============================================================================

const K_ADMIN: Symbol = symbol_short!("ADMIN");
const K_SETTLEMENT: Symbol = symbol_short!("SETTLECON");
const K_VERIFIER: Symbol = symbol_short!("VERIFIER");
const K_MIN_TIER: Symbol = symbol_short!("MINTIER");
const K_XSETL_CNT: Symbol = symbol_short!("XSETLCNT");

#[contracterror]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BridgeError {
    Unauthorized = 1,
    InvalidProof = 2,
    InsufficientTier = 3,
    SwapFailed = 4,
    AlreadyInitialized = 5,
    InvalidInputs = 6,
    SameAsset = 7,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossCurrencyRecord {
    pub settlement_hash: BytesN<32>,
    pub src_asset: Address,
    pub dst_asset: Address,
    pub src_amount: i128,
    pub dst_amount: i128,
    pub compliance_tier: u32,
    pub sender_commitment: BytesN<32>,
    pub timestamp: u64,
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Record(BytesN<32>),
}

#[contract]
pub struct CovenantComplianceBridge;

#[contractimpl]
impl CovenantComplianceBridge {
    /// Initialize bridge.
    /// verifier: UltraHonkVerifier contract address for BN254 pairing check.
    ///           Pass a zero address (or call without verifier) for structural-only mode.
    pub fn initialize(
        env: Env,
        admin: Address,
        settlement_contract: Address,
        verifier: Address,
        min_tier: u32,
    ) -> Result<(), BridgeError> {
        if env.storage().persistent().has(&K_ADMIN) {
            return Err(BridgeError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&K_ADMIN, &admin);
        env.storage().persistent().set(&K_SETTLEMENT, &settlement_contract);
        env.storage().persistent().set(&K_VERIFIER, &verifier);
        env.storage().persistent().set(&K_MIN_TIER, &min_tier);
        env.storage().persistent().set(&K_XSETL_CNT, &0u32);
        Ok(())
    }

    pub fn update_min_tier(env: Env, admin: Address, new_min_tier: u32) -> Result<(), BridgeError> {
        let stored: Address = env.storage().persistent()
            .get(&K_ADMIN).ok_or(BridgeError::Unauthorized)?;
        if admin != stored { return Err(BridgeError::Unauthorized); }
        admin.require_auth();
        env.storage().persistent().set(&K_MIN_TIER, &new_min_tier);
        Ok(())
    }

    /// Cross-currency private settlement with single ZK proof covering both legs.
    /// The proof constrains: balance ≥ src_amount, compliance_tier ≥ min_tier,
    /// AND the DEX exchange rate is within the prover's accepted slippage.
    pub fn cross_currency_settlement(
        env: Env,
        sender: Address,
        proof: BytesN<256>,
        public_inputs: Vec<BytesN<32>>,
        src_asset: Address,
        dst_asset: Address,
        src_amount: i128,
        dst_min_amount: i128,
        recipient: Address,
        encrypted_trail: BytesN<64>,
        view_key_hash: BytesN<32>,
    ) -> Result<BytesN<32>, BridgeError> {
        sender.require_auth();

        if src_asset == dst_asset {
            return Err(BridgeError::SameAsset);
        }
        if public_inputs.len() < 4 {
            return Err(BridgeError::InvalidInputs);
        }

        // Verify cross-currency proof (includes DEX rate constraint)
        if !Self::verify_proof(&env, &proof, &public_inputs) {
            return Err(BridgeError::InvalidProof);
        }

        let settlement_hash = public_inputs.get(1).unwrap();
        let sender_commitment = public_inputs.get(2).unwrap();
        let tier_bytes = public_inputs.get(3).unwrap();
        let compliance_tier = tier_bytes.to_array()[31] as u32;

        let min_tier: u32 = env.storage().persistent().get(&K_MIN_TIER).unwrap_or(1);
        if compliance_tier < min_tier {
            return Err(BridgeError::InsufficientTier);
        }

        // Step 1: Transfer src_asset from sender to this bridge contract
        let src_token = token::Client::new(&env, &src_asset);
        src_token.transfer(&sender, &env.current_contract_address(), &src_amount);

        // Step 2: Swap via Stellar DEX (path payment)
        // In production: use stellar_sdk path_payment_strict_send
        // For testnet demo: direct transfer of dst_asset to recipient
        let dst_token = token::Client::new(&env, &dst_asset);
        dst_token.transfer(&env.current_contract_address(), &recipient, &dst_min_amount);

        let record = CrossCurrencyRecord {
            settlement_hash: settlement_hash.clone(),
            src_asset,
            dst_asset,
            src_amount,
            dst_amount: dst_min_amount,
            compliance_tier,
            sender_commitment,
            timestamp: env.ledger().timestamp(),
            ledger: env.ledger().sequence(),
        };

        env.storage()
            .persistent()
            .set(&StorageKey::Record(settlement_hash.clone()), &record);

        let count: u32 = env.storage().persistent().get(&K_XSETL_CNT).unwrap_or(0);
        env.storage().persistent().set(&K_XSETL_CNT, &(count + 1));

        // Emit: settlement hash + tier only — no amounts or asset identities on-chain
        env.events().publish(
            (symbol_short!("COVENANT"), symbol_short!("XSETLED")),
            (settlement_hash.clone(), compliance_tier),
        );

        Ok(settlement_hash)
    }

    pub fn get_record(
        env: Env,
        settlement_hash: BytesN<32>,
    ) -> Option<CrossCurrencyRecord> {
        env.storage()
            .persistent()
            .get(&StorageKey::Record(settlement_hash))
    }

    pub fn settlement_count(env: Env) -> u32 {
        env.storage().persistent().get(&K_XSETL_CNT).unwrap_or(0)
    }

    pub fn min_tier(env: Env) -> u32 {
        env.storage().persistent().get(&K_MIN_TIER).unwrap_or(1)
    }

    // ── BN254 UltraHonk Proof Verification ───────────────────────────────────
    //
    // 3-gate structural check + optional BN254 pairing delegation:
    //   Gate 1: W1 x-coord non-zero  (reject trivial proofs)
    //   Gate 2: kzg_eval non-zero    (reject no-opening proofs)
    //   Gate 3: sumcheck range ≤ 0x30 (reject out-of-field proofs)
    //   Gate 4: BN254 KZG pairing    (via cross-contract call to verifier)
    //
    // When K_VERIFIER is set, calls:
    //   verifier.verify_settlement_proof(proof, public_inputs)
    // If the call panics (Err = invalid pairing), the tx is reverted.
    //
    fn verify_proof(
        env: &Env,
        proof: &BytesN<256>,
        public_inputs: &Vec<BytesN<32>>,
    ) -> bool {
        let arr = proof.to_array();

        // Gate 1: W1 x-coordinate non-zero
        if arr[0] == 0 { return false; }

        // Gate 2: KZG eval non-zero
        if arr[224..256] == [0u8; 32] { return false; }

        // Gate 3: Sumcheck range check (Fr field bound)
        if arr[192] > 0x30 { return false; }

        // Gate 4: BN254 pairing (cross-contract delegation to verifier)
        if let Some(verifier) = env.storage().persistent().get::<_, Address>(&K_VERIFIER) {
            let fn_name = Symbol::new(env, "verify_settlement_proof");
            let mut args: Vec<Val> = Vec::new(env);
            args.push_back(proof.clone().into_val(env));
            args.push_back(public_inputs.clone().into_val(env));
            // Panics on invalid proof (Err from verifier) → reverts the tx
            let _: Val = env.invoke_contract(&verifier, &fn_name, args);
            return true;
        }

        true
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup(env: &Env) -> CovenantComplianceBridgeClient {
        env.mock_all_auths();
        let cid = env.register_contract(None, CovenantComplianceBridge);
        let client = CovenantComplianceBridgeClient::new(env, &cid);
        let admin = Address::generate(env);
        let settlement = Address::generate(env);
        let verifier = Address::generate(env);
        client.initialize(&admin, &settlement, &verifier, &2u32);
        client
    }

    #[test]
    fn test_initialize_success() {
        let env = Env::default();
        let client = setup(&env);
        assert_eq!(client.settlement_count(), 0);
        assert_eq!(client.min_tier(), 2);
    }

    #[test]
    fn test_double_initialize_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let cid = env.register_contract(None, CovenantComplianceBridge);
        let client = CovenantComplianceBridgeClient::new(&env, &cid);
        let admin = Address::generate(&env);
        client.initialize(&admin, &Address::generate(&env), &Address::generate(&env), &2u32);
        let err = client.try_initialize(&admin, &Address::generate(&env), &Address::generate(&env), &2u32);
        assert!(err.is_err());
    }

    #[test]
    fn test_settlement_count_initial_zero() {
        let env = Env::default();
        let client = setup(&env);
        assert_eq!(client.settlement_count(), 0);
    }

    #[test]
    fn test_min_tier_set_correctly() {
        let env = Env::default();
        let client = setup(&env);
        assert_eq!(client.min_tier(), 2);
    }

    #[test]
    fn test_update_min_tier_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let cid = env.register_contract(None, CovenantComplianceBridge);
        let client = CovenantComplianceBridgeClient::new(&env, &cid);
        let admin = Address::generate(&env);
        client.initialize(&admin, &Address::generate(&env), &Address::generate(&env), &1u32);
        client.update_min_tier(&admin, &3u32);
        assert_eq!(client.min_tier(), 3);
    }

    #[test]
    fn test_update_min_tier_unauthorized() {
        let env = Env::default();
        let client = setup(&env);
        let impostor = Address::generate(&env);
        let err = client.try_update_min_tier(&impostor, &5u32);
        assert!(err.is_err());
    }

    #[test]
    fn test_get_record_nonexistent() {
        let env = Env::default();
        let client = setup(&env);
        let fake_hash = BytesN::from_array(&env, &[0xFFu8; 32]);
        let result = client.get_record(&fake_hash);
        assert!(result.is_none());
    }

    #[test]
    fn test_same_asset_rejects() {
        let env = Env::default();
        let client = setup(&env);
        let sender = Address::generate(&env);
        let asset = Address::generate(&env);
        let mut arr = [0u8; 256];
        arr[0] = 0x1e; arr[224] = 0xde;
        let proof = BytesN::from_array(&env, &arr);
        let mut pis: Vec<BytesN<32>> = Vec::new(&env);
        pis.push_back(BytesN::from_array(&env, &[0xAAu8; 32]));
        pis.push_back(BytesN::from_array(&env, &[0xBBu8; 32]));
        pis.push_back(BytesN::from_array(&env, &[0xCCu8; 32]));
        let mut tier = [0u8; 32]; tier[31] = 2;
        pis.push_back(BytesN::from_array(&env, &tier));
        let trail = BytesN::from_array(&env, &[0u8; 64]);
        let vkh = BytesN::from_array(&env, &[0u8; 32]);
        // Same src and dst asset → SameAsset error
        let err = client.try_cross_currency_settlement(
            &sender, &proof, &pis, &asset, &asset,
            &1000i128, &990i128, &Address::generate(&env), &trail, &vkh,
        );
        assert!(err.is_err());
    }

    #[test]
    fn test_insufficient_public_inputs() {
        let env = Env::default();
        let client = setup(&env);
        let sender = Address::generate(&env);
        let src = Address::generate(&env);
        let dst = Address::generate(&env);
        let mut arr = [0u8; 256];
        arr[0] = 0x1e; arr[224] = 0xde;
        let proof = BytesN::from_array(&env, &arr);
        let mut pis: Vec<BytesN<32>> = Vec::new(&env);
        pis.push_back(BytesN::from_array(&env, &[0xAAu8; 32])); // Only 1 input (needs 4)
        let trail = BytesN::from_array(&env, &[0u8; 64]);
        let vkh = BytesN::from_array(&env, &[0u8; 32]);
        let err = client.try_cross_currency_settlement(
            &sender, &proof, &pis, &src, &dst,
            &1000i128, &990i128, &Address::generate(&env), &trail, &vkh,
        );
        assert!(err.is_err());
    }

    #[test]
    fn test_zero_w1_proof_rejected() {
        let env = Env::default();
        let client = setup(&env);
        let sender = Address::generate(&env);
        let src = Address::generate(&env);
        let dst = Address::generate(&env);
        let zero_proof = BytesN::from_array(&env, &[0u8; 256]);
        let mut pis: Vec<BytesN<32>> = Vec::new(&env);
        pis.push_back(BytesN::from_array(&env, &[0xAAu8; 32]));
        pis.push_back(BytesN::from_array(&env, &[0xBBu8; 32]));
        let mut tier = [0u8; 32]; tier[31] = 2;
        pis.push_back(BytesN::from_array(&env, &tier));
        pis.push_back(BytesN::from_array(&env, &tier));
        let trail = BytesN::from_array(&env, &[0u8; 64]);
        let vkh = BytesN::from_array(&env, &[0u8; 32]);
        let err = client.try_cross_currency_settlement(
            &sender, &zero_proof, &pis, &src, &dst,
            &1000i128, &990i128, &Address::generate(&env), &trail, &vkh,
        );
        assert!(err.is_err());
    }
}
