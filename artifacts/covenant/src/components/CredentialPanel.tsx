import { useState } from "react";
import { FileCheck, Shield, AlertCircle, CheckCircle, Loader } from "lucide-react";

type Step = "form" | "proving" | "verified";

interface ProgressStep {
  label: string;
  done: boolean;
  active: boolean;
}

export default function CredentialPanel() {
  const [step, setStep] = useState<Step>("form");
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState(0);
  const [formData, setFormData] = useState({
    kycProvider: "",
    riskScore: "",
    sourceOfFunds: "",
  });

  const provingSteps = [
    "Hashing KYC document",
    "Computing Merkle membership proof",
    "Running sanctions clearance check",
    "Generating Noir ZK circuit witness",
    "Computing UltraHonk proof",
    "Submitting to Soroban contract",
  ];

  const handleGenerate = async () => {
    setStep("proving");
    setProgress(0);
    setProgressStep(0);

    for (let i = 0; i < provingSteps.length; i++) {
      setProgressStep(i);
      await new Promise((r) => setTimeout(r, 600));
      setProgress(Math.round(((i + 1) / provingSteps.length) * 100));
    }

    await new Promise((r) => setTimeout(r, 400));
    setStep("verified");
  };

  const riskScore = parseInt(formData.riskScore || "0");
  const tier = riskScore <= 10 ? 5 : riskScore <= 25 ? 4 : riskScore <= 50 ? 3 : riskScore <= 75 ? 2 : 1;
  const tierClass = `tier-${tier}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="glass-panel p-8">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(59,130,246,0.12)" }}
          >
            <FileCheck style={{ color: "#60a5fa" }} size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Generate Compliance Credential</h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Create a ZK-verifiable compliance credential via Noir circuit
            </p>
          </div>
        </div>

        {step === "form" && (
          <div className="space-y-6">
            <div
              className="p-4 rounded-lg flex items-start gap-3"
              style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.18)" }}
            >
              <AlertCircle style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} size={17} />
              <div className="text-sm" style={{ color: "#cbd5e1" }}>
                <p className="font-semibold text-white mb-1">Privacy Notice</p>
                Your KYC data is never stored on-chain. Only a zero-knowledge proof of compliance is published —
                not your name, identity, or document details.
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#cbd5e1" }}>
                  KYC Provider
                </label>
                <select
                  className="input-field"
                  value={formData.kycProvider}
                  onChange={(e) => setFormData({ ...formData, kycProvider: e.target.value })}
                >
                  <option value="">Select provider...</option>
                  <option value="onfido">Onfido</option>
                  <option value="jumio">Jumio</option>
                  <option value="sumsub">SumSub</option>
                  <option value="fractal">Fractal ID</option>
                  <option value="veriff">Veriff</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#cbd5e1" }}>
                  Risk Score (0–100)
                </label>
                <p className="text-xs mb-2" style={{ color: "var(--color-text-dim)" }}>
                  Lower score = higher compliance tier and higher settlement limits
                </p>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="input-field"
                  placeholder="Enter risk score..."
                  value={formData.riskScore}
                  onChange={(e) => setFormData({ ...formData, riskScore: e.target.value })}
                />
                {formData.riskScore && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Computed tier:
                    </span>
                    <span className={`tier-badge ${tierClass}`}>Tier {tier}</span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {tier === 5 && "— Limit: $1,000,000"}
                      {tier === 4 && "— Limit: $800,000"}
                      {tier === 3 && "— Limit: $600,000"}
                      {tier === 2 && "— Limit: $400,000"}
                      {tier === 1 && "— Limit: $200,000"}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#cbd5e1" }}>
                  Source of Funds
                </label>
                <select
                  className="input-field"
                  value={formData.sourceOfFunds}
                  onChange={(e) => setFormData({ ...formData, sourceOfFunds: e.target.value })}
                >
                  <option value="">Select source...</option>
                  <option value="salary">Salary / Employment</option>
                  <option value="business">Business Revenue</option>
                  <option value="investment">Investment Returns</option>
                  <option value="inheritance">Inheritance</option>
                  <option value="asset_sale">Asset Sale</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div
              className="p-4 rounded-lg text-xs space-y-1.5"
              style={{ background: "rgba(15,23,42,0.8)", border: "1px solid var(--color-border)", fontFamily: "var(--font-mono)" }}
            >
              <div style={{ color: "#475569" }}># Noir circuit constraints:</div>
              <div style={{ color: "#64748b" }}>
                assert(kyc_hash ∈ TrustedIssuerMerkleTree);
              </div>
              <div style={{ color: "#64748b" }}>
                assert(sanctions_hash ∈ NegativeScreeningMerkleTree);
              </div>
              <div style={{ color: "#64748b" }}>
                assert(risk_score ≤ tier_threshold);
              </div>
              <div style={{ color: "#64748b" }}>assert(expiry_timestamp &gt; current_timestamp);</div>
              <div style={{ color: "#475569" }}>
                # Outputs: nullifier, compliance_tier, address_commitment
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!formData.kycProvider || !formData.riskScore || !formData.sourceOfFunds}
              className="btn-primary w-full"
              style={{ padding: "0.75rem", opacity: (!formData.kycProvider || !formData.riskScore || !formData.sourceOfFunds) ? 0.5 : 1 }}
            >
              <span className="flex items-center justify-center gap-2">
                <Shield size={17} />
                Generate ZK Compliance Credential
              </span>
            </button>
          </div>
        )}

        {step === "proving" && (
          <div className="py-8 space-y-8">
            <div className="text-center space-y-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "rgba(59,130,246,0.1)" }}
              >
                <Loader style={{ color: "#60a5fa" }} size={30} className="animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-white">Generating ZK Proof...</h3>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Computing compliance credential in Noir circuit using UltraHonk proving system
              </p>
            </div>

            <div className="space-y-3">
              {provingSteps.map((label, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        i < progressStep
                          ? "rgba(16,185,129,0.2)"
                          : i === progressStep
                            ? "rgba(59,130,246,0.2)"
                            : "rgba(30,41,59,0.5)",
                      border:
                        i < progressStep
                          ? "1px solid rgba(16,185,129,0.4)"
                          : i === progressStep
                            ? "1px solid rgba(59,130,246,0.4)"
                            : "1px solid var(--color-border)",
                    }}
                  >
                    {i < progressStep ? (
                      <CheckCircle size={12} style={{ color: "#34d399" }} />
                    ) : i === progressStep ? (
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#60a5fa" }} />
                    ) : null}
                  </div>
                  <span
                    className="text-sm"
                    style={{
                      color: i < progressStep ? "#34d399" : i === progressStep ? "white" : "var(--color-text-dim)",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                <span>Proof generation progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: "rgba(30,41,59,0.8)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #2563eb, #7c3aed)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {step === "verified" && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(16,185,129,0.12)" }}
              >
                <CheckCircle style={{ color: "#34d399" }} size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Credential Verified!</h3>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Your ZK compliance credential is now registered on Stellar
              </p>
            </div>

            <div
              className="p-5 rounded-lg space-y-3"
              style={{ background: "rgba(15,23,42,0.7)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Credential ID</span>
                <span className="text-white font-mono text-xs">0x7a3f9e2d4b1c8a56</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span style={{ color: "var(--color-text-muted)" }}>Compliance Tier</span>
                <span className="tier-badge tier-4">Tier 4</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Nullifier</span>
                <span className="text-white font-mono text-xs">0x9a2b4c1e3f7d6e82</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Address Commitment</span>
                <span className="text-white font-mono text-xs">0x4d8f1a3c7b2e9d05</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Settlement Limit</span>
                <span className="text-white">$800,000</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Expires</span>
                <span className="text-white">September 23, 2026</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Transaction</span>
                <a href="#" style={{ color: "#60a5fa" }} className="hover:underline text-xs">
                  View on Stellar Expert ↗
                </a>
              </div>
            </div>

            <div
              className="p-4 rounded-lg text-xs"
              style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}
            >
              <p className="font-medium mb-1" style={{ color: "#34d399" }}>
                ✓ Proof verified on-chain
              </p>
              <p style={{ color: "#64748b" }}>
                CovenantRegistry confirmed your UltraHonk proof. Your nullifier is marked as used —
                this credential cannot be replayed.
              </p>
            </div>

            <button
              onClick={() => {
                setStep("form");
                setFormData({ kycProvider: "", riskScore: "", sourceOfFunds: "" });
              }}
              className="btn-secondary w-full"
              style={{ padding: "0.75rem" }}
            >
              Generate Another Credential
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
