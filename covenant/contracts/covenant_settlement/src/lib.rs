#![no_std]
extern crate alloc;

use alloc::format;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    symbol_short, Address, BytesN, Env, Symbol, token,
};

const ADMIN: Symbol = symbol_short!("ADMIN");
const REGISTRY: Symbol = symbol_short!("REG");
const SETTLEMENT_COUNT: Symbol = symbol_short!("SCOUNT");
const PAUSED: Symbol = symbol_short!("PAUSED");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SettlementStatus {
    Pending,
    Completed,
    Failed,
    Audited,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SettlementRecord {
    pub settlement_id: BytesN<32>,
    pub settlement_hash: BytesN<32>,
    pub compliance_tier: u32,
    pub asset: Address,
    pub amount: i128,
    pub sender_commitment: BytesN<32>,
    pub recipient: Address,
    pub timestamp: u64,
    pub encrypted_compliance_trail: BytesN<64>,
    pub status: SettlementStatus,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SettlementError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ContractPaused = 4,
    InvalidAmount = 5,
    InvalidTier = 6,
    SettlementNotFound = 7,
    TransferFailed = 8,
    InvalidViewKey = 9,
    AlreadyAudited = 10,
}

#[contract]
pub struct CovenantSettlement;

#[contractimpl]
impl CovenantSettlement {
    pub fn initialize(
        env: Env,
        admin: Address,
        registry_address: Address,
    ) -> Result<(), SettlementError> {
        if env.storage().persistent().has(&ADMIN) {
            return Err(SettlementError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&ADMIN, &admin);
        env.storage().persistent().set(&REGISTRY, &registry_address);
        env.storage().persistent().set(&SETTLEMENT_COUNT, &0u32);
        env.storage().persistent().set(&PAUSED, &false);
        env.events()
            .publish((symbol_short!("init"), admin.clone()), registry_address);
        Ok(())
    }

    pub fn initiate_settlement(
        env: Env,
        sender: Address,
        settlement_hash: BytesN<32>,
        compliance_tier: u32,
        asset: Address,
        amount: i128,
        sender_commitment: BytesN<32>,
        recipient: Address,
        encrypted_compliance_trail: BytesN<64>,
    ) -> Result<u32, SettlementError> {
        let paused: bool = env
            .storage()
            .persistent()
            .get(&PAUSED)
            .unwrap_or(false);
        if paused {
            return Err(SettlementError::ContractPaused);
        }
        sender.require_auth();
        if amount <= 0 {
            return Err(SettlementError::InvalidAmount);
        }
        if compliance_tier < 1 || compliance_tier > 5 {
            return Err(SettlementError::InvalidTier);
        }
        let max = Self::tier_limit(compliance_tier);
        if amount > max {
            return Err(SettlementError::InvalidAmount);
        }
        let tk = token::Client::new(&env, &asset);
        tk.transfer(&sender, &recipient, &amount);

        let count: u32 = env
            .storage()
            .persistent()
            .get(&SETTLEMENT_COUNT)
            .unwrap();
        let sid = Self::make_sid(&env, count);
        let rec = SettlementRecord {
            settlement_id: sid.clone(),
            settlement_hash,
            compliance_tier,
            asset: asset.clone(),
            amount,
            sender_commitment,
            recipient: recipient.clone(),
            timestamp: env.ledger().timestamp(),
            encrypted_compliance_trail,
            status: SettlementStatus::Completed,
        };
        let k = Symbol::new(&env, &format!("settle_{}", count));
        env.storage().persistent().set(&k, &rec);
        env.storage()
            .persistent()
            .set(&SETTLEMENT_COUNT, &(count + 1));
        env.events().publish(
            (symbol_short!("settle"), sender),
            (sid, asset, amount, compliance_tier),
        );
        Ok(count)
    }

    pub fn get_settlement(
        env: Env,
        settlement_id: u32,
    ) -> Result<SettlementRecord, SettlementError> {
        let count: u32 = env
            .storage()
            .persistent()
            .get(&SETTLEMENT_COUNT)
            .unwrap_or(0);
        if settlement_id >= count {
            return Err(SettlementError::SettlementNotFound);
        }
        let k = Symbol::new(&env, &format!("settle_{}", settlement_id));
        Ok(env.storage().persistent().get(&k).unwrap())
    }

    pub fn settlement_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&SETTLEMENT_COUNT)
            .unwrap_or(0)
    }

    pub fn regulator_audit(
        env: Env,
        regulator: Address,
        settlement_id: u32,
        _view_key: BytesN<32>,
    ) -> Result<(u32, i128, u64, BytesN<64>), SettlementError> {
        regulator.require_auth();
        let rec = Self::get_settlement(env.clone(), settlement_id)?;
        let mut updated = rec.clone();
        updated.status = SettlementStatus::Audited;
        let k = Symbol::new(&env, &format!("settle_{}", settlement_id));
        env.storage().persistent().set(&k, &updated);
        env.events().publish(
            (symbol_short!("audit"), regulator),
            (settlement_id, rec.settlement_hash),
        );
        Ok((
            rec.compliance_tier,
            rec.amount,
            rec.timestamp,
            rec.encrypted_compliance_trail,
        ))
    }

    pub fn set_paused(
        env: Env,
        admin: Address,
        paused: bool,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let stored: Address = env.storage().persistent().get(&ADMIN).unwrap();
        if admin != stored {
            return Err(SettlementError::Unauthorized);
        }
        env.storage().persistent().set(&PAUSED, &paused);
        env.events()
            .publish((symbol_short!("pause"), admin), paused);
        Ok(())
    }

    pub fn tier_limit(tier: u32) -> i128 {
        match tier {
            5 => 1_000_000_000_000,
            4 => 800_000_000_000,
            3 => 600_000_000_000,
            2 => 400_000_000_000,
            1 => 200_000_000_000,
            _ => 0,
        }
    }

    fn make_sid(env: &Env, count: u32) -> BytesN<32> {
        let mut d = [0u8; 4];
        d.copy_from_slice(&count.to_be_bytes());
        BytesN::from_array(
            env,
            &env.crypto()
                .sha256(&soroban_sdk::Bytes::from_slice(env, &d))
                .to_array(),
        )
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
        let id = env.register(CovenantSettlement, ());
        let c = CovenantSettlementClient::new(&env, &id);
        let admin = Address::generate(&env);
        let reg = Address::generate(&env);
        c.initialize(&admin, &reg);
        assert_eq!(c.settlement_count(), 0);
    }

    #[test]
    fn test_double_initialize_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CovenantSettlement, ());
        let c = CovenantSettlementClient::new(&env, &id);
        let admin = Address::generate(&env);
        let reg = Address::generate(&env);
        c.initialize(&admin, &reg);
        let r2 = c.initialize(&admin, &reg);
        assert_eq!(r2, Err(SettlementError::AlreadyInitialized));
    }

    #[test]
    fn test_pause_unpause() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CovenantSettlement, ());
        let c = CovenantSettlementClient::new(&env, &id);
        let admin = Address::generate(&env);
        let reg = Address::generate(&env);
        c.initialize(&admin, &reg);
        assert!(c.set_paused(&admin, &true).is_ok());
        assert!(c.set_paused(&admin, &false).is_ok());
    }

    #[test]
    fn test_tier_limits() {
        assert_eq!(CovenantSettlement::tier_limit(5), 1_000_000_000_000);
        assert_eq!(CovenantSettlement::tier_limit(4), 800_000_000_000);
        assert_eq!(CovenantSettlement::tier_limit(3), 600_000_000_000);
        assert_eq!(CovenantSettlement::tier_limit(2), 400_000_000_000);
        assert_eq!(CovenantSettlement::tier_limit(1), 200_000_000_000);
        assert_eq!(CovenantSettlement::tier_limit(0), 0);
    }
}
