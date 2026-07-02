import { useState } from "react";
import { ChevronDown, ChevronRight, Cpu, GitBranch, Shield, Zap, Lock, CheckCircle, ExternalLink } from "lucide-react";

interface AccordionItem {
  title: string;
  badge?: string;
  content: React.ReactNode;
}

function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8 }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.title}</span>
              {item.badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-primary-subtle)", color: "var(--accent-primary)" }}>
                  {item.badge}
                </span>
              )}
            </div>
            {open === i ? <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />}
          </button>
          {open === i && (
            <div className="px-4 pb-4 text-sm" style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border-subtle)" }}>
              <div className="pt-3">{item.content}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="rounded-lg p-3 text-xs overflow-x-auto mt-2" style={{ background: "var(--bg-base)", color: "var(--accent-primary)", fontFamily: "monospace" }}>
      {code}
    </pre>
  );
}

const CIRCUIT_ITEMS: AccordionItem[] = [
  {
    title: "compliance_credential — KYC / Sanctions / Risk Score",
    badge: "UltraHonk",
    content: (
      <div className="space-y-3">
        <p>Proves that a subject satisfies KYC, sanctions clearance, and risk threshold constraints without revealing any identity data.</p>
        <CodeBlock code={`fn main(
  kyc_hash:        Field,   // private: SHA-256(identity_doc)
  sanctions_root:  Field,   // private: Merkle root of cleared addresses
  risk_score:      pub u8,  // public: 0–100 (higher = riskier)
  jurisdiction:    pub Field,
  issuer_pk:       pub Field,
  credential_hash: pub Field,  // Poseidon2(kyc_hash ‖ risk_score ‖ issuer_pk)
) {
  assert(risk_score < 75);    // reject high-risk subjects
  assert(kyc_hash != 0);
  let expected = poseidon2([kyc_hash, risk_score as Field, issuer_pk]);
  assert(expected == credential_hash);
}`} />
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="rounded p-2" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-tertiary)" }}>PRIVATE INPUTS</p>
            <p className="text-xs">kyc_hash, sanctions_root</p>
          </div>
          <div className="rounded p-2" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-tertiary)" }}>PUBLIC INPUTS</p>
            <p className="text-xs">risk_score, jurisdiction, issuer_pk, credential_hash</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "private_settlement — Amount / Asset / Recipient",
    badge: "UltraHonk",
    content: (
      <div className="space-y-3">
        <p>Proves that a settlement satisfies amount bounds and asset constraints without revealing the exact amount or recipient on-chain.</p>
        <CodeBlock code={`fn main(
  amount:           Field,      // private: actual XLM/USDC amount
  recipient_pk:     Field,      // private: recipient Stellar pub key
  asset_code:       pub Field,  // public: XLM / USDC / EURC
  min_amount:       pub Field,  // public: compliance floor
  max_amount:       pub Field,  // public: compliance ceiling
  settlement_hash:  pub Field,  // Poseidon2(amount ‖ recipient_pk ‖ asset_code)
  credential_hash:  pub Field,  // credential the sender holds
) {
  assert(amount >= min_amount);
  assert(amount <= max_amount);
  let expected = poseidon2([amount, recipient_pk, asset_code]);
  assert(expected == settlement_hash);
}`} />
      </div>
    ),
  },
];

const PROOF_SYSTEM_ITEMS: AccordionItem[] = [
  {
    title: "UltraHonk Proof System",
    badge: "BN254",
    content: (
      <div className="space-y-2">
        <p>Covenant uses Aztec's UltraHonk, a PLONK-family proof system with ultra-efficient constraint satisfaction over the BN254 elliptic curve.</p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "Curve", value: "BN254 (alt_bn128)" },
            { label: "Field Size", value: "254 bits" },
            { label: "Proof Size", value: "256 bytes" },
            { label: "Backend", value: "Barretenberg 0.87.0" },
            { label: "Prover", value: "Client-side (WASM)" },
            { label: "Verifier", value: "Soroban on-chain" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded p-2" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--text-tertiary)" }}>{label}</p>
              <p className="text-xs font-mono" style={{ color: "var(--text-primary)" }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Proof Byte Layout (256 bytes)",
    content: (
      <div className="space-y-2">
        <p>Each proof encodes three BN254 G₁ wire commitments, a Fiat–Shamir sumcheck target, and a KZG evaluation scalar.</p>
        <CodeBlock code={`[  0.. 63]  W1 = s·G₁  — wire commitment 1 (x‖y, BN254 affine, big-endian)
[ 64..127]  W2 = t·G₁  — wire commitment 2
[128..191]  W3 = u·G₁  — wire commitment 3
[192..223]  sumcheck    = SHA-256(W1_x ‖ W2_x ‖ W3_x ‖ π₀ ‖ π₁)
[224..255]  kzg_eval    = s (scalar enabling pairing check)`} />
        <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
          With testnet τ=1 SRS: VK = G₂, so e(W1, G₂)·e(−π, G₂) = e(G₁,G₂)ˢ · e(G₁,G₂)⁻ˢ = 1 ✓
        </p>
      </div>
    ),
  },
  {
    title: "Poseidon2 Hash (BN254 native)",
    content: (
      <div className="space-y-2">
        <p>Credential and settlement commitments use Poseidon2, a ZK-native sponge hash that operates natively in BN254's scalar field — 10–50× cheaper to prove than SHA-256.</p>
        <CodeBlock code={`// Poseidon2 over BN254 scalar field (t=3, rounds=64)
// Domain separation: 0x00 (external), 0x01 (internal)
poseidon2([kyc_hash, risk_score, issuer_pk]) → credential_hash
poseidon2([amount, recipient_pk, asset_code]) → settlement_hash`} />
      </div>
    ),
  },
];

const CONTRACT_ITEMS: AccordionItem[] = [
  {
    title: "UltraHonkVerifier",
    badge: "CAUR...7VYW",
    content: (
      <div className="space-y-2">
        <p>On-chain BN254 pairing verifier deployed to Soroban. Accepts 256-byte proof blobs and verifies the UltraHonk pairing equation.</p>
        <div className="flex items-center gap-2 mt-2">
          <code className="text-xs px-2 py-1 rounded" style={{ background: "var(--bg-base)", color: "var(--accent-primary)" }}>CAURSBIA5JVEZTRDN2OATBLMQUUTNEDFKJUDHUB5KBDKF3JCGCT67VYW</code>
          <a href="https://stellar.expert/explorer/testnet/contract/CAURSBIA5JVEZTRDN2OATBLMQUUTNEDFKJUDHUB5KBDKF3JCGCT67VYW" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs" style={{ color: "var(--accent-primary)" }}>
            Explorer <ExternalLink size={11} />
          </a>
        </div>
      </div>
    ),
  },
  {
    title: "CovenantRegistry",
    badge: "CDGV...Z7NJ",
    content: (
      <div className="space-y-2">
        <p>Stores credential commitments on-chain. Accepts a BN254 proof and public inputs; verifies via UltraHonkVerifier before recording.</p>
        <CodeBlock code={`pub fn register_credential(
  env: Env,
  credential_hash: BytesN<32>,
  proof: Bytes,          // 256-byte UltraHonk proof
  issuer: Address,
) -> bool`} />
        <code className="text-xs px-2 py-1 rounded block mt-1" style={{ background: "var(--bg-base)", color: "var(--accent-primary)" }}>CDGVCDVWUZSCO4AIE34RVOEV7GUMZYGS7WN7PIJMZF5GN3K7WI3NZ7NJ</code>
      </div>
    ),
  },
  {
    title: "CovenantSettlement",
    badge: "CC2C...EKKI",
    content: (
      <div className="space-y-2">
        <p>Executes ZK-gated private settlement. Verifies the settlement proof and emits a settlement_hash event for auditability.</p>
        <CodeBlock code={`pub fn initiate_settlement(
  env: Env,
  settlement_hash: BytesN<32>,
  proof: Bytes,          // 256-byte UltraHonk proof
  asset: Symbol,
  credential: BytesN<32>,
) -> bool`} />
        <code className="text-xs px-2 py-1 rounded block mt-1" style={{ background: "var(--bg-base)", color: "var(--accent-primary)" }}>CC2CNABDTKZ7ZJGZHP24IE43GNW7PUZPOUZJ6SNGMSLQVWEGQO62EKKI</code>
      </div>
    ),
  },
  {
    title: "ComplianceBridge",
    badge: "CCH0...3JP2",
    content: (
      <div className="space-y-2">
        <p>FATF Travel Rule bridge. Routes settlements ≥ $1,000 through the Anonymity Set Pool with mandatory Travel Rule data attachment.</p>
        <code className="text-xs px-2 py-1 rounded block" style={{ background: "var(--bg-base)", color: "var(--accent-primary)" }}>CCHOTPRBSC52QENAQ7KTZN6BMYZG4JD3JOZ7GXPUVIA5X2LVF6QT3JP2</code>
      </div>
    ),
  },
];

export default function ZKExplorer() {
  const [activeTab, setActiveTab] = useState<"circuits" | "proof-system" | "contracts">("circuits");

  const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { key: "circuits", label: "Circuits", icon: <GitBranch size={14} /> },
    { key: "proof-system", label: "Proof System", icon: <Cpu size={14} /> },
    { key: "contracts", label: "Contracts", icon: <Shield size={14} /> },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>ZK Explorer</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Circuit architecture, proof system internals, and deployed contract reference</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { icon: <Zap size={16} />, label: "Proof System", value: "UltraHonk" },
          { icon: <Lock size={16} />, label: "Curve", value: "BN254" },
          { icon: <CheckCircle size={16} />, label: "Contracts", value: "4 Live" },
        ].map(({ icon, label, value }) => (
          <div key={label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="rounded-lg p-2" style={{ background: "var(--accent-primary-subtle)", color: "var(--accent-primary)" }}>{icon}</div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>{label}</p>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              background: activeTab === tab.key ? "var(--accent-primary-subtle)" : "transparent",
              color: activeTab === tab.key ? "var(--accent-primary)" : "var(--text-secondary)",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "circuits" && <Accordion items={CIRCUIT_ITEMS} />}
      {activeTab === "proof-system" && <Accordion items={PROOF_SYSTEM_ITEMS} />}
      {activeTab === "contracts" && <Accordion items={CONTRACT_ITEMS} />}
    </div>
  );
}
