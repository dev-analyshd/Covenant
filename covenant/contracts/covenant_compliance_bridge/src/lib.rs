#![no_std]
extern crate alloc;

use alloc::format;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    symbol_short, Address, BytesN, Env, Symbol, token,
};

const ADMIN: Symbol = symbol_short!("ADMIN");
const SETTLEMENT: Symbol = symbol_short!("SETTLE");
const PAUSED: Symbol = symbol_short!("PAUSED");
const BRIDGE_COUNT: Symbol = symbol_short!("BCOUNT");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BridgeStatus {
    Pending,
    Completed,
    Failed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossCurrencySettlement {
    pub settlement_id: BytesN<32>,
    pub src_asset: Address,
    pub dst_asset: Address,
    pub src_amount: i128,
    pub dst_amount: i128,
    pub compliance_tier: u32,
    pub sender_commitment: BytesN<32>,
    pub recipient: Address,
    pub timestamp: u64,
    pub status: BridgeStatus,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BridgeError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ContractPaused = 4,
    InvalidAmount = 5,
    InvalidTier = 6,
    SameAsset = 7,
    TransferFailed = 8,
    PathNotFound = 9,
    SettlementNotFound = 10,
}

#[contract]
pub struct CovenantComplianceBridge;

#[contractimpl]
impl CovenantComplianceBridge {
    pub fn initialize(
        env: Env,
        admin: Address,
        settlement_address: Address,
    ) -> Result<(), BridgeError> {
        if env.storage().persistent().has(&ADMIN) {
            return Err(BridgeError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&ADMIN, &admin);
        env.storage()
            .persistent()
            .set(&SETTLEMENT, &settlement_address);
        env.storage().persistent().set(&PAUSED, &false);
        env.storage().persistent().set(&BRIDGE_COUNT, &0u32);
        env.events()
            .publish((symbol_short!("init"), admin.clone()), settlement_address);
        Ok(())
    }

    pub fn cross_currency_settlement(
        env: Env,
        sender: Address,
        src_asset: Address,
        dst_asset: Address,
        src_amount: i128,
        min_dst_amount: i128,
        compliance_tier: u32,
        sender_commitment: BytesN<32>,
        recipient: Address,
    ) -> Result<BytesN<32>, BridgeError> {
        let paused: bool = env
            .storage()
            .persistent()
            .get(&PAUSED)
            .unwrap_or(false);
        if paused {
            return Err(BridgeError::ContractPaused);
        }
        sender.require_auth();
        if src_amount <= 0 || min_dst_amount <= 0 {
            return Err(BridgeError::InvalidAmount);
        }
        if compliance_tier < 1 || compliance_tier > 5 {
            return Err(BridgeError::InvalidTier);
        }
        if src_asset == dst_asset {
            return Err(BridgeError::SameAsset);
        }
        let max = Self::tier_limit(compliance_tier);
        if src_amount > max {
            return Err(BridgeError::InvalidAmount);
        }
        let src_tok = token::Client::new(&env, &src_asset);
        src_tok.transfer(&sender, &env.current_contract_address(), &src_amount);
        // 1:1 swap for hackathon; production uses Stellar DEX path payments
        let dst_amount = src_amount;
        let dst_tok = token::Client::new(&env, &dst_asset);
        dst_tok.transfer(
            &env.current_contract_address(),
            &recipient,
            &dst_amount,
        );
        let ts = env.ledger().timestamp();
        let count: u32 = env
            .storage()
            .persistent()
            .get(&BRIDGE_COUNT)
            .unwrap_or(0);
        let sid = Self::make_sid(&env, count, ts);
        let rec = CrossCurrencySettlement {
            settlement_id: sid.clone(),
            src_asset: src_asset.clone(),
            dst_asset: dst_asset.clone(),
            src_amount,
            dst_amount,
            compliance_tier,
            sender_commitment,
            recipient: recipient.clone(),
            timestamp: ts,
            status: BridgeStatus::Completed,
        };
        let k = Symbol::new(&env, &format!("bridge_{}", count));
        env.storage().persistent().set(&k, &rec);
        env.storage()
            .persistent()
            .set(&BRIDGE_COUNT, &(count + 1));
        env.events().publish(
            (symbol_short!("bridge"), sender),
            (sid.clone(), src_asset, dst_asset, src_amount, dst_amount),
        );
        Ok(sid)
    }

    pub fn get_settlement(
        env: Env,
        bridge_id: u32,
    ) -> Result<CrossCurrencySettlement, BridgeError> {
        let count: u32 = env
            .storage()
            .persistent()
            .get(&BRIDGE_COUNT)
            .unwrap_or(0);
        if bridge_id >= count {
            return Err(BridgeError::SettlementNotFound);
        }
        let k = Symbol::new(&env, &format!("bridge_{}", bridge_id));
        Ok(env.storage().persistent().get(&k).unwrap())
    }

    pub fn bridge_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&BRIDGE_COUNT)
            .unwrap_or(0)
    }

    pub fn set_paused(
        env: Env,
        admin: Address,
        paused: bool,
    ) -> Result<(), BridgeError> {
        admin.require_auth();
        let stored: Address = env.storage().persistent().get(&ADMIN).unwrap();
        if admin != stored {
            return Err(BridgeError::Unauthorized);
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

    fn make_sid(env: &Env, count: u32, ts: u64) -> BytesN<32> {
        let mut d = [0u8; 12];
        d[0..4].copy_from_slice(&count.to_be_bytes());
        d[4..12].copy_from_slice(&ts.to_be_bytes());
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
        let id = env.register(CovenantComplianceBridge, ());
        let c = CovenantComplianceBridgeClient::new(&env, &id);
        let admin = Address::generate(&env);
        let settle = Address::generate(&env);
        c.initialize(&admin, &settle);
        assert_eq!(c.bridge_count(), 0);
    }

    #[test]
    fn test_same_asset_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CovenantComplianceBridge, ());
        let c = CovenantComplianceBridgeClient::new(&env, &id);
        let admin = Address::generate(&env);
        let settle = Address::generate(&env);
        c.initialize(&admin, &settle);
        let sender = Address::generate(&env);
        let asset = Address::generate(&env);
        let commit = BytesN::from_array(&env, &[1u8; 32]);
        let recip = Address::generate(&env);
        let r = c.cross_currency_settlement(
            &sender, &asset, &asset, &1000i128, &1000i128, &3u32, &commit, &recip,
        );
        assert_eq!(r, Err(BridgeError::SameAsset));
    }

    #[test]
    fn test_invalid_tier_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CovenantComplianceBridge, ());
        let c = CovenantComplianceBridgeClient::new(&env, &id);
        let admin = Address::generate(&env);
        let settle = Address::generate(&env);
        c.initialize(&admin, &settle);
        let sender = Address::generate(&env);
        let src = Address::generate(&env);
        let dst = Address::generate(&env);
        let commit = BytesN::from_array(&env, &[1u8; 32]);
        let recip = Address::generate(&env);
        let r = c.cross_currency_settlement(
            &sender, &src, &dst, &1000i128, &1000i128, &0u32, &commit, &recip,
        );
        assert_eq!(r, Err(BridgeError::InvalidTier));
    }

    #[test]
    fn test_tier_limits() {
        assert_eq!(CovenantComplianceBridge::tier_limit(5), 1_000_000_000_000);
        assert_eq!(CovenantComplianceBridge::tier_limit(4), 800_000_000_000);
        assert_eq!(CovenantComplianceBridge::tier_limit(3), 600_000_000_000);
        assert_eq!(CovenantComplianceBridge::tier_limit(2), 400_000_000_000);
        assert_eq!(CovenantComplianceBridge::tier_limit(1), 200_000_000_000);
        assert_eq!(CovenantComplianceBridge::tier_limit(0), 0);
    }
}
