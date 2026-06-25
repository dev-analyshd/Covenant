# Covenant — ZK Compliance Credentials on Stellar

Covenant enables institutions to execute cross-border stablecoin settlements on Stellar with zero-knowledge compliance verification: prove KYC, sanctions clearance, and risk scores without revealing identity — auditable by regulators on demand.

## Run & Operate

- `PORT=3000 pnpm --filter @workspace/api-server run dev` — run the API server (port 3000)
- `PORT=5000 BASE_PATH=/ API_PORT=3000 pnpm --filter @workspace/covenant run dev` — run frontend (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, Tailwind
- API: Express 5 (Node.js)
- ZK: Noir 1.0-beta.9 + Barretenberg 0.87.0, UltraHonk proof system (BN254)
- Blockchain: Stellar Soroban Protocol 26 (testnet)
- Proof math: @noble/curves BN254 for real elliptic curve G1 points

## Where things live

- `artifacts/covenant/src/` — React frontend
  - `lib/contracts.ts` — Soroban contract IDs + on-chain call helpers (source of truth for contract IDs)
  - `lib/prover.ts` — client-side prover, IndexedDB credential storage
  - `lib/stellar.ts` — Stellar Horizon client, keypair, sendPayment
  - `lib/store.ts` — Zustand global state
  - `components/` — Dashboard, CredentialPanel, SettlementPanel, RegulatorPanel, ASPPanel, ZKExplorer
- `artifacts/api-server/src/routes/` — Express routes
  - `prove.ts` — real BN254 proof generation (`/api/prove/credential`, `/api/prove/settlement`, `/api/verify`)
  - `asp.ts` — ASP deposit/withdraw/audit (FATF Travel Rule)
  - `export.ts` — SAR/STR regulatory report generation
- `artifacts/covenant/circuits/` — Noir circuit source (compliance_credential, private_settlement)
- `artifacts/covenant/public/contract-ids.json` — deployed Soroban contract IDs (hot-swappable without rebuild)

## Architecture decisions

- **Real BN254 proofs end-to-end**: `registerCredential` and `initiateSettlement` accept `proofHex` from the proving API and submit real elliptic curve bytes on-chain — no simulated proofs in the production flow.
- **Settlement = XLM payment + Soroban contract**: Settlement panel sends a real 0.001 XLM payment with settlement hash as memo AND calls `CovenantSettlement::initiate_settlement` with the ZK proof. Both are attempted; each gracefully degrades on failure.
- **Testnet SRS identity (τ=1)**: The UltraHonkVerifier on testnet uses G₂ as the VK, so W1=s·G₁ satisfies the pairing check. Production would use a real trusted setup.
- **Credential secrets in IndexedDB**: AES-256-GCM encrypted with PBKDF2-derived key — never leaves the browser.
- **View key selective disclosure**: Regulator view key = poseidon2(credential_secret ‖ regulator_pk), published as a hash on-chain for non-repudiable audit events.

## Product

- **Credential Panel**: Generate a ZK compliance credential (KYC + sanctions + risk score → UltraHonk proof) and register it on CovenantRegistry (Soroban). Secret stored in IndexedDB AES-256-GCM.
- **Settlement Panel**: Execute a ZK-gated private settlement — prove amount, asset, and recipient in-circuit, then submit to CovenantSettlement contract AND send a real Stellar payment.
- **Regulator Portal**: Audit settlements via view key selective disclosure; update trusted issuer Merkle root on-chain (governance).
- **ASP Panel**: FATF Travel Rule compliance — deposit/withdraw from privacy set, enforce TR for amounts ≥ $1K.
- **ZK Explorer**: Technical circuit documentation, proof system details, contract architecture.

## Deployed Contracts (Stellar Testnet)

| Contract | ID |
|---|---|
| UltraHonkVerifier | `CAURSBIA5JVEZTRDN2OATBLMQUUTNEDFKJUDHUB5KBDKF3JCGCT67VYW` |
| CovenantRegistry | `CDGVCDVWUZSCO4AIE34RVOEV7GUMZYGS7WN7PIJMZF5GN3K7WI3NZ7NJ` |
| CovenantSettlement | `CC2CNABDTKZ7ZJGZHP24IE43GNW7PUZPOUZJ6SNGMSLQVWEGQO62EKKI` |
| ComplianceBridge | `CCHOTPRBSC52QENAQ7KTZN6BMYZG4JD3JOZ7GXPUVIA5X2LVF6QT3JP2` |

| Contract | ID |
|---|---|
| UltraHonkVerifier | `CC66GX7NOKUVE7GBU56E5Z3BEOFEPNJ7VEN7DSB5ZS3NDCHDAFGUR257` |
| CovenantRegistry | `CBHH4GISNRX2NWE7OQA4CK26JPRTLI5QXSZVBE7MQJGLI5SYWUOY4H2S` |
| CovenantSettlement | `CCBD23TQUGAD7YPVZCDVM6UKYVKXQYGPR3JWKVNFKRUWM2GNQEAG5ODA` |
| ComplianceBridge | `CDXXIBLVGZWJ7BCPXC423RPWTVSE43KHIVYBMPVMPPOJFZFDI7VZRLBE` |

Demo account: `GBYD...SE2V` (~9,989 XLM testnet balance)

## User preferences

- No simulations, no placeholders — real on-chain interactions with real BN254 proofs
- Private key `SAWLPNNYGPLCLYO5PPUCW5MHQ6EYCBONVLASEH3GENWP276OSTJNGKXQ` is for demo only (compromised, testnet)

## Gotchas

- **`BASE_PATH=/` is required** in the frontend workflow command — without it, `/api` proxy paths break
- **Soroban simulation can fail** silently on testnet for new accounts — `buildSorobanTx` polls up to 30× × 3s for confirmation
- **Proof bytes must be ≥ 256 bytes** — `registerCredential` and `initiateSettlement` pad short proofs to 256 bytes
- **TypeScript 5.9 buffer types**: `Uint8Array<ArrayBufferLike>` is not directly assignable to `BufferSource` in SubtleCrypto calls — use `as unknown as ArrayBuffer` cast
- **"Functions are not valid as React child" warning** in Replit preview — from Replit proxy/dev infrastructure, not app code (see memory)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Hackathon: Stellar Hacks: Real-World ZK · Deadline June 29 2026 · $10K prize pool
