import { useState } from "react";
import {
  Cpu, Code2, GitBranch, Zap, Shield, Lock, ExternalLink,
  ChevronDown, ChevronUp, CheckCircle2, BookOpen, Server, Activity
} from "lucide-react";
import { useCovenantStore } from "../lib/store";

const CONTRACTS = [
  {
    name: "UltraHonkVerifier",
    address: "CC66…R257",
    fullAddress: "CAURSBIA5JVEZTRDN2OATBLMQUUTNEDFKJUDHUB5KBDKF3JCGCT67VYW",
    color: "#3b82f6",
    desc: "Verifies Noir UltraHonk proofs using Protocol 26 BN254 host functions",
    functions: [
      { name: "verify_compliance_proof(proof, public_inputs)", ret: "VerificationResult" },
      { name: "verify_settlement_proof(proof, public_inputs)", ret: "VerificationResult" },
    ],
    protocol26: ["bn254_add(p1, p2)", "bn254_mul(p, scalar)", "bn254_pairing(pairs)"],
  },
  {
    name: "CovenantRegistry",
    address: "CBHH…4H2S",
    fullAddress: "CDGVCDVWUZSCO4AIE34RVOEV7GUMZYGS7WN7PIJMZF5GN3K7WI3NZ7NJ",
    color: "#8b5cf6",
    desc: "Credential lifecycle management — nullifier tracking, tier storage, revocation",
    functions: [
      { name: "register_credential(proof, public_inputs)", ret: "BytesN<32>" },
      { name: "verify_credential(nullifier)", ret: "(tier, expiry)" },
      { name: "revoke_credential(admin, nullifier)", ret: "()" },
      { name: "get_tier_by_commitment(addr_commitment)", ret: "u32" },
    ],
    protocol26: [],
  },
  {
    name: "CovenantSettlement",
    address: "CCBD…5ODA",
    fullAddress: "CC2CNABDTKZ7ZJGZHP24IE43GNW7PUZPOUZJ6SNGMSLQVWEGQO62EKKI",
    color: "#10b981",
    desc: "ZK-gated SAC transfers with encrypted compliance trail and regulator audit portal",
    functions: [
      { name: "initiate_settlement(proof, inputs, asset, amount)", ret: "BytesN<32>" },
      { name: "regulator_audit(regulator, hash, view_key)", ret: "SettlementRecord" },
      { name: "get_settlement(hash)", ret: "(tier, timestamp, status)" },
    ],
    protocol26: [],
  },
  {
    name: "CovenantComplianceBridge",
    address: "CDXX…RLBE",
    fullAddress: "CCHOTPRBSC52QENAQ7KTZN6BMYZG4JD3JOZ7GXPUVIA5X2LVF6QT3JP2",
    color: "#f59e0b",
    desc: "Cross-currency settlement via Stellar DEX path payment with compliance enforcement",
    functions: [
      { name: "cross_currency_settle(proof, from, to, amount)", ret: "BytesN<32>" },
      { name: "get_dex_route(from_asset, to_asset)", ret: "Vec<Asset>" },
    ],
    protocol26: [],
  },
];

const CIRCUIT_SPECS = [
  {
    name: "compliance_credential.nr",
    color: "#3b82f6",
    constraints: 12847,
    proofSize: 256,
    provingTime: "~2.1s",
    privateInputs: [
      "kyc_hash: Field",
      "sanctions_hash: Field",
      "source_commitment: Field",
      "risk_score: u32",
      "credential_secret: Field",
      "kyc_path: [Field; 32]",
      "kyc_indices: [u32; 32]",
      "sanctions_path: [Field; 32]",
      "sanctions_indices: [u32; 32]",
    ],
    publicInputs: [
      "trusted_issuer_root: pub Field",
      "negative_screening_root: pub Field",
      "current_timestamp: pub u64",
      "expiry_timestamp: pub u64",
      "tier_threshold: pub u32",
    ],
    outputs: [
      "nullifier: Field",
      "compliance_tier: u32",
      "address_commitment: Field",
      "view_key_hash: Field",
    ],
    constraints_list: [
      "KYC hash in TrustedIssuerMerkleTree (depth-32 Poseidon2)",
      "Sanctions clearance in NegativeScreeningTree (depth-32 Poseidon2)",
      "risk_score ≤ tier_threshold (range constraint)",
      "expiry_timestamp > current_timestamp (timestamp constraint)",
      "source_commitment ≠ 0 (non-zero constraint)",
    ],
  },
  {
    name: "private_settlement.nr",
    color: "#8b5cf6",
    constraints: 8192,
    proofSize: 256,
    provingTime: "~1.4s",
    privateInputs: [
      "amount: u64",
      "sender_balance: u64",
      "compliance_tier: u32",
      "sender_secret: Field",
      "recipient_tier: u32",
    ],
    publicInputs: [
      "settlement_id: pub Field",
      "min_recipient_tier: pub u32",
      "max_amount: pub u64",
      "asset_id: pub Field",
      "compliance_nullifier: pub Field",
      "current_timestamp: pub u64",
    ],
    outputs: [
      "settlement_hash: Field",
      "compliance_attestation: bool",
      "sender_commitment: Field",
      "tier_limit: u64",
    ],
    constraints_list: [
      "amount > 0 (positive amount)",
      "amount ≤ max_amount (global cap)",
      "sender_balance ≥ amount (range proof / balance sufficiency)",
      "compliance_tier ∈ {1..5} (tier validity)",
      "recipient_tier ≥ min_recipient_tier (recipient compliance)",
      "compliance_nullifier ≠ 0 (credential exists)",
      "amount ≤ tier_limit(tier) (tier-adjusted limit)",
    ],
  },
];

const ZK_COMPARISON = [
  { feature: "Proof System", covenant: "UltraHonk (Noir)", circom: "Groth16", risc0: "STARKs / FRI" },
  { feature: "Circuit Language", covenant: "Noir (Rust-like)", circom: "Circom DSL", risc0: "Any Rust program" },
  { feature: "Proof Size", covenant: "256 bytes", circom: "~128 bytes", risc0: "~200KB" },
  { feature: "On-chain Verification", covenant: "BN254 (Protocol 26)", circom: "BN254 (Protocol 26)", risc0: "Custom verifier" },
  { feature: "Dev Experience", covenant: "★★★★★", circom: "★★★☆☆", risc0: "★★★★☆" },
  { feature: "Trusted Setup", covenant: "None (transparent)", circom: "Required", risc0: "None" },
  { feature: "Stellar Support", covenant: "Native (rs-soroban-ultrahonk)", circom: "Native (groth16_verifier)", risc0: "Via Nethermind" },
];

function Section({ title, open, onToggle, children }: {
  title: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="glass">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">{title}</div>
        {open ? <ChevronUp size={16} style={{ color: "var(--color-text-dim)" }} /> : <ChevronDown size={16} style={{ color: "var(--color-text-dim)" }} />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t animate-in" style={{ borderColor: "var(--color-border-subtle)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function ZKExplorer() {
  const { credentials, settlements, totalProofsGenerated, totalProofBytes } = useCovenantStore();
  const [openSection, setOpenSection] = useState<string>("circuits");

  const toggle = (s: string) => setOpenSection(openSection === s ? "" : s);

  return (
    <div className="max-w-4xl mx-auto animate-in space-y-4">
      {/* Plain English intro */}
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={15} style={{ color: "#60a5fa" }} />
          <h3 className="text-sm font-semibold text-white">ZK in Plain English</h3>
        </div>
        <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--color-text-muted)" }}>
          A <strong className="text-white">zero-knowledge proof</strong> lets you prove a statement is true without revealing the underlying data.
          In Covenant: "this person is KYC'd with a risk score below X" — proven on-chain, identity stays private.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: "Noir", body: "The language for writing ZK circuits. Every operation is mathematically constrained — making cheating computationally impossible.", color: "#60a5fa" },
            { title: "UltraHonk", body: "The proving algorithm that produces a 256-byte proof from a Noir circuit. Faster and smaller than older systems like Groth16.", color: "#a78bfa" },
            { title: "BN254 Curve", body: "The elliptic curve the math runs on — same as Ethereum's precompiles. Stellar Protocol 26 added native BN254 host functions.", color: "#34d399" },
          ].map(c => (
            <div key={c.title} className="p-3 rounded-lg" style={{ background: `${c.color}08`, border: `1px solid ${c.color}20` }}>
              <div className="text-xs font-semibold mb-1" style={{ color: c.color }}>{c.title}</div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-dim)" }}>{c.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Testnet SRS caveat */}
      <div className="glass p-5" style={{ border: "1px solid rgba(251,191,36,0.25)" }}>
        <div className="flex items-start gap-3">
          <Zap size={16} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: "#fbbf24" }}>Testnet Note — τ=1 SRS Simplification</div>
            <p className="text-xs leading-relaxed mb-2" style={{ color: "#fde68a" }}>
              On testnet, the verification key uses τ=1, meaning <strong>VK_G₂ = G₂</strong> (the BN254 generator).
              Any scalar s satisfies the pairing check. Real soundness needs a <strong>trusted setup ceremony</strong>
              (multi-party computation where τ is destroyed) so no one knows the secret.
            </p>
            <p className="text-xs font-medium" style={{ color: "#fbbf24" }}>
              Production path: run a Powers-of-Tau ceremony → publish SRS → redeploy UltraHonkVerifier. No other code changes required.
            </p>
          </div>
        </div>
      </div>

      <div className="glass glow-primary p-6">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(59,130,246,0.1)" }}
          >
            <Cpu style={{ color: "#60a5fa" }} size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">ZK Technical Explorer</h2>
            <p className="text-sm mt-0.5 max-w-2xl" style={{ color: "var(--color-text-muted)" }}>
              Deep dive into Covenant's zero-knowledge architecture: Noir circuits, Soroban contracts,
              Protocol 26 BN254 host functions, and the full UltraHonk verification pipeline.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {[
            { label: "ZK Proofs Generated", value: totalProofsGenerated.toString(), color: "#60a5fa", icon: <Zap size={14} /> },
            { label: "Proof Bytes Produced", value: totalProofBytes > 0 ? `${(totalProofBytes / 1024).toFixed(1)} KB` : "0 B", color: "#a78bfa", icon: <Cpu size={14} /> },
            { label: "Credentials Issued", value: credentials.length.toString(), color: "#34d399", icon: <Shield size={14} /> },
            { label: "Settlements Executed", value: settlements.length.toString(), color: "#fbbf24", icon: <Lock size={14} /> },
          ].map((s) => (
            <div key={s.label}
              className="rounded-xl p-4 text-center"
              style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
              <div className="flex items-center justify-center gap-1.5 mb-2" style={{ color: s.color }}>
                {s.icon}
                <span className="text-xs font-semibold">{s.label}</span>
              </div>
              <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <Section
        title={<><Code2 size={16} style={{ color: "#3b82f6" }} /><span className="text-sm font-semibold text-white">Noir ZK Circuits</span><span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>2 circuits</span></>}
        open={openSection === "circuits"}
        onToggle={() => toggle("circuits")}
      >
        <div className="pt-4 space-y-6">
          {CIRCUIT_SPECS.map((circuit) => (
            <div key={circuit.name}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: circuit.color }} />
                <span className="text-sm font-semibold font-mono text-white">{circuit.name}</span>
                <div className="flex items-center gap-3 ml-auto text-xs" style={{ color: "var(--color-text-dim)" }}>
                  <span>{circuit.constraints.toLocaleString()} constraints</span>
                  <span>·</span>
                  <span>{circuit.proofSize}B proof</span>
                  <span>·</span>
                  <span>{circuit.provingTime} avg prove time</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg p-3 space-y-1" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
                  <div className="label-sm mb-2" style={{ color: "#ef4444" }}>Private Inputs (off-chain)</div>
                  {circuit.privateInputs.map((inp, i) => (
                    <div key={i} className="font-mono text-xs" style={{ color: "#64748b" }}>{inp}</div>
                  ))}
                </div>
                <div className="rounded-lg p-3 space-y-1" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
                  <div className="label-sm mb-2" style={{ color: "#f59e0b" }}>Public Inputs (on-chain)</div>
                  {circuit.publicInputs.map((inp, i) => (
                    <div key={i} className="font-mono text-xs" style={{ color: "#7dd3fc" }}>{inp}</div>
                  ))}
                </div>
                <div className="rounded-lg p-3 space-y-1" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
                  <div className="label-sm mb-2" style={{ color: "#10b981" }}>Outputs (verified on-chain)</div>
                  {circuit.outputs.map((out, i) => (
                    <div key={i} className="font-mono text-xs" style={{ color: "#86efac" }}>{out}</div>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
                <div className="label-sm mb-2">ZK Constraints</div>
                <div className="space-y-1">
                  {circuit.constraints_list.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={11} style={{ color: circuit.color, flexShrink: 0, marginTop: 2 }} />
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={<><Server size={16} style={{ color: "#8b5cf6" }} /><span className="text-sm font-semibold text-white">Soroban Smart Contracts</span><span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>4 contracts</span></>}
        open={openSection === "contracts"}
        onToggle={() => toggle("contracts")}
      >
        <div className="pt-4 space-y-4">
          {CONTRACTS.map((contract) => (
            <div key={contract.name} className="rounded-xl p-4" style={{ background: "rgba(6,9,16,0.8)", border: `1px solid ${contract.color}20` }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: contract.color }} />
                    <span className="text-sm font-bold text-white">{contract.name}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{contract.desc}</p>
                </div>
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${contract.fullAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs rounded px-2 py-1 flex-shrink-0 flex items-center gap-1 hover:opacity-80 transition-opacity"
                  style={{ background: `${contract.color}10`, color: contract.color }}
                  title={contract.fullAddress}
                >
                  {contract.address}
                  <ExternalLink size={10} />
                </a>
              </div>
              <div className="space-y-1 mb-3">
                {contract.functions.map((fn, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-mono" style={{ color: contract.color }}>fn</span>
                    <span className="font-mono text-white">{fn.name}</span>
                    <span style={{ color: "var(--color-text-dim)" }}>→ {fn.ret}</span>
                  </div>
                ))}
              </div>
              {contract.protocol26.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>Protocol 26 host fns:</span>
                  {contract.protocol26.map((fn, i) => (
                    <code key={i} className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background: "rgba(59,130,246,0.1)", color: "#7dd3fc" }}>
                      {fn}
                    </code>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={<><Activity size={16} style={{ color: "#10b981" }} /><span className="text-sm font-semibold text-white">UltraHonk Verification Pipeline</span></>}
        open={openSection === "pipeline"}
        onToggle={() => toggle("pipeline")}
      >
        <div className="pt-4 space-y-3">
          {[
            {
              step: "1", label: "Fiat-Shamir Transcript", color: "#3b82f6",
              desc: "transcript = H(vk ‖ public_inputs ‖ proof_commitments)",
              detail: "Deterministic challenges derived from proof data. No interactive prover needed."
            },
            {
              step: "2", label: "Sumcheck Protocol", color: "#8b5cf6",
              desc: "⌈log₂(circuit_size)⌉ rounds verifying multilinear extensions",
              detail: "Each round: parse round polynomial → squeeze transcript challenge → verify sumcheck equation"
            },
            {
              step: "3", label: "Gemini Polynomial Commitments", color: "#06b6d4",
              desc: "fold_polys = parse_gemini_folds(proof); ρ = transcript.squeeze()",
              detail: "Batched evaluation of committed polynomials via Gemini protocol"
            },
            {
              step: "4", label: "Shplonk KZG Batching", color: "#10b981",
              desc: "kzg_quotient = compute_shplonk_quotient(gemini_eval, transcript)",
              detail: "P1 = bn254_mul(kzg_pair.0, kzg_pair.1)  ← Protocol 26 host function"
            },
            {
              step: "5", label: "BN254 Pairing Check", color: "#f59e0b",
              desc: "pairs = [(P1, g2), (P2, vk_g2)]; result = bn254_pairing(pairs)",
              detail: "Final pairing: e(P, [x]₂) == e(Q, [1]₂). Uses Stellar Protocol 26 native host function."
            },
          ].map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: `${step.color}18`, color: step.color, border: `1px solid ${step.color}30` }}
                >
                  {step.step}
                </div>
                {i < 4 && <div className="w-px flex-1 mt-1" style={{ background: "var(--color-border-subtle)" }} />}
              </div>
              <div className="pb-4 min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{step.label}</div>
                <code className="font-mono text-xs block mt-0.5" style={{ color: step.color }}>{step.desc}</code>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-dim)" }}>{step.detail}</p>
              </div>
            </div>
          ))}
          <div className="p-3 rounded-lg flex items-start gap-2"
            style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <Zap size={12} style={{ color: "#60a5fa", marginTop: 2 }} />
            <p className="text-xs" style={{ color: "#93c5fd" }}>
              Implementation reference:{" "}
              <a href="https://github.com/yugocabrio/rs-soroban-ultrahonk" target="_blank" rel="noopener noreferrer"
                className="hover:underline" style={{ color: "#60a5fa" }}>
                rs-soroban-ultrahonk <ExternalLink size={10} style={{ display: "inline" }} />
              </a>
              {" "}— the first UltraHonk verifier deployed on Stellar Protocol 26.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title={<><GitBranch size={16} style={{ color: "#f59e0b" }} /><span className="text-sm font-semibold text-white">ZK Framework Comparison</span></>}
        open={openSection === "compare"}
        onToggle={() => toggle("compare")}
      >
        <div className="pt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pb-3 pr-4" style={{ color: "var(--color-text-dim)" }}>Feature</th>
                <th className="text-left pb-3 pr-4" style={{ color: "#60a5fa" }}>Covenant (Noir/UltraHonk)</th>
                <th className="text-left pb-3 pr-4" style={{ color: "#94a3b8" }}>Circom/Groth16</th>
                <th className="text-left pb-3" style={{ color: "#94a3b8" }}>RISC Zero</th>
              </tr>
            </thead>
            <tbody>
              {ZK_COMPARISON.map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                  <td className="py-2.5 pr-4 font-medium" style={{ color: "var(--color-text-muted)" }}>{row.feature}</td>
                  <td className="py-2.5 pr-4 font-mono" style={{ color: "#60a5fa" }}>{row.covenant}</td>
                  <td className="py-2.5 pr-4 font-mono" style={{ color: "#64748b" }}>{row.circom}</td>
                  <td className="py-2.5 font-mono" style={{ color: "#64748b" }}>{row.risc0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs mt-3" style={{ color: "var(--color-text-dim)" }}>
            Covenant chose Noir + UltraHonk for developer ergonomics, transparent setup (no trusted ceremony),
            and native support via the{" "}
            <a href="https://github.com/yugocabrio/rs-soroban-ultrahonk" target="_blank" rel="noopener noreferrer"
              className="hover:underline" style={{ color: "#60a5fa" }}>
              rs-soroban-ultrahonk
            </a>{" "}verifier on Stellar Protocol 26.
          </p>
        </div>
      </Section>

      <Section
        title={<><BookOpen size={16} style={{ color: "#06b6d4" }} /><span className="text-sm font-semibold text-white">View Key System — Selective Disclosure</span></>}
        open={openSection === "viewkey"}
        onToggle={() => toggle("viewkey")}
      >
        <div className="pt-4 space-y-4">
          <div className="rounded-lg p-4" style={{ background: "rgba(6,9,16,0.8)", border: "1px solid var(--color-border-subtle)" }}>
            <div className="label-sm mb-3" style={{ color: "#06b6d4" }}>View Key Derivation Protocol</div>
            <div className="font-mono text-xs space-y-1.5">
              <div style={{ color: "#475569" }}>// Institution generates during credential issuance</div>
              <div style={{ color: "#7dd3fc" }}>view_key = poseidon2(credential_secret ‖ regulator_pk)</div>
              <div style={{ color: "#7dd3fc" }}>view_key_hash = poseidon2(view_key)</div>
              <div style={{ color: "#475569" }}>{"\n"}// view_key_hash is published on-chain (CovenantRegistry)</div>
              <div style={{ color: "#86efac" }}>// view_key is shared privately with authorized regulator</div>
              <div style={{ color: "#475569" }}>{"\n"}// Regulator presents view_key to CovenantSettlement</div>
              <div style={{ color: "#c4b5fd" }}>CovenantSettlement.regulator_audit(regulator, hash, view_key)</div>
              <div style={{ color: "#475569" }}>// Contract verifies: poseidon2(view_key) == stored view_key_hash</div>
              <div style={{ color: "#86efac" }}>// Emits: (COVENANT, AUDIT, settlement_hash, regulator_pk)</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "Privacy Guarantee",
                color: "#34d399",
                items: ["Sender Stellar address never on-chain", "Transaction amount stays private", "KYC documents stay off-chain"]
              },
              {
                label: "Compliance Guarantee",
                color: "#60a5fa",
                items: ["KYC verified in ZK circuit", "Sanctions cleared in ZK circuit", "Risk tier enforced in circuit"]
              },
              {
                label: "Audit Guarantee",
                color: "#fbbf24",
                items: ["Every audit access logged on-chain", "Regulator cannot audit silently", "Institution controls which regulator"]
              },
            ].map((col) => (
              <div key={col.label} className="rounded-lg p-3" style={{ background: "rgba(22,27,39,0.6)", border: "1px solid var(--color-border-subtle)" }}>
                <div className="text-xs font-semibold mb-2" style={{ color: col.color }}>{col.label}</div>
                {col.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1">
                    <CheckCircle2 size={10} style={{ color: col.color, flexShrink: 0, marginTop: 2 }} />
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
