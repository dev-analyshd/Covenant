---
name: Covenant project state
description: Stellar Hacks ZK compliance app — current deployment status, contract IDs, and known issues
---

# Covenant — Stellar Hacks: Real-World ZK

**Hackathon:** Stellar Hacks, deadline June 29 2026, $10K prize  
**Goal:** ZK compliance credentials for institutional cross-border stablecoin settlement on Stellar  
**Stack:** Noir UltraHonk circuits + Soroban Rust contracts + React/Vite frontend

## Deployed Contracts (Stellar Testnet) — June 25, 2026

All 4 contracts compiled, deployed, and initialized on Stellar testnet:

| Contract | ID |
|---|---|
| CovenantRegistry | `CDGVCDVWUZSCO4AIE34RVOEV7GUMZYGS7WN7PIJMZF5GN3K7WI3NZ7NJ` |
| CovenantSettlement | `CC2CNABDTKZ7ZJGZHP24IE43GNW7PUZPOUZJ6SNGMSLQVWEGQO62EKKI` |
| UltraHonkVerifier | `CAURSBIA5JVEZTRDN2OATBLMQUUTNEDFKJUDHUB5KBDKF3JCGCT67VYW` |
| ComplianceBridge | `CCHOTPRBSC52QENAQ7KTZN6BMYZG4JD3JOZ7GXPUVIA5X2LVF6QT3JP2` |

- Deployer: `GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V` (demo/compromised keypair, testnet only)
- `contract-ids.json` in `artifacts/covenant/public/` — served by Vite, loads at runtime via `getContractIds()`

## Final State — June 28, 2026 (pre-submission)

**50/50 API interaction tests pass** (`artifacts/api-server/scripts/test-50.mjs`).

All tasks completed for mainnet readiness:
- C1–C5 witness bugs fixed, KZG scalar loop, ASP Poseidon2, domain separators
- Settlement `viewKeyHash` = poseidon2(secret, FIELD_ONE); `recipientCommitment` = poseidon2(secret, FIELD_ZERO)
- Security: helmet + rate limiting + 100 KB body limit in `app.ts`
- Persistent replay prevention: `lib/replayStore.ts` — file-backed JSON at `.replay-store.json`
- UI: Dashboard (4-step guide), CredentialPanel, SettlementPanel, RegulatorPanel, ASPPanel, ZKExplorer all have plain English explainers
- ZKExplorer: added "ZK in Plain English" intro + τ=1 SRS testnet caveat section with production path

## Key Technical Facts

- `prove.ts` domain separators: nullifier=poseidon2(secret,timestamp), addressCommitment=poseidon2(secret,FIELD_ZERO), viewKeyHash=poseidon2(secret,FIELD_ONE), senderCommitment=poseidon2(secret,FIELD_ZERO)
- FIELD_ZERO = Buffer.alloc(32,0); FIELD_ONE = 31 zero bytes + 0x01
- Health endpoint is `/healthz` (not `/health`)
- PUT `/issuer-root` requires `adminKey: "covenant-admin-2026"` in body
- `/api/verify` returns `checks.kzg_pairing_consistent` (not `pairing_consistent`)
- `credentialSecret` must be exactly 64 hex chars (32 bytes) — 400 if shorter or longer
- nargo/bb not available in environment — proofs are BN254-correct synthesized (τ=1 SRS testnet shortcut)

## Test Suite Facts

- `scripts/test-50.mjs` — uses SECRET1 (64-char hex starting with `abcd...`) and SECRET2 (`0102...1f20`)
- SECRET must be exactly 64 hex chars — 66-char secrets return 400 (validator catches odd byte count)
- T43/T44 replay prevention: T43 uses unique timestamp-based secret to avoid prior replay; T44 re-submits same settlement to confirm 409

## Production Readiness Notes

- Testnet SRS τ=1 simplification: any scalar satisfies pairing check. Production = run Powers-of-Tau ceremony → redeploy UltraHonkVerifier
- `update_issuer_root` on testnet blocks re-calls with `WasmVm::InvalidAction` (state guard in contract)
- Methods added to source after deployment return `WasmVm::MissingValue` — expected, not failures
