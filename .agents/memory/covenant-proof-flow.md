---
name: Covenant proof flow
description: How real BN254 proof bytes flow end-to-end from proving API to on-chain Soroban calls
---

## The fix made (June 25 2026)

`registerCredential` and `initiateSettlement` in `contracts.ts` previously called `buildSimulatedProof()` internally, ignoring the real BN254 proof from the API. Fixed by adding `proofHex?: string` parameter to both functions.

## How it now works

1. Frontend calls `/api/prove/credential` → API returns 256-byte real BN254 proof as hex string
2. Frontend calls `/api/verify` → off-chain structural + curve verification
3. Frontend calls `registerCredential({ ..., proofHex: proofResult.proof })` → real proof bytes submitted to CovenantRegistry on-chain
4. Same for settlement: `/api/prove/settlement` → `initiateSettlement({ ..., proofHex })` → CovenantSettlement on-chain

## Settlement dual-path

SettlementPanel calls BOTH:
- `sendPayment({ toPublic, amount: "0.001", memo: settlementHash })` — real 0.001 XLM Stellar payment
- `initiateSettlement({ ..., proofHex })` — Soroban contract call with real ZK proof

Both are wrapped in try/catch. Either succeeding sets `onChain = true`.

## Proof byte handling in contracts.ts

When `proofHex` is provided: hex→Uint8Array, padded to 256 bytes if shorter.
When absent: falls back to `buildSimulatedProof()`.

**Why:** The API proof is already 256 bytes (confirmed by the `buildBN254Proof` function in prove.ts), so padding is a safety net only.
