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
| CovenantRegistry | `CBHH4GISNRX2NWE7OQA4CK26JPRTLI5QXSZVBE7MQJGLI5SYWUOY4H2S` |
| CovenantSettlement | `CCBD23TQUGAD7YPVZCDVM6UKYVKXQYGPR3JWKVNFKRUWM2GNQEAG5ODA` |
| UltraHonkVerifier | `CC66GX7NOKUVE7GBU56E5Z3BEOFEPNJ7VEN7DSB5ZS3NDCHDAFGUR257` |
| ComplianceBridge | `CDXXIBLVGZWJ7BCPXC423RPWTVSE43KHIVYBMPVMPPOJFZFDI7VZRLBE` |

- Deployer: `GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V` (demo/compromised keypair, testnet only)
- Deployed at: 2026-06-25T00:05:09.286Z
- `contract-ids.json` in `artifacts/covenant/public/` — served by Vite, loads at runtime via `getContractIds()`

## WASM Files

Compiled in `artifacts/covenant/target/wasm32-unknown-unknown/release/`:
- `covenant_registry.wasm` (5938 bytes)
- `covenant_settlement.wasm` (7889 bytes)
- `ultrahonk_verifier.wasm` (3880 bytes)
- `covenant_compliance_bridge.wasm` (5566 bytes)

## Frontend Status (post-audit June 25 2026)

All 5 tabs complete and TypeScript-clean (0 errors):
1. **Dashboard** — live Horizon data + all 4 deployed contract addresses with Stellar Expert links  
2. **Credential** — `registerCredential()` calls CovenantRegistry on-chain via Soroban RPC  
3. **Settlement** — wired to proving API (`proveSettlement`) + off-chain verification + real XLM tx  
4. **Regulator** — audit settlement + issuer root governance (fixed `contractIds.contracts` bug)  
5. **ZK Explorer** — circuit explainer  

## Key Technical Facts

- `@stellar/stellar-sdk/rpc` v16: `GetTransactionStatus` is at `Api.GetTransactionStatus` (NOT top-level)
- Deploy script `scripts/deploy-node.mjs` must be run from within covenant package dir for stellar-sdk access
- Test script `scripts/test-onchain.mjs` must also be run as `cd artifacts/covenant && node test-onchain.mjs`
- `StellarRpc.Api.isSimulationError(sim)` is the correct check for simulation errors
- `prove/credential` API requires `kycProvider`, `riskScore`, `sourceOfFunds`, `country`, `credentialSecret` (NOT `provider`/`risk`/`sof`)
- `update_issuer_root` only accepts canonical `0101...01` pattern on testnet — non-canonical roots fail with `WasmVm::InvalidAction` (contract WASM validation restriction, not fixable without recompile)

## 50-Interaction Test Results (June 25 2026)

Ran `scripts/test-onchain.mjs` — **48/50 pass (96%)**

| Section | Tests | Result |
|---|---|---|
| Stellar Horizon reads | 5 | ✅ All pass |
| XLM on-chain payments (real txns) | 10 | ✅ All pass |
| Proving API (credential) | 6 | ✅ All pass |
| Off-chain proof verification | 5 | ✅ All pass |
| Settlement proving API | 5 | ✅ All pass |
| ASP deposit/withdraw/audit | 7 | ✅ All pass |
| Soroban contract reads (sim) | 4 | ✅ All pass |
| Soroban register_credential (real txns) | 3 | ✅ All pass |
| Soroban update_issuer_root (real txns) | 3 | 1 pass, 2 fail (WasmVm::InvalidAction) |
| Credential store API | 2 | ✅ All pass |

## Production Issues Status

1. ✅ WASM compilation — all 4 contracts compiled successfully
2. ✅ Deploy script fixed — all contracts deployed, IDs in `public/contract-ids.json`
3. ✅ `contracts.ts` — hardcoded real IDs as fallback, correct Soroban helpers
4. ✅ `SettlementPanel.tsx` — wired to proving API, shows off-chain verification badge
5. ✅ `RegulatorPanel.tsx` — fixed `contractIds.contracts?.` → `contractIds?.` bug
6. ⚠️ UltraHonkVerifier — structural proof check only (no full BN254 pairing), cannot change without Rust recompile
