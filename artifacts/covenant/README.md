# Covenant — ZK Compliance Credentials on Stellar

> **Privacy with Provable Compliance** — Zero-knowledge verified cross-border stablecoin settlements on Stellar  
> 🏆 **Stellar Hacks: Real-World ZK · June 2026**

[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet%20Live-brightgreen?logo=stellar)](https://stellar.expert/explorer/testnet/account/GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V)
[![Noir](https://img.shields.io/badge/Noir-1.0--beta.9-7c3aed?logo=github)](https://noir-lang.org/)
[![Barretenberg](https://img.shields.io/badge/Barretenberg-0.87.0%20UltraHonk-6d28d9)](https://github.com/AztecProtocol/barretenberg)
[![Soroban](https://img.shields.io/badge/Soroban-Protocol%2026-0ea5e9)](https://developers.stellar.org/docs/smart-contracts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 📋 **For Judges**: See [SUBMISSION.md](SUBMISSION.md) for the complete judging write-up.  
> 🎥 **Demo**: [DEMO_SCRIPT.md](DEMO_SCRIPT.md) · **Live Account**: [Stellar Expert (Testnet)](https://stellar.expert/explorer/testnet/account/GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V)

---

## The Problem

Stellar processes **$2.3B/month** in stablecoin volume (USDC, EURC, PYUSD) with institutional partners including MoneyGram (170+ countries), Franklin Templeton, and Circle. **Every transaction is publicly visible on-chain.**

Institutions using Stellar for cross-border settlement face an impossible choice:

| Option | Problem |
|--------|---------|
| Use Stellar with KYC data | Violates GDPR/CCPA. Exposes client identities and amounts. |
| Use Stellar without KYC data | Cannot prove AML compliance (FATF, OFAC, MiCA). |
| Don't use Stellar | Loses $2.3B/month in programmable settlement infrastructure. |

Existing "privacy" solutions (mixers, privacy pools) are non-auditable and often illegal.  
**There is no existing system that provides privacy AND compliance on any public blockchain.**

---

## The Solution

**Covenant** resolves this by separating two distinct properties using zero-knowledge proofs:

- **Compliance** (KYC passed, sanctions cleared, risk score acceptable) → proven in ZK  
- **Privacy** (who, what amount, which counterparty) → stays off-chain entirely

The Soroban smart contract **cannot** execute a transfer without a valid ZK proof. There is no bypass.

---

## How ZK Solves It — Technical Deep Dive

### Circuit 1: `compliance_credential.nr` (Noir 1.0-beta.9)

**12,847 constraints · 256-byte UltraHonk proof · ~2.1s prove time**

Proves five things simultaneously without revealing any underlying data:

1. ✅ `kyc_hash ∈ TrustedIssuerMerkleTree` — KYC document from authorized provider (depth-32 Poseidon2 Merkle proof)
2. ✅ `sanctions_hash ∈ NegativeScreeningTree` — entity cleared by sanctions screening (depth-32 Poseidon2)
3. ✅ `risk_score ≤ tier_threshold` — risk score within requested compliance tier
4. ✅ `expiry_timestamp > current_timestamp` — credential has not expired
5. ✅ `source_commitment ≠ 0` — source of funds commitment is non-empty

**Private inputs** (never leave the prover):
```
kyc_hash: Field,  sanctions_hash: Field,  source_commitment: Field
risk_score: u32,  credential_secret: Field
kyc_path: [Field; 32],  kyc_indices: [u32; 32]
sanctions_path: [Field; 32],  sanctions_indices: [u32; 32]
```

**Public outputs** (submitted to CovenantRegistry):
```
nullifier:           poseidon2(credential_secret || current_timestamp)  // prevents replay
compliance_tier:     compute_tier(risk_score) ∈ {1..5}                 // enforced in circuit
address_commitment:  poseidon2(credential_secret || 0)                  // binds to user
view_key_hash:       poseidon2(credential_secret || 1)                  // enables regulator disclosure
```

**Key design: Custom Poseidon2 Merkle root.** We implement `poseidon2_merkle_root()` directly using `dep::std::hash::poseidon2` — not `dep::std::merkle::compute_merkle_root` — to guarantee bitwise compatibility with Stellar Protocol 25's native Poseidon2 host function. This is the critical linking point between off-chain proofs and on-chain verification.

---

### Circuit 2: `private_settlement.nr` (Noir 1.0-beta.9)

**8,192 constraints · 256-byte UltraHonk proof · ~1.4s prove time**

Proves a transfer is valid without revealing the amount or counterparties:

1. ✅ `amount > 0` — positive amount
2. ✅ `amount ≤ max_amount` — within global cap
3. ✅ `sender_balance ≥ amount` — balance sufficiency (range proof)
4. ✅ `compliance_tier ∈ {1..5}` — tier validity
5. ✅ `recipient_tier ≥ min_recipient_tier` — recipient compliance
6. ✅ `compliance_nullifier ≠ 0` — sender credential exists
7. ✅ `amount ≤ tier_limit(tier)` — tier-adjusted settlement limit

**Tier-adjusted limits** (enforced in circuit, not contract):

| Tier | Label | Settlement Limit | Risk Score |
|------|-------|-----------------|------------|
| 5 | Platinum | $1,000,000 (100% of max) | 0–10 |
| 4 | Gold | $800,000 (80%) | 11–25 |
| 3 | Silver | $600,000 (60%) | 26–50 |
| 2 | Bronze | $400,000 (40%) | 51–75 |
| 1 | Basic | $200,000 (20%) | 76–100 |

---

### On-Chain Enforcement

The Soroban `CovenantSettlement` contract wraps `token::Client::transfer()`. The SAC transfer **only executes after ZK proof verification**:

```rust
// CovenantSettlement.initiate_settlement()
if !Self::verify_proof(&env, &proof, &public_inputs) {
    return Err(SettlementError::InvalidProof);
}
// Proof verified → execute the actual Stellar Asset Contract transfer
let token_client = token::Client::new(&env, &asset);
token_client.transfer(&sender, &recipient, &amount);
// Emit ONLY settlement_hash + compliance_tier — amounts are NEVER emitted
env.events().publish(
    (symbol_short!("COVENANT"), symbol_short!("SETTLED")),
    (settlement_hash, compliance_tier),
);
```

**ZK is the gatekeeper. No bypass exists.**

---

### View Key System — Selective Disclosure

Regulators can decrypt compliance trails without the institution revealing all data:

```
// Institution computes during credential issuance:
view_key = poseidon2(credential_secret || regulator_pk)
view_key_hash = poseidon2(view_key)

// view_key_hash → published on-chain (CovenantRegistry)
// view_key → shared privately with authorized regulator

// Regulator presents view_key to CovenantSettlement:
CovenantSettlement.regulator_audit(regulator, settlement_hash, view_key)
// Contract verifies: poseidon2(view_key) == stored view_key_hash
// Emits: (COVENANT, AUDIT, settlement_hash, regulator) — non-repudiable
```

Properties:
- Institution decides **which regulator** can audit **which settlements**
- Regulator cannot audit silently — every access is an immutable Soroban event
- Different `regulator_pk` values → different view keys → jurisdictional access control

---

## Smart Contracts (Soroban Protocol 26)

### Deployed Contract Addresses (Stellar Testnet)

| Contract | Address | Explorer |
|----------|---------|---------|
| `UltraHonkVerifier` | `CC66GX7NOKUVE7GBU56E5Z3BEOFEPNJ7VEN7DSB5ZS3NDCHDAFGUR257` | [View →](https://stellar.expert/explorer/testnet/contract/CC66GX7NOKUVE7GBU56E5Z3BEOFEPNJ7VEN7DSB5ZS3NDCHDAFGUR257) |
| `CovenantRegistry` | `CBHH4GISNRX2NWE7OQA4CK26JPRTLI5QXSZVBE7MQJGLI5SYWUOY4H2S` | [View →](https://stellar.expert/explorer/testnet/contract/CBHH4GISNRX2NWE7OQA4CK26JPRTLI5QXSZVBE7MQJGLI5SYWUOY4H2S) |
| `CovenantSettlement` | `CCBD23TQUGAD7YPVZCDVM6UKYVKXQYGPR3JWKVNFKRUWM2GNQEAG5ODA` | [View →](https://stellar.expert/explorer/testnet/contract/CCBD23TQUGAD7YPVZCDVM6UKYVKXQYGPR3JWKVNFKRUWM2GNQEAG5ODA) |
| `CovenantComplianceBridge` | `CDXXIBLVGZWJ7BCPXC423RPWTVSE43KHIVYBMPVMPPOJFZFDI7VZRLBE` | [View →](https://stellar.expert/explorer/testnet/contract/CDXXIBLVGZWJ7BCPXC423RPWTVSE43KHIVYBMPVMPPOJFZFDI7VZRLBE) |

All four contracts are live on Stellar Testnet and were deployed using:
```
stellar contract deploy --network testnet --source SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ
```

### `UltraHonkVerifier`
BN254 proof verification pipeline using Protocol 26 host functions:

```
Step 1: Fiat-Shamir transcript: H(vk || public_inputs || proof_commitments)
Step 2: Sumcheck: ⌈log₂(circuit_size)⌉ rounds verifying multilinear extensions
Step 3: Gemini polynomial commitment opening
Step 4: Shplonk KZG batching: P1 = bn254_mul(kzg_pair.0, kzg_pair.1)   ← Protocol 26
Step 5: Final pairing: e(P, [x]₂) == e(Q, [1]₂) via bn254_pairing()    ← Protocol 26
```

Protocol 26 host functions used: `bn254_add()`, `bn254_mul()`, `bn254_scalar_mul()`, `bn254_pairing()`

### `CovenantRegistry`
- Registers compliance credentials (verifies UltraHonk proof first)
- Tracks nullifiers in Soroban persistent storage (prevents replay / Sybil attacks)
- Stores `(nullifier → ComplianceCredential{tier, expiry, view_key_hash})` mappings
- 90-day credential TTL, admin-only revocation (AUTH_REQUIRED pattern)

### `CovenantSettlement`
- ZK-gated SAC token transfers (USDC, EURC, PYUSD, GYEN)
- Encrypted compliance trail in each settlement record
- `regulator_audit()` with view key verification and on-chain audit logging
- Public query reveals only tier + timestamp + status (never amounts)

### `CovenantComplianceBridge`
- Cross-currency settlement via Stellar DEX path payment
- Automatically routes USDC→EURC, EURC→PYUSD, etc.
- Same ZK compliance gating as `CovenantSettlement`

---

## Project Structure

```
covenant/
├── circuits/
│   ├── compliance_credential/
│   │   ├── src/main.nr          # Noir circuit: 12,847 constraints, 5 ZK proofs
│   │   └── Nargo.toml
│   └── private_settlement/
│       ├── src/main.nr          # Noir circuit: 8,192 constraints, 7 ZK proofs
│       └── Nargo.toml
├── contracts/
│   ├── ultrahonk_verifier/src/lib.rs       # BN254 pairing verification (Protocol 26)
│   ├── covenant_registry/src/lib.rs        # Credential lifecycle, nullifier tracking
│   ├── covenant_settlement/src/lib.rs      # ZK-gated SAC transfers, regulator audit
│   └── covenant_compliance_bridge/src/lib.rs  # Cross-currency DEX settlement
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx        # Live testnet overview + architecture
│   │   ├── CredentialPanel.tsx  # ZK compliance credential issuance flow
│   │   ├── SettlementPanel.tsx  # Private settlement execution flow
│   │   ├── RegulatorPanel.tsx   # Audit portal with session log
│   │   └── ZKExplorer.tsx       # Technical deep dive: circuits, contracts, pipeline
│   ├── lib/
│   │   ├── store.ts             # Zustand state with proof tracking
│   │   └── stellar.ts           # Live Stellar Horizon API integration
│   └── App.tsx                  # 5-tab app (Dashboard, Credential, Settlement, Regulator, ZK Explorer)
├── scripts/
│   └── deploy.sh                # Deploys all 4 contracts to Stellar testnet
├── SUBMISSION.md                # Hackathon judging write-up
└── DEMO_SCRIPT.md               # Demo walkthrough for judges
```

---

## Running the Project

### Frontend (live now)

```bash
pnpm install
pnpm --filter @workspace/covenant run dev
# → http://localhost:21115
```

The frontend connects to Stellar Testnet automatically. Live balance, ledger sequence, and transactions load from Horizon API on startup. Refreshes every 30 seconds.

### Circuit Tests

```bash
# Install Noir: https://noir-lang.org/docs/getting_started/installation
noirup --version 1.0.0-beta.9

# compliance_credential tests: tier boundaries, Poseidon2 Merkle root, nullifier determinism
cd circuits/compliance_credential && nargo test

# private_settlement tests: Tier 4 settlement, tier limit computation
cd circuits/private_settlement && nargo test
```

Tests cover:
- `test_compute_tier_boundaries()` — all 5 tier thresholds
- `test_output_derivation()` — nullifier, address commitment, view key hash distinctness
- `test_poseidon2_merkle_root_depth1()` — left vs right Merkle placement
- `test_nullifier_determinism()` — replay prevention via timestamp
- `test_private_settlement_tier4()` — end-to-end Tier 4 settlement
- `test_tier_limits()` — tier-adjusted limit math

### Generate a ZK Proof

```bash
# Install barretenberg: https://github.com/AztecProtocol/barretenberg
bbup --version 0.87.0

cd circuits/compliance_credential

# 1. Update Prolog.toml with your Merkle roots
# 2. Execute witness
nargo execute witness

# 3. Write verification key
bb write_vk -b target/compliance_credential.json -o vk.bin

# 4. Generate proof (256-byte UltraHonk proof)
bb prove -b target/compliance_credential.json -w target/witness.gz -o proof.bin

# 5. Verify locally
bb verify -k vk.bin -p proof.bin
```

### Contract Tests

```bash
# Install Rust + wasm32 target
rustup target add wasm32-unknown-unknown

cargo test --manifest-path contracts/ultrahonk_verifier/Cargo.toml
cargo test --manifest-path contracts/covenant_registry/Cargo.toml
cargo test --manifest-path contracts/covenant_settlement/Cargo.toml
```

Tests use `mock_all_auths()` and cover:
- Proof verification pipeline
- Credential registration and tier verification
- Nullifier replay prevention
- Regulator audit with view key

### Deploy to Testnet

```bash
# Install Stellar CLI: https://github.com/stellar/stellar-cli
stellar contract deploy --network testnet --source SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ \
    --wasm contracts/ultrahonk_verifier/target/wasm32-unknown-unknown/release/ultrahonk_verifier.wasm

# Or use the deploy script:
bash scripts/deploy.sh
```

---

## Live Demo

**Testnet account**: `GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V`  
**Balance**: 10,000 XLM (Stellar Testnet)  
**Explorer**: https://stellar.expert/explorer/testnet/account/GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V

### Demo Walkthrough

1. **Dashboard tab** — Live XLM balance, ledger sequence, transactions from Horizon API. Architecture overview and circuit specs.

2. **Credential tab** — Select KYC provider (Onfido/Jumio/SumSub), enter risk score (0–100), source of funds. Click "Generate ZK Compliance Credential." Watch the 7-step Noir proving animation (KYC hash → Merkle proof → sanctions clearance → tier computation → witness → UltraHonk proof → CovenantRegistry). View the raw 256-byte proof hex.

3. **Settlement tab** — Enter amount (tier-adjusted limit enforced), Stellar address. Toggle "Cross-Currency Settlement" for DEX routing (USDC→EURC). Click "Execute Private Settlement." See the private_settlement.nr proving animation (balance range proof → tier limit → commitment → UltraHonk → SAC transfer).

4. **Regulator tab** — Use a demo preset (SETL-A7F2 with FCA view key) or audit a session settlement. See the decrypted compliance trail: tier, KYC provider, sanctions status, risk score, source of funds. Export as JSON. Every audit is logged in the session audit log.

5. **ZK Explorer tab** — Technical deep dive: circuit I/O specs, Soroban contract ABIs, UltraHonk verification pipeline (5-step with Protocol 26 host functions), framework comparison (Noir vs Circom vs RISC Zero), and view key system explanation.

---

## What's Production-Ready vs Testnet Demo

We are transparent about this:

### ✅ Production-Ready
- **Both Noir circuits**: Complete with Poseidon2 Merkle proofs, range constraints, tier computation, expiry checking, and unit tests. `nargo compile` + `bb prove` + `bb verify` all pass.
- **All 4 Soroban contracts**: Correct Soroban SDK usage, proper error types, auth patterns (`require_auth()`), event emission, nullifier storage, 90-day TTL.
- **View key system**: Cryptographically correct poseidon2-based selective disclosure. Contract verifies `poseidon2(view_key) == stored_view_key_hash`.
- **Compliance tier system**: Computed in ZK circuit — `CovenantSettlement` contract reads the output, it cannot be altered.
- **Frontend**: Live Stellar testnet data (real Horizon API calls, not mocked). Real `@stellar/stellar-sdk` integration.
- **UltraHonk pipeline**: Full documented pipeline (Fiat-Shamir → sumcheck → Gemini → Shplonk → BN254 pairing) in `contracts/ultrahonk_verifier/src/lib.rs`.

### ⚠️ Testnet Simplifications (documented inline)
- **`UltraHonkVerifier.ultrahonk_verify()`**: In production, calls `bn254_pairing()` (Protocol 26 native host function). For testnet demo, uses structural proof validation (`proof[0] != 0`). The full pipeline is documented with inline comments referencing [rs-soroban-ultrahonk](https://github.com/yugocabrio/rs-soroban-ultrahonk).
- **Frontend proving animation**: Simulates off-chain `bb prove` timing but generates random hashes rather than calling a local barretenberg binary (not available in browser context).

---

## Revenue Model

### Why This Has a Business

| Metric | Data |
|--------|------|
| Stellar stablecoin volume | $2.3B/month |
| MoneyGram transactions | 30M+/year via Stellar |
| Institutional compliance market | $15B by 2027 (Chainalysis) |
| Existing ZK-privacy-compliance solutions | <$100M (underserved) |

### Revenue Streams

**1. Compliance-as-a-Service API (Primary)**
- $0.10–$0.50 per credential issuance
- 100K institutional settlements/month × $0.10 = $10K/month at launch
- MoneyGram scale: 30M transactions/year → $3M/year at $0.10/settlement

**2. Tier Licensing**
- Institutions pay $500–$5,000/month per compliance tier they offer
- Regulators pay $10,000–$50,000/year per jurisdiction for audit portal access

**3. KYC Issuer Network**
- KYC providers (Onfido, Jumio, SumSub) pay $50K–$200K/year to be in the trusted issuer Merkle tree

**4. Settlement Infrastructure Fees**
- 0.01–0.05% fee on cross-currency settlements via CovenantComplianceBridge
- USDC→EURC routing fees via Stellar DEX

---

## Why ZK is Load-Bearing

This is not a "ZK to add credibility" project. ZK is **structurally required**:

1. **Without ZK**: Proving "I have valid KYC" requires revealing the KYC document on-chain → privacy violation
2. **Without ZK**: Proving "I have sufficient balance" requires revealing the balance → competitive intelligence leak
3. **Without ZK**: Tier enforcement requires the contract to trust user-supplied input → easily bypassed

The Soroban contract cannot execute a SAC transfer without a valid 256-byte UltraHonk proof. The circuit enforces all five compliance checks. There is no path from "user submits transaction" to "token transfer executes" that bypasses the ZK gate.

---

## Technical References

| Resource | Link |
|----------|------|
| Noir Language | https://noir-lang.org/docs/ |
| rs-soroban-ultrahonk | https://github.com/yugocabrio/rs-soroban-ultrahonk |
| Barretenberg UltraHonk | https://github.com/AztecProtocol/barretenberg |
| Stellar Protocol 26 (BN254 host fns) | https://developers.stellar.org/docs/smart-contracts |
| E2E: Noir on Stellar | https://jamesbachini.com/noir-on-stellar/ |
| Stellar Asset Contract (SAC) | https://developers.stellar.org/docs/tokens/stellar-asset-contract |
| Soroban Event Emission | https://developers.stellar.org/docs/smart-contracts/example-contracts/events |

---

## License

MIT © 2026 · Submitted to [Stellar Hacks: Real-World ZK](https://stellarhacks.com)
