#![no_std]
extern crate alloc;

use alloc::format;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    symbol_short, Address, BytesN, Env, Map, Symbol,
};

const ADMIN: Symbol = symbol_short!("ADMIN");
const ISSUER_ROOT: Symbol = symbol_short!("IROOT");
const NULLIFIERS: Symbol = symbol_short!("NULLS");
const CRED_COUNT: Symbol = symbol_short!("CCOUNT");
const VK: Symbol = symbol_short!("VK");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComplianceCredential {
    pub nullifier: BytesN<32>,
    pub tier: u32,
    pub expiry: u64,
    pub address_commitment: BytesN<32>,
    pub view_key_hash: BytesN<32>,
    pub registered_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    CredentialExpired = 4,
    NullifierReused = 5,
    CredentialNotFound = 6,
    InvalidProof = 7,
}

#[contract]
pub struct CovenantRegistry;

#[contractimpl]
impl CovenantRegistry {
    pub fn initialize(
        env: Env,
        admin: Address,
        issuer_root: BytesN<32>,
        verification_key: BytesN<32>,
    ) -> Result<(), RegistryError> {
        if env.storage().persistent().has(&ADMIN) {
            return Err(RegistryError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&ADMIN, &admin);
        env.storage().persistent().set(&ISSUER_ROOT, &issuer_root);
        env.storage().persistent().set(&VK, &verification_key);
        env.storage().persistent().set(&CRED_COUNT, &0u32);
        let nullifiers: Map<BytesN<32>, bool> = Map::new(&env);
        env.storage().persistent().set(&NULLIFIERS, &nullifiers);
        env.events()
            .publish((symbol_short!("init"), admin.clone()), issuer_root);
        Ok(())
    }

    pub fn register_credential(
        env: Env,
        caller: Address,
        nullifier: BytesN<32>,
        tier: u32,
        expiry: u64,
        address_commitment: BytesN<32>,
        view_key_hash: BytesN<32>,
    ) -> Result<u32, RegistryError> {
        caller.require_auth();
        if !env.storage().persistent().has(&ADMIN) {
            return Err(RegistryError::NotInitialized);
        }
        let nullifiers: Map<BytesN<32>, bool> =
            env.storage().persistent().get(&NULLIFIERS).unwrap();
        if nullifiers.get(nullifier.clone()).unwrap_or(false) {
            return Err(RegistryError::NullifierReused);
        }
        let current_time = env.ledger().timestamp();
        if expiry <= current_time {
            return Err(RegistryError::CredentialExpired);
        }
        if tier < 1 || tier > 5 {
            return Err(RegistryError::InvalidProof);
        }
        let credential = ComplianceCredential {
            nullifier: nullifier.clone(),
            tier,
            expiry,
            address_commitment,
            view_key_hash,
            registered_at: current_time,
        };
        let count: u32 = env.storage().persistent().get(&CRED_COUNT).unwrap();
        let cred_key = Symbol::new(&env, &format!("cred_{}", count));
        env.storage().persistent().set(&cred_key, &credential);
        env.storage().persistent().set(&CRED_COUNT, &(count + 1));
        let mut updated = nullifiers;
        updated.set(nullifier.clone(), true);
        env.storage().persistent().set(&NULLIFIERS, &updated);
        env.events()
            .publish((symbol_short!("reg"), caller), (nullifier, tier, count));
        Ok(count)
    }

    pub fn verify_credential(
        env: Env,
        nullifier: BytesN<32>,
    ) -> Result<(u32, u64, BytesN<32>), RegistryError> {
        if !env.storage().persistent().has(&ADMIN) {
            return Err(RegistryError::NotInitialized);
        }
        let count: u32 = env.storage().persistent().get(&CRED_COUNT).unwrap();
        for i in 0..count {
            let cred_key = Symbol::new(&env, &format!("cred_{}", i));
            let c: ComplianceCredential =
                env.storage().persistent().get(&cred_key).unwrap();
            if c.nullifier == nullifier {
                if c.expiry <= env.ledger().timestamp() {
                    return Err(RegistryError::CredentialExpired);
                }
                return Ok((c.tier, c.expiry, c.address_commitment));
            }
        }
        Err(RegistryError::CredentialNotFound)
    }

    pub fn revoke_credential(
        env: Env,
        admin: Address,
        nullifier: BytesN<32>,
    ) -> Result<(), RegistryError> {
        admin.require_auth();
        let stored: Address = env.storage().persistent().get(&ADMIN).unwrap();
        if admin != stored {
            return Err(RegistryError::Unauthorized);
        }
        let count: u32 = env.storage().persistent().get(&CRED_COUNT).unwrap();
        let mut found = false;
        for i in 0..count {
            let k = Symbol::new(&env, &format!("cred_{}", i));
            let mut c: ComplianceCredential =
                env.storage().persistent().get(&k).unwrap();
            if c.nullifier == nullifier {
                c.expiry = 0;
                env.storage().persistent().set(&k, &c);
                found = true;
                break;
            }
        }
        if !found {
            return Err(RegistryError::CredentialNotFound);
        }
        env.events()
            .publish((symbol_short!("revoke"), admin), nullifier);
        Ok(())
    }

    pub fn get_credential(
        env: Env,
        cred_id: u32,
    ) -> Result<ComplianceCredential, RegistryError> {
        let count: u32 = env
            .storage()
            .persistent()
            .get(&CRED_COUNT)
            .unwrap_or(0);
        if cred_id >= count {
            return Err(RegistryError::CredentialNotFound);
        }
        let k = Symbol::new(&env, &format!("cred_{}", cred_id));
        Ok(env.storage().persistent().get(&k).unwrap())
    }

    pub fn credential_count(env: Env) -> u32 {
        env.storage().persistent().get(&CRED_COUNT).unwrap_or(0)
    }

    pub fn get_issuer_root(env: Env) -> Result<BytesN<32>, RegistryError> {
        if !env.storage().persistent().has(&ISSUER_ROOT) {
            return Err(RegistryError::NotInitialized);
        }
        Ok(env.storage().persistent().get(&ISSUER_ROOT).unwrap())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup() -> (soroban_sdk::Env, CovenantRegistryClient<'static>) {
        let env = Env::default();
        let id = env.register(CovenantRegistry, ());
        let client = CovenantRegistryClient::new(&env, &id);
        // SAFETY: lifetime is tied to env which lives for the test
        let client: CovenantRegistryClient<'static> =
            unsafe { core::mem::transmute(client) };
        (env, client)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CovenantRegistry, ());
        let c = CovenantRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        let root = BytesN::from_array(&env, &[0u8; 32]);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        c.initialize(&admin, &root, &vk);
        assert_eq!(c.credential_count(), 0);
    }

    #[test]
    fn test_register_and_verify() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CovenantRegistry, ());
        let c = CovenantRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        c.initialize(
            &admin,
            &BytesN::from_array(&env, &[0u8; 32]),
            &BytesN::from_array(&env, &[1u8; 32]),
        );
        env.ledger().set_timestamp(1000);
        let caller = Address::generate(&env);
        let nullifier = BytesN::from_array(&env, &[2u8; 32]);
        let addr = BytesN::from_array(&env, &[3u8; 32]);
        let vkh = BytesN::from_array(&env, &[4u8; 32]);
        let cred_id = c.register_credential(&caller, &nullifier, &4u32, &999999u64, &addr, &vkh);
        assert_eq!(cred_id, Ok(0));
        assert_eq!(c.credential_count(), 1);
        let res = c.verify_credential(&nullifier);
        assert!(res.is_ok());
        let (tier, expiry, _) = res.unwrap();
        assert_eq!(tier, 4);
        assert_eq!(expiry, 999999);
    }

    #[test]
    fn test_nullifier_reuse_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CovenantRegistry, ());
        let c = CovenantRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        c.initialize(
            &admin,
            &BytesN::from_array(&env, &[0u8; 32]),
            &BytesN::from_array(&env, &[1u8; 32]),
        );
        env.ledger().set_timestamp(1000);
        let caller = Address::generate(&env);
        let n = BytesN::from_array(&env, &[5u8; 32]);
        let a = BytesN::from_array(&env, &[6u8; 32]);
        let v = BytesN::from_array(&env, &[7u8; 32]);
        c.register_credential(&caller, &n, &3u32, &999999u64, &a, &v)
            .unwrap();
        let r2 = c.register_credential(&caller, &n, &3u32, &999999u64, &a, &v);
        assert_eq!(r2, Err(RegistryError::NullifierReused));
    }

    #[test]
    fn test_revoke_credential() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CovenantRegistry, ());
        let c = CovenantRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        c.initialize(
            &admin,
            &BytesN::from_array(&env, &[0u8; 32]),
            &BytesN::from_array(&env, &[1u8; 32]),
        );
        env.ledger().set_timestamp(1000);
        let caller = Address::generate(&env);
        let n = BytesN::from_array(&env, &[8u8; 32]);
        let a = BytesN::from_array(&env, &[9u8; 32]);
        let v = BytesN::from_array(&env, &[10u8; 32]);
        c.register_credential(&caller, &n, &5u32, &999999u64, &a, &v)
            .unwrap();
        c.revoke_credential(&admin, &n).unwrap();
        let res = c.verify_credential(&n);
        assert_eq!(res, Err(RegistryError::CredentialExpired));
    }

    #[test]
    fn test_invalid_tier_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CovenantRegistry, ());
        let c = CovenantRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        c.initialize(
            &admin,
            &BytesN::from_array(&env, &[0u8; 32]),
            &BytesN::from_array(&env, &[1u8; 32]),
        );
        env.ledger().set_timestamp(1000);
        let caller = Address::generate(&env);
        let n = BytesN::from_array(&env, &[20u8; 32]);
        let a = BytesN::from_array(&env, &[21u8; 32]);
        let v = BytesN::from_array(&env, &[22u8; 32]);
        // tier 0 is invalid
        let r = c.register_credential(&caller, &n, &0u32, &999999u64, &a, &v);
        assert_eq!(r, Err(RegistryError::InvalidProof));
        // tier 6 is invalid
        let r2 = c.register_credential(&caller, &n, &6u32, &999999u64, &a, &v);
        assert_eq!(r2, Err(RegistryError::InvalidProof));
    }
}
