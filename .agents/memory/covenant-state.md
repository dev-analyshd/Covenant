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
- `contract-ids.json` is in both `artifacts/covenant/` and `artifacts/covenant/public/` (served by Vite)

## WASM Files

Compiled in `artifacts/covenant/target/wasm32-unknown-unknown/release/`:
- `covenant_registry.wasm` (5938 bytes)
- `covenant_settlement.wasm` (7889 bytes)
- `ultrahonk_verifier.wasm` (3880 bytes)
- `covenant_compliance_bridge.wasm` (5566 bytes)

## Frontend Status

All 5 tabs complete and TypeScript-clean (0 errors):
1. **Dashboard** — live Horizon data + all 4 deployed contract addresses with Stellar Expert links
2. **Credential** — `registerCredential()` calls CovenantRegistry on-chain via Soroban RPC
3. **Settlement** — `initiateSettlement()` calls CovenantSettlement + real XLM payment as memo carrier
4. **Regulator** — audit settlement + issuer root governance (update_issuer_root on-chain)
5. **ZK Explorer** — circuit explainer (not modified)

## Key Technical Facts

- `@stellar/stellar-sdk/rpc` v16: `GetTransactionStatus` is at `Api.GetTransactionStatus` (NOT top-level)
- Deploy script `scripts/deploy-node.mjs` must be run synchronously (not backgrounded) — background processes in Replit bash get killed when parent shell times out
- Correct run: `cd artifacts/covenant && node scripts/deploy-node.mjs` with bash timeout ≥ 120000ms
- `StellarRpc.Api.isSimulationError(sim)` is the correct check for simulation errors
- Soroban RPC `getLedgerEntries` with `scvLedgerKeyContractInstance` key is how to verify contract exists on-chain
- Soroban testnet confirms transactions in 1-2 polls (3s each), WASM uploads in 2 polls max

## Production Issues Status (5 original issues)

1. ✅ WASM compilation — all 4 contracts compiled successfully
2. ✅ Deploy script fixed — `Api.GetTransactionStatus` bug resolved, all contracts deployed
3. ✅ Frontend contracts.ts — `RpcApi.GetTransactionStatus` fixed, 0 TypeScript errors
4. ✅ contract-ids.json in `public/` — served by Vite, `getContractIds()` works
5. ✅ RegulatorPanel governance — Issuer Root Governance tab added with `updateIssuerRoot()` on-chain call
