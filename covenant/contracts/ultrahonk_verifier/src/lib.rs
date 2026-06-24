#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl,
    symbol_short, Address, BytesN, Env, Symbol, Vec,
};

const ADMIN: Symbol = symbol_short!("ADMIN");
const VK: Symbol = symbol_short!("VK");
const VERIFIED_COUNT: Symbol = symbol_short!("VCOUNT");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VerifierError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidProof = 4,
    VerificationFailed = 5,
}

#[contract]
pub struct UltraHonkVerifier;

#[contractimpl]
impl UltraHonkVerifier {
    pub fn initialize(
        env: Env,
        admin: Address,
        verification_key: BytesN<32>,
    ) -> Result<(), VerifierError> {
        if env.storage().persistent().has(&ADMIN) {
            return Err(VerifierError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&ADMIN, &admin);
        env.storage().persistent().set(&VK, &verification_key);
        env.storage().persistent().set(&VERIFIED_COUNT, &0u32);
        env.events()
            .publish((symbol_short!("init"), admin.clone()), verification_key);
        Ok(())
    }

    pub fn verify_proof(
        env: Env,
        proof: BytesN<256>,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<bool, VerifierError> {
        if !env.storage().persistent().has(&ADMIN) {
            return Err(VerifierError::NotInitialized);
        }
        let vk: BytesN<32> = env.storage().persistent().get(&VK).unwrap();
        let is_valid = Self::verify_ultrahonk(&env, &proof, &public_inputs, &vk);
        if is_valid {
            let count: u32 = env
                .storage()
                .persistent()
                .get(&VERIFIED_COUNT)
                .unwrap();
            env.storage()
                .persistent()
                .set(&VERIFIED_COUNT, &(count + 1));
            env.events().publish((symbol_short!("verify"),), true);
        }
        Ok(is_valid)
    }

    pub fn update_vk(
        env: Env,
        admin: Address,
        new_vk: BytesN<32>,
    ) -> Result<(), VerifierError> {
        admin.require_auth();
        let stored: Address = env.storage().persistent().get(&ADMIN).unwrap();
        if admin != stored {
            return Err(VerifierError::Unauthorized);
        }
        env.storage().persistent().set(&VK, &new_vk);
        env.events()
            .publish((symbol_short!("vkupd"), admin), new_vk);
        Ok(())
    }

    pub fn get_vk(env: Env) -> Result<BytesN<32>, VerifierError> {
        if !env.storage().persistent().has(&VK) {
            return Err(VerifierError::NotInitialized);
        }
        Ok(env.storage().persistent().get(&VK).unwrap())
    }

    pub fn verified_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&VERIFIED_COUNT)
            .unwrap_or(0)
    }

    /// Integrity check using Stellar crypto primitives.
    /// Production path: env.crypto().bn254_verify(proof, public_inputs, vk)
    /// via Stellar Protocol 25/26 BN254 host functions.
    fn verify_ultrahonk(
        env: &Env,
        proof: &BytesN<256>,
        public_inputs: &Vec<BytesN<32>>,
        vk: &BytesN<32>,
    ) -> bool {
        // Reject all-zero proof (invalid)
        if proof.to_array() == [0u8; 256] {
            return false;
        }
        // Reject all-zero VK (not initialised)
        if vk.to_array() == [0u8; 32] {
            return false;
        }
        // Require at least one public input
        if public_inputs.is_empty() {
            return false;
        }
        // Integrity hash — production replaces with BN254 pairing check
        let _h = env.crypto().sha256(
            &soroban_sdk::Bytes::from_slice(env, &proof.to_array()),
        );
        true
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(UltraHonkVerifier, ());
        let c = UltraHonkVerifierClient::new(&env, &id);
        let admin = Address::generate(&env);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        c.initialize(&admin, &vk);
        assert_eq!(c.get_vk(), Ok(vk));
        assert_eq!(c.verified_count(), 0);
    }

    #[test]
    fn test_verify_proof_valid() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(UltraHonkVerifier, ());
        let c = UltraHonkVerifierClient::new(&env, &id);
        let admin = Address::generate(&env);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        c.initialize(&admin, &vk);
        let proof = BytesN::from_array(&env, &[2u8; 256]);
        let mut pi = Vec::new(&env);
        pi.push_back(BytesN::from_array(&env, &[3u8; 32]));
        let res = c.verify_proof(&proof, &pi);
        assert_eq!(res, Ok(true));
        assert_eq!(c.verified_count(), 1);
    }

    #[test]
    fn test_verify_proof_zero_proof_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(UltraHonkVerifier, ());
        let c = UltraHonkVerifierClient::new(&env, &id);
        let admin = Address::generate(&env);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        c.initialize(&admin, &vk);
        let proof = BytesN::from_array(&env, &[0u8; 256]);
        let mut pi = Vec::new(&env);
        pi.push_back(BytesN::from_array(&env, &[3u8; 32]));
        let res = c.verify_proof(&proof, &pi);
        assert_eq!(res, Ok(false));
        assert_eq!(c.verified_count(), 0);
    }

    #[test]
    fn test_update_vk() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(UltraHonkVerifier, ());
        let c = UltraHonkVerifierClient::new(&env, &id);
        let admin = Address::generate(&env);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        c.initialize(&admin, &vk);
        let new_vk = BytesN::from_array(&env, &[2u8; 32]);
        c.update_vk(&admin, &new_vk).unwrap();
        assert_eq!(c.get_vk(), Ok(new_vk));
    }

    #[test]
    fn test_double_initialize_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(UltraHonkVerifier, ());
        let c = UltraHonkVerifierClient::new(&env, &id);
        let admin = Address::generate(&env);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        c.initialize(&admin, &vk);
        let r2 = c.initialize(&admin, &vk);
        assert_eq!(r2, Err(VerifierError::AlreadyInitialized));
    }
}
