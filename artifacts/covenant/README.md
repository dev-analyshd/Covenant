# Covenant — ZK Compliance Credentials on Stellar

> **Privacy with Provable Compliance** — Zero-knowledge verified cross-border stablecoin settlements on Stellar

[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet-blue?logo=stellar)](https://stellar.expert/explorer/testnet/account/GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V)
[![Noir Circuits](https://img.shields.io/badge/Noir-UltraHonk-purple)](https://noir-lang.org/)
[![Soroban](https://img.shields.io/badge/Soroban-Protocol%2026-green)](https://developers.stellar.org/docs/smart-contracts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## The Problem

Stellar processes **$2.3B/month** in stablecoin volume with institutional partners including MoneyGram, Franklin Templeton, and Circle. Every transaction is publicly visible.

Institutions face an impossible choice:
- **Use Stellar** → expose client data, violate GDPR/CCPA, reveal competitive intelligence
- **Stay private** → cannot prove compliance to regulators

Existing "privacy" solutions (mixers, privacy pools) are non-compliant. Regulators need auditability. Users need privacy. **Today, you cannot have both.**

## The Solution

Covenant enables **configurable privacy with provable compliance** via Noir ZK circuits and Soroban smart contracts:

1. **Compliance Credential**: Prove KYC verification, sanctions clearance, and risk score in a ZK circuit — without revealing any underlying data
2. **Private Settlement**: Execute stablecoin transfers where only a cryptographic commitment is on-chain
3. **Regulator Audit**: Authorized regulators decrypt compliance trails via view keys — while audit access is logged non-repudiably

**ZK is load-bearing**: Without a valid proof, the Soroban contract rejects the transaction. Compliance is not optional.

---

## Architecture

```
┌─────────────────────────────────────────┐
│         OFF-CHAIN (Prover)             │
│  compliance_credential.nr              │
│  private_settlement.nr                 │
│  ↓ Noir + Barretenberg UltraHonk       │
│  proof.bin (256 bytes)                 │
└────────────────┬────────────────────────┘
                 │ submit proof
┌────────────────▼────────────────────────┐
│         ON-CHAIN (Soroban)             │
│  UltraHonkVerifier (Protocol 26 BN254) │
│  CovenantRegistry (nullifiers, tiers)  │
│  CovenantSettlement (SAC transfer)     │
│  CovenantComplianceBridge (DEX path)   │
└─────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

---

## Repository Structure

```
covenant/
├── Cargo.toml                   Rust workspace
├── justfile                     Task runner
├── circuits/
│   ├── compliance_credential/   Noir circuit: KYC + sanctions + risk
│   └── private_settlement/      Noir circuit: balance + tier + amount
├── contracts/
│   ├── covenant_registry/       Credential registration + nullifier storage
│   ├── covenant_settlement/     Settlement execution + regulator audit
│   ├── covenant_compliance_bridge/  Cross-currency DEX settlement
│   └── ultrahonk_verifier/      BN254 proof verification (Protocol 26)
├── frontend/ (src/)             React + @stellar/stellar-sdk
├── scripts/
│   ├── deploy.sh                Stellar testnet deployment
│   └── generate_proof.sh        Noir proof generation
├── test/
│   └── integration_test.rs      End-to-end contract tests
└── docs/
    ├── ARCHITECTURE.md
    └── CIRCUITS.md
```

---

## Quick Start

### Prerequisites

```bash
# Noir + Barretenberg
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup --version 1.0.0-beta.9
bbup --version 0.87.0

# Stellar CLI
cargo install stellar-cli

# Node.js dependencies
pnpm install
```

### Run Frontend (Real Stellar Testnet)

```bash
# Start dev server (live Stellar testnet data)
pnpm run dev

# Testnet account: GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V
# XLM Balance: 10,000 (Friendbot funded)
```

### Generate ZK Proofs

```bash
# Compile + test circuits
just compile-circuits
just test-circuits

# Generate compliance credential proof
just prove-compliance

# Generate settlement proof
just prove-settlement
```

### Deploy to Testnet

```bash
# Build + deploy all contracts
just deploy
```

### Run Contract Tests

```bash
just test-contracts
```

---

## Circuits

### `compliance_credential.nr`

Proves KYC verification, sanctions clearance, and risk score without revealing identity:

```noir
fn main(
    kyc_hash: Field,
    sanctions_hash: Field,
    risk_score: u32,
    credential_secret: Field,
    // ... Merkle paths
    trusted_issuer_root: pub Field,
    negative_screening_root: pub Field,
    // ...
) -> pub (Field, u32, Field, Field) {
    // Constraints: KYC in trusted set, sanctions cleared,
    //              risk_score ≤ tier_threshold, expiry > now
    // Outputs: (nullifier, compliance_tier, addr_commitment, view_key_hash)
}
```

### `private_settlement.nr`

Proves balance sufficiency and tier-adjusted limits:

```noir
fn main(
    amount: u64,
    sender_balance: u64,
    compliance_tier: u32,
    // ...
) -> pub (Field, bool, Field, u64) {
    // Constraints: balance ≥ amount, amount ≤ tier_limit, tier valid
    // Outputs: (settlement_hash, attestation, sender_commitment, tier_limit)
}
```

See [docs/CIRCUITS.md](docs/CIRCUITS.md) for full specifications.

---

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `UltraHonkVerifier` | BN254 proof verification via Protocol 26 host functions |
| `CovenantRegistry` | Credential registration, nullifier storage, tier lookup |
| `CovenantSettlement` | ZK-gated SAC transfers + regulator audit portal |
| `CovenantComplianceBridge` | Cross-currency settlement via Stellar DEX path payment |

---

## Compliance Tier System

| Tier | Risk Score | Settlement Limit |
|------|-----------|-----------------|
| 5 (Platinum) | 0–10 | $1,000,000 |
| 4 (Gold) | 11–25 | $800,000 |
| 3 (Silver) | 26–50 | $600,000 |
| 2 (Bronze) | 51–75 | $400,000 |
| 1 (Basic) | 76–100 | $200,000 |

Tier is computed deterministically in the ZK circuit — the smart contract cannot override it.

---

## Testnet Account

| Property | Value |
|----------|-------|
| Public Key | `GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V` |
| Network | Stellar Testnet |
| Balance | 10,000 XLM |
| Explorer | [stellar.expert](https://stellar.expert/explorer/testnet/account/GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V) |

---

## Why This Wins

| Criterion | How Covenant Delivers |
|-----------|----------------------|
| **ZK is load-bearing** | Every settlement requires a valid UltraHonk proof — contracts reject without it |
| **Real-world problem** | Directly addresses the #1 barrier to institutional Stellar adoption |
| **Stellar-native** | Uses Protocol 26 BN254 host functions, native compliance primitives, SAC, DEX |
| **Technical sophistication** | Merkle proofs, range proofs, nullifiers, view keys, cross-contract verification |
| **Novelty** | No existing project combines ZK privacy with provable compliance on any chain |
| **Ecosystem fit** | Aligns with SDF's "configurable privacy" strategy and Nethermind's SPP work |

---

## Built For

**Stellar Hacks: Real-World ZK** · June 2026  
Deadline: June 29, 2026

**Tech Stack**: Noir 1.0-beta.9 · Barretenberg 0.87.0 · Soroban Protocol 26 · React 18 · @stellar/stellar-sdk

---

## License

MIT — See LICENSE file
