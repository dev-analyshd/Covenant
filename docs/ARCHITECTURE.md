# Covenant — System Architecture

## Overview

Covenant is a ZK-verifiable compliance credential system for institutional cross-border stablecoin settlement on Stellar. It combines Noir ZK circuits (UltraHonk proof system) with Soroban smart contracts to enable **private settlements with provable compliance** — where privacy and regulatory requirements are mutually reinforcing, not trade-offs.

Built for **Stellar Hacks: Real-World ZK** (June 2026) by applying Stellar Protocol 26's native BN254 host functions to the institutional DeFi problem.

---

## Why This Problem

Stellar processes $2.3B/month in stablecoin volume (USDC, EURC, PYUSD, GYEN) with institutional partners including MoneyGram (30M+ volume, 170+ countries), Franklin Templeton, and Circle. Every transaction is publicly visible on-chain.

**The institutional privacy paradox**: Institutions need compliance proofs for regulators. But publishing KYC data, transaction amounts, and counterparty identities on a public ledger violates privacy regulations (GDPR, CCPA) and exposes competitive intelligence.

Existing solutions:
- **Privacy pools**: No compliance, black-listed by regulators
- **Mixers**: Illegal in most jurisdictions
- **Opacity**: Defeats the purpose of a programmable ledger

Covenant's solution: **Configurable privacy with provable compliance** — prove regulatory requirements via ZK without revealing private data.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        COVENANT SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAYER 1 — NOIR ZK CIRCUITS (Off-Chain, Barretenberg)          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ compliance_credential/src/main.nr                        │  │
│  │  Private: kyc_hash, sanctions_hash, risk_score,          │  │
│  │           source_commitment, credential_secret           │  │
│  │  Merkle: kyc_path[32], kyc_indices[32],                 │  │
│  │          sanctions_path[32], sanctions_indices[32]       │  │
│  │  Public: trusted_issuer_root, negative_screening_root,   │  │
│  │          current_timestamp, expiry_timestamp             │  │
│  │  Outputs: nullifier, compliance_tier, addr_commitment,   │  │
│  │           view_key_hash                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ private_settlement/src/main.nr                           │  │
│  │  Private: amount, sender_balance, compliance_tier,       │  │
│  │           sender_secret, recipient_tier                  │  │
│  │  Public: settlement_id, min_recipient_tier, max_amount,  │  │
│  │          asset_id, compliance_nullifier, timestamp       │  │
│  │  Outputs: settlement_hash, attestation, sender_commit,   │  │
│  │           tier_limit                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  LAYER 2 — SOROBAN CONTRACTS (On-Chain, Protocol 26)           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ UltraHonkVerifier                                        │  │
│  │  BN254 host functions: bn254_add, bn254_mul, bn254_pairing│ │
│  │  Verifies: Fiat-Shamir transcript + sumcheck + KZG       │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CovenantRegistry                                         │  │
│  │  Stores: nullifiers (replay prevention), tiers,          │  │
│  │          address commitments, view_key_hashes            │  │
│  │  register_credential(proof, public_inputs) → nullifier   │  │
│  │  verify_credential(nullifier) → (tier, expiry)           │  │
│  │  revoke_credential(admin, nullifier) [AUTH_REQUIRED]     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CovenantSettlement                                       │  │
│  │  initiate_settlement(proof, inputs, asset, amount, ...)  │  │
│  │  → ZK verified → SAC.transfer(sender, recipient, amount) │  │
│  │  → Only hash + tier stored on-chain (amounts private)    │  │
│  │  regulator_audit(view_key) → compliance trail            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CovenantComplianceBridge                                 │  │
│  │  cross_currency_settlement(USDC→EURC, proof, ...)        │  │
│  │  → DEX path payment via Stellar native multi-hop routing │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  LAYER 3 — VIEW KEY COMPLIANCE                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ view_key = poseidon2(credential_secret ‖ regulator_pk)   │  │
│  │ Published: view_key_hash = poseidon2(view_key)           │  │
│  │ Disclosure: regulator calls regulator_audit(view_key)    │  │
│  │ Audit log: emitted as Soroban event (non-repudiable)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ZK Proof Flow

```
User (Off-Chain)                    Stellar Testnet (On-Chain)
─────────────────                   ──────────────────────────
1. Gather KYC documents
2. Compute Poseidon2 hashes ──────→
3. Build Merkle proof paths          CovenantRegistry (storage)
4. nargo execute witness             │
5. bb prove (UltraHonk)             │
6. Submit proof + public_inputs ───→ UltraHonkVerifier.verify()
                                     │  bn254_add (Protocol 26)
                                     │  bn254_mul (Protocol 26)
                                     │  bn254_pairing (Protocol 26)
                                     ↓
                              CovenantRegistry.register_credential()
                                     │  nullifier → storage
                                     │  tier → storage
                                     │  view_key_hash → storage
                                     ↓
                              Credential active on-chain
                                     │
7. Build settlement proof ─────────→ CovenantSettlement.initiate_settlement()
                                     │  verify settlement proof
                                     │  SAC.transfer(sender, recipient, amount)
                                     │  encrypted_trail → storage
                                     ↓
                              Settlement complete (amounts private)
                                     │
Regulator                            │
8. Call regulator_audit(view_key) → CovenantSettlement.regulator_audit()
                                     │  verify view_key vs hash
                                     │  emit AUDIT event (logged)
                                     │  return compliance trail
                                     ↓
                              Regulator sees: tier, KYC provider,
                              sanctions status, risk score, source of funds
                              Regulator cannot see: actual amount, identity
```

---

## Stellar Integration Points

### Protocol 25 (X-Ray)
- Native Poseidon2 hash host function — used in both Noir circuits
- BLS12-381 elliptic curve operations
- BN254 base field operations (add, mul)

### Protocol 26 (Yardstick)
- 9 additional BN254 host functions enabling full UltraHonk verification:
  - `bn254_add(p1: G1, p2: G1) → G1`
  - `bn254_mul(p: G1, s: Scalar) → G1`
  - `bn254_pairing(pairs: [(G1, G2)]) → bool`
  - `bn254_scalar_add`, `bn254_scalar_mul`, `bn254_scalar_inv`
- Makes Noir UltraHonk proof verification gas-efficient on Soroban

### Stellar Asset Contract (SAC)
- Token transfers execute ONLY after proof verification
- Supports USDC, EURC, PYUSD, GYEN, BRLA natively
- Cross-currency routing via Stellar DEX (CovenantComplianceBridge)

### Native Compliance Primitives
- `AUTH_REQUIRED`: only admin can revoke credentials (regulator power)
- `clawback`: emergency regulatory freeze of credentials
- `freeze`: account-level sanctions enforcement

---

## Security Model

| Property | Mechanism |
|----------|-----------|
| **Privacy** | Identity never on-chain. Only commitments and hashes |
| **Compliance** | Tier proven in ZK, auditable via view key |
| **Non-repudiation** | All audit accesses logged as Soroban events |
| **Replay prevention** | Nullifiers stored in CovenantRegistry |
| **Revocation** | Admin-only via Stellar AUTH_REQUIRED pattern |
| **Expiry** | 90-day TTL enforced in both circuit and contract |
| **Access control** | View key = poseidon2(secret ‖ regulator_pk) |

---

## Compliance Tier System

| Tier | Risk Score | Label | Settlement Limit |
|------|-----------|-------|-----------------|
| 5 | 0–10 | Platinum | $1,000,000 |
| 4 | 11–25 | Gold | $800,000 |
| 3 | 26–50 | Silver | $600,000 |
| 2 | 51–75 | Bronze | $400,000 |
| 1 | 76–100 | Basic | $200,000 |

Tier computed deterministically in the ZK circuit — the Soroban contract cannot override it.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| ZK Circuits | Noir 1.0-beta.9 |
| Proving Backend | Barretenberg 0.87.0 (UltraHonk) |
| Verifier Contract | Soroban (Rust/WASM) + Protocol 26 |
| Smart Contracts | Rust + Soroban SDK 22.0 |
| Merkle Hashing | Poseidon2 (Stellar Protocol 25 host function) |
| Frontend | React 18 + TypeScript + Vite + Tailwind |
| Stellar SDK | @stellar/stellar-sdk (Horizon + SAC) |

---

## Repository Structure

```
covenant/
├── Cargo.toml                   Workspace (4 Soroban contracts)
├── justfile                     Task runner
├── .gitignore
├── README.md
├── circuits/
│   ├── compliance_credential/
│   │   ├── Nargo.toml
│   │   └── src/main.nr          Compliance credential circuit
│   └── private_settlement/
│       ├── Nargo.toml
│       └── src/main.nr          Private settlement circuit
├── contracts/
│   ├── covenant_registry/       Nullifier tracking, tier storage
│   ├── covenant_settlement/     Settlement + regulator audit
│   ├── covenant_compliance_bridge/ Cross-currency via DEX
│   └── ultrahonk_verifier/      BN254 proof verification
├── frontend/ (src/)             React + Stellar SDK integration
├── scripts/
│   ├── deploy.sh                Stellar testnet deployment
│   └── generate_proof.sh        Noir proof generation
├── test/
│   └── integration_test.rs      End-to-end contract tests
└── docs/
    ├── ARCHITECTURE.md          (this file)
    └── CIRCUITS.md              Circuit specifications
```
