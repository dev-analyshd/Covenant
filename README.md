# Covenant — ZK Compliance Credentials on Stellar

> **Privacy with Provable Compliance** — Zero-knowledge verified cross-border stablecoin settlements on Stellar Testnet  
> 🏆 **Stellar Hacks: Real-World ZK · June 2026**

[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet%20Live-brightgreen?logo=stellar)](https://stellar.expert/explorer/testnet/account/GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V)
[![Noir](https://img.shields.io/badge/Noir-1.0--beta.9-7c3aed?logo=github)](https://noir-lang.org/)
[![Barretenberg](https://img.shields.io/badge/Barretenberg-0.87.0%20UltraHonk-6d28d9)](https://github.com/AztecProtocol/barretenberg)
[![Soroban](https://img.shields.io/badge/Soroban-Protocol%2026-0ea5e9)](https://developers.stellar.org/docs/smart-contracts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Covenant is a ZK-verifiable compliance credential system for institutional cross-border stablecoin settlement on Stellar. It allows institutions to prove KYC/AML compliance without revealing any personal data on-chain.

**The Covenant project lives in [`artifacts/covenant/`](artifacts/covenant/).** See the full README, architecture docs, and circuits there.

---

## Quick Links

| Resource | Link |
|----------|------|
| **Full README** | [`artifacts/covenant/README.md`](artifacts/covenant/README.md) |
| **Hackathon submission write-up** | [`artifacts/covenant/SUBMISSION.md`](artifacts/covenant/SUBMISSION.md) |
| **Demo video script** | [`artifacts/covenant/DEMO_SCRIPT.md`](artifacts/covenant/DEMO_SCRIPT.md) |
| **Architecture deep-dive** | [`artifacts/covenant/docs/ARCHITECTURE.md`](artifacts/covenant/docs/ARCHITECTURE.md) |
| **Circuit specifications** | [`artifacts/covenant/docs/CIRCUITS.md`](artifacts/covenant/docs/CIRCUITS.md) |
| **Noir circuits** | [`artifacts/covenant/circuits/`](artifacts/covenant/circuits/) |
| **Soroban contracts** | [`artifacts/covenant/contracts/`](artifacts/covenant/contracts/) |

---

## Deployed Contracts (Stellar Testnet)

| Contract | Address |
|----------|---------|
| `UltraHonkVerifier` | `CAURSBIA5JVEZTRDN2OATBLMQUUTNEDFKJUDHUB5KBDKF3JCGCT67VYW` |
| `CovenantRegistry` | `CDGVCDVWUZSCO4AIE34RVOEV7GUMZYGS7WN7PIJMZF5GN3K7WI3NZ7NJ` |
| `CovenantSettlement` | `CC2CNABDTKZ7ZJGZHP24IE43GNW7PUZPOUZJ6SNGMSLQVWEGQO62EKKI` |
| `CovenantComplianceBridge` | `CCHOTPRBSC52QENAQ7KTZN6BMYZG4JD3JOZ7GXPUVIA5X2LVF6QT3JP2` |

**Demo account**: [`GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V`](https://stellar.expert/explorer/testnet/account/GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V)

---

## What It Does

Stellar processes **$2.3B/month** in stablecoin volume. Every transaction is publicly visible. Institutions cannot use Stellar for settlement without exposing client identities (GDPR violation) — but regulators require proof of KYC/AML compliance.

**Covenant solves this with zero-knowledge proofs:**

- An institution generates a ZK proof that they have valid KYC, passed sanctions screening, and meet the risk tier — *without revealing any of that data on-chain*
- The Soroban `CovenantSettlement` contract executes the SAC token transfer *only after verifying the proof*
- Regulators can audit settlements selectively via a view key system — access is granted per-regulator, logged on-chain, non-repudiable

---

## ZK is Load-Bearing

**Without a valid UltraHonk proof, `CovenantSettlement.initiate_settlement()` reverts. There is no bypass.**

```rust
if !Self::verify_proof(&env, &proof, &public_inputs) {
    return Err(SettlementError::InvalidProof);
}
token_client.transfer(&sender, &recipient, &amount);
```

The two Noir circuits prove:
- `compliance_credential.nr` — 12,847 constraints: KYC Merkle membership, sanctions clearance, risk score ≤ tier threshold, credential not expired, non-zero source-of-funds commitment
- `private_settlement.nr` — 8,192 constraints: balance ≥ amount (range proof), amount ≤ tier-adjusted limit, valid compliance nullifier

Proof system: **UltraHonk** (Noir 1.0-beta.9 + Barretenberg 0.87.0), verified on-chain via Stellar **Protocol 26** BN254 host functions (`bn254_add`, `bn254_mul`, `bn254_pairing`).

---

## Running the Project

```bash
# Install dependencies
pnpm install

# Start the frontend (connects to Stellar Testnet automatically)
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/covenant run dev
# → http://localhost:5000

# Run circuit tests (requires Noir 1.0-beta.9)
cd artifacts/covenant/circuits/compliance_credential && nargo test
cd artifacts/covenant/circuits/private_settlement && nargo test
```

---

## Repository Structure

```
artifacts/covenant/
├── circuits/
│   ├── compliance_credential/src/main.nr   # 12,847-constraint Noir circuit
│   └── private_settlement/src/main.nr      # 8,192-constraint Noir circuit
├── contracts/
│   ├── ultrahonk_verifier/                 # BN254 pairing verifier (Protocol 26)
│   ├── covenant_registry/                  # Nullifier storage, credential lifecycle
│   ├── covenant_settlement/                # ZK-gated SAC transfers + regulator audit
│   └── covenant_compliance_bridge/         # Cross-currency DEX settlement
├── src/                                    # React frontend (5 tabs)
├── docs/                                   # Architecture + circuit specs
├── README.md                               # Full technical README
├── SUBMISSION.md                           # Hackathon judging write-up
└── DEMO_SCRIPT.md                          # 2-3 minute demo video script
```

---

## License

MIT © 2026
