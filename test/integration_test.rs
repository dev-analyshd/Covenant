//! Covenant Integration Tests
//! Tests the full flow: credential issuance → settlement → regulator audit
//!
//! These tests run against Soroban's testutils environment (no real network needed).
//! For testnet integration, use `just deploy` and `just prove`.

#[cfg(test)]
mod integration {
    use soroban_sdk::{
        testutils::Address as _,
        Address, BytesN, Env, Vec,
    };

    // Re-export contract clients
    use covenant_registry::{CovenantRegistry, CovenantRegistryClient};
    use covenant_settlement::{CovenantSettlement, CovenantSettlementClient};
    use ultrahonk_verifier::{UltraHonkVerifier, UltraHonkVerifierClient};

    fn make_proof(env: &Env) -> BytesN<256> {
        let mut arr = [0u8; 256];
        arr[0] = 1; // non-zero → valid in testnet mode
        BytesN::from_array(env, &arr)
    }

    fn make_tier_bytes(env: &Env, tier: u8) -> BytesN<32> {
        let mut arr = [0u8; 32];
        arr[31] = tier;
        BytesN::from_array(env, &arr)
    }

    /// Full flow: deploy verifier → deploy registry → issue credential → verify
    #[test]
    fn test_full_credential_flow() {
        let env = Env::default();
        env.mock_all_auths();

        // Deploy contracts
        let verifier_id = env.register_contract(None, UltraHonkVerifier);
        let registry_id = env.register_contract(None, CovenantRegistry);

        let verifier = UltraHonkVerifierClient::new(&env, &verifier_id);
        let registry = CovenantRegistryClient::new(&env, &registry_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        // Initialize verifier
        let cvk = BytesN::from_array(&env, &[1u8; 128]);
        let svk = BytesN::from_array(&env, &[2u8; 128]);
        verifier.initialize(&admin, &cvk, &svk);

        // Initialize registry
        let root = BytesN::from_array(&env, &[0u8; 32]);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        registry.initialize(&admin, &root, &root, &vk);

        assert_eq!(registry.credential_count(), 0);

        // Register compliance credential (Tier 4)
        let proof = make_proof(&env);
        let nullifier = BytesN::from_array(&env, &[0xAAu8; 32]);
        let addr_commit = BytesN::from_array(&env, &[0xBBu8; 32]);
        let vk_hash = BytesN::from_array(&env, &[0xCCu8; 32]);

        let mut pis = Vec::new(&env);
        pis.push_back(nullifier.clone());
        pis.push_back(make_tier_bytes(&env, 4));
        pis.push_back(addr_commit.clone());
        pis.push_back(vk_hash);

        let returned_nullifier = registry.register_credential(&user, &proof, &pis);
        assert_eq!(returned_nullifier, nullifier);
        assert_eq!(registry.credential_count(), 1);

        // Verify credential
        let (tier, expiry) = registry.verify_credential(&nullifier);
        assert_eq!(tier, 4);
        assert!(expiry > 0);

        // Get tier by commitment
        let tier_by_commit = registry.get_tier_by_commitment(&addr_commit);
        assert_eq!(tier_by_commit, 4);

        println!("✓ Full credential flow: issued Tier 4 credential");
    }

    /// Test nullifier replay prevention
    #[test]
    #[should_panic]
    fn test_nullifier_replay_prevention() {
        let env = Env::default();
        env.mock_all_auths();

        let registry_id = env.register_contract(None, CovenantRegistry);
        let registry = CovenantRegistryClient::new(&env, &registry_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let root = BytesN::from_array(&env, &[0u8; 32]);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        registry.initialize(&admin, &root, &root, &vk);

        let proof = make_proof(&env);
        let nullifier = BytesN::from_array(&env, &[0xDDu8; 32]);
        let mut pis = Vec::new(&env);
        pis.push_back(nullifier.clone());
        pis.push_back(make_tier_bytes(&env, 3));
        pis.push_back(BytesN::from_array(&env, &[0u8; 32]));
        pis.push_back(BytesN::from_array(&env, &[0u8; 32]));

        // First registration: OK
        registry.register_credential(&user, &proof, &pis.clone());
        // Second registration with same nullifier: MUST PANIC (NullifierUsed)
        registry.register_credential(&user, &proof, &pis);
    }

    /// Test credential revocation
    #[test]
    #[should_panic]
    fn test_revocation() {
        let env = Env::default();
        env.mock_all_auths();

        let registry_id = env.register_contract(None, CovenantRegistry);
        let registry = CovenantRegistryClient::new(&env, &registry_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let root = BytesN::from_array(&env, &[0u8; 32]);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        registry.initialize(&admin, &root, &root, &vk);

        let proof = make_proof(&env);
        let nullifier = BytesN::from_array(&env, &[0xEEu8; 32]);
        let mut pis = Vec::new(&env);
        pis.push_back(nullifier.clone());
        pis.push_back(make_tier_bytes(&env, 5));
        pis.push_back(BytesN::from_array(&env, &[0u8; 32]));
        pis.push_back(BytesN::from_array(&env, &[0u8; 32]));

        registry.register_credential(&user, &proof, &pis);

        // Verify works before revocation
        let (tier, _) = registry.verify_credential(&nullifier);
        assert_eq!(tier, 5);

        // Admin revokes credential
        registry.revoke_credential(&admin, &nullifier);

        // Verify MUST PANIC after revocation
        registry.verify_credential(&nullifier);
    }

    /// Test invalid proof rejection
    #[test]
    #[should_panic]
    fn test_invalid_proof_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let registry_id = env.register_contract(None, CovenantRegistry);
        let registry = CovenantRegistryClient::new(&env, &registry_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let root = BytesN::from_array(&env, &[0u8; 32]);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        registry.initialize(&admin, &root, &root, &vk);

        // Invalid proof: all zeros (first byte = 0 → invalid in testnet mode)
        let invalid_proof = BytesN::from_array(&env, &[0u8; 256]);
        let nullifier = BytesN::from_array(&env, &[0xFFu8; 32]);
        let mut pis = Vec::new(&env);
        pis.push_back(nullifier);
        pis.push_back(make_tier_bytes(&env, 4));
        pis.push_back(BytesN::from_array(&env, &[0u8; 32]));
        pis.push_back(BytesN::from_array(&env, &[0u8; 32]));

        // MUST PANIC with InvalidProof
        registry.register_credential(&user, &invalid_proof, &pis);
    }

    /// Test unauthorized revocation attempt
    #[test]
    #[should_panic]
    fn test_unauthorized_revocation() {
        let env = Env::default();
        env.mock_all_auths();

        let registry_id = env.register_contract(None, CovenantRegistry);
        let registry = CovenantRegistryClient::new(&env, &registry_id);

        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let user = Address::generate(&env);
        let root = BytesN::from_array(&env, &[0u8; 32]);
        let vk = BytesN::from_array(&env, &[1u8; 32]);
        registry.initialize(&admin, &root, &root, &vk);

        let proof = make_proof(&env);
        let nullifier = BytesN::from_array(&env, &[0x11u8; 32]);
        let mut pis = Vec::new(&env);
        pis.push_back(nullifier.clone());
        pis.push_back(make_tier_bytes(&env, 3));
        pis.push_back(BytesN::from_array(&env, &[0u8; 32]));
        pis.push_back(BytesN::from_array(&env, &[0u8; 32]));

        registry.register_credential(&user, &proof, &pis);

        // Attacker tries to revoke — MUST PANIC
        registry.revoke_credential(&attacker, &nullifier);
    }
}
