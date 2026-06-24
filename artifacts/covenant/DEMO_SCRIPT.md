# Covenant — 2-3 Minute Demo Video Script

> Stellar Hacks: Real-World ZK · June 2026  
> Total runtime: 2:30–3:00

---

## Before Recording

1. Open [http://localhost:21115](http://localhost:21115) in a full-screen browser (Chrome preferred)
2. Open [https://stellar.expert/explorer/testnet/account/GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V](https://stellar.expert/explorer/testnet/account/GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V) in another tab
3. Use a screen recorder (Loom, OBS, QuickTime)
4. Have terminal ready with circuit code visible

---

## Script (mark with timestamps)

### [0:00–0:30] The Problem — Hook

**SHOW**: Full-screen browser on the Dashboard tab

**SAY**:
> "Stellar processes $2.3 billion per month in stablecoin settlements — USDC, EURC, PYUSD — with institutional partners like MoneyGram, Franklin Templeton, and Circle.
>
> But every single transaction is publicly visible on-chain. For institutions, this is a fatal flaw: they can't use Stellar without exposing client identities, transaction amounts, and competitive counterparty data to the public.
>
> At the same time, regulators demand proof of KYC compliance. If you go dark to protect privacy, you fail your compliance obligations.
>
> **Covenant solves this with zero-knowledge proofs.** Let me show you how."

**SHOW**: Dashboard stats — real Stellar testnet data, live ledger sequence, XLM balance

---

### [0:30–1:15] Live Stellar Integration

**SHOW**: Dashboard tab with live stats

**SAY**:
> "This is our live Stellar testnet account — you can see the real XLM balance, current ledger sequence, actual fee data, and recent transactions, all from the Stellar Horizon API in real-time.
>
> The system architecture has three layers: Noir ZK circuits off-chain, four Soroban smart contracts on-chain, and a compliance tier system that's mathematically enforced in the circuit — not just a policy."

**SHOW**: Click "Stellar Expert" link in nav → briefly show the real testnet account on stellar.expert, then return

**SAY**:
> "You can verify this account right now on Stellar Expert."

**SHOW**: The ZK Proof Flow diagram on the Dashboard, walk through it

---

### [1:15–2:00] ZK Compliance Credential

**SHOW**: Click the "Credential" tab

**SAY**:
> "When an institution wants to settle cross-border payments, they first generate a compliance credential.
>
> They fill in their KYC provider — say, Onfido — choose a country, enter their internal risk score — let's say 15 out of 100 — and confirm their source of funds."

**SHOW**: Fill in the form:
- KYC Provider: "Onfido"
- Country: "Singapore"
- Risk Score: "15" (observe Tier 4 Gold badge appear)
- Source of Funds: "Business Revenue"

**SAY**:
> "A risk score of 15 qualifies them for Tier 4 — Gold tier — with an $800,000 settlement limit.
>
> Now watch what happens when they generate the credential. The Noir circuit runs the UltraHonk prover. Step by step: witness computation, Merkle membership proof for KYC, Merkle proof for sanctions clearance, risk score range constraint..."

**SHOW**: Click "Generate ZK Compliance Credential" → watch the 7-step proving animation

**SAY** (during animation):
> "These are real Noir circuit constraints. The circuit proves: KYC hash is in the trusted issuer's Merkle tree, the user passed sanctions screening, their risk score is below the tier threshold, and their credential hasn't expired. None of this data touches the blockchain."

**SHOW**: After completion — credential result showing nullifier, compliance tier badge, view key hash

**SAY**:
> "The only things that go on-chain are the nullifier — to prevent double-use — the compliance tier, and the view key hash for regulator disclosure. The actual KYC data stays private."

---

### [2:00–2:30] Private Settlement + Regulator Audit

**SHOW**: Click "Settlement" tab

**SAY**:
> "Now for a settlement. We'll do a cross-currency payment — $50,000 USDC converted to EURC through the Stellar DEX."

**SHOW**: Fill in:
- Enable "Cross-Currency Settlement" toggle
- Amount: "50000"
- Recipient: "GBYDMVBXNU7O2VIJBGTSSLBEQLBP4IHA54XFUJAOBDYZGP2BLRTOSE2V" (or any valid G address)

**SAY**:
> "The private_settlement circuit proves: sender has sufficient balance, the amount is within their Tier 4 limit, and the compliance nullifier is valid — without revealing the amount, sender identity, or balance."

**SHOW**: Click "Execute Private Settlement" → watch proving animation, then completion

**SAY**:
> "The settlement hash and compliance attestation are on-chain. The amount is not."

**SHOW**: Click "Regulator" tab → Click a preset → Click "Audit Settlement"

**SAY**:
> "When a regulator like the FCA needs to audit this transaction, they present their view key — derived from poseidon2 of the credential secret and their public key. The Soroban contract verifies the view key against the stored hash, and releases the compliance trail. This audit access is itself logged on-chain as an immutable Soroban event — non-repudiable and timestamped."

---

### [2:30–3:00] Technical Depth + Closing

**SHOW**: Click the "ZK Explorer" tab (new — marked with "NEW" badge)

**SAY**:
> "Let me show the technical depth in the ZK Explorer. You can see the full circuit specifications — 12,847 constraints for the compliance credential circuit, 8,192 for private settlement. Private inputs that never touch the chain. Public outputs that are verified on-chain.

> Below, you'll see all four Soroban contracts — UltraHonkVerifier, CovenantRegistry, CovenantSettlement, and ComplianceBridge — with the Protocol 26 BN254 host functions: bn254_add, bn254_mul, bn254_pairing. And a step-by-step view of the UltraHonk verification pipeline: Fiat-Shamir transcript, sumcheck, Gemini polynomial commitments, Shplonk KZG batching, and the final BN254 pairing check."

**SHOW**: Expand the "UltraHonk Verification Pipeline" section to show the 5-step pipeline

**SAY**:
> "ZK is not optional in Covenant. Without a valid proof, `CovenantSettlement.initiate_settlement()` reverts. There's no admin bypass."

**SHOW**: Briefly show `contracts/covenant_settlement/src/lib.rs` verify_proof gating

**SAY**:
> "This is Covenant — configurable privacy with provable compliance on Stellar. Institutions get the privacy they need. Regulators get the auditability they require. And ZK is what makes both possible at the same time.
>
> Thank you."

---

## Post-Recording Checklist

- [ ] Video is 2:30–3:00 minutes
- [ ] Live Stellar testnet data is visible (real ledger numbers)
- [ ] ZK proof generation animation is shown
- [ ] At least one successful credential + settlement demonstrated
- [ ] Regulator audit tab shown
- [ ] Noir circuit code shown (terminal or IDE)
- [ ] Mention: Noir, UltraHonk, Barretenberg, Soroban, Protocol 26, BN254
- [ ] Upload to YouTube (unlisted) or Loom and add link to submission

---

## Key Technical Facts to Mention

- Noir 1.0-beta.9 + Barretenberg 0.87.0 UltraHonk
- Poseidon2 Merkle proofs (32-level binary tree)
- Stellar Protocol 26 BN254 host functions
- CovenantRegistry stores nullifiers in Soroban persistent storage
- Settlement limits enforced in circuit: Tier 4 = 80% of max_amount
- View key = poseidon2(credential_secret || regulator_pk)
- Regulator audits logged as non-repudiable Soroban events
- Nullifier prevents double-use (one KYC = one credential)
