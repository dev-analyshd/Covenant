import { useState } from "react";
import { Lock, Globe, CheckCircle, Loader, ArrowRight, Info } from "lucide-react";

type Step = "form" | "proving" | "completed";

const assets = ["USDC", "EURC", "PYUSD", "GYEN", "BRLA"];

const tierLimits: Record<number, number> = {
  5: 1_000_000,
  4: 800_000,
  3: 600_000,
  2: 400_000,
  1: 200_000,
};

export default function SettlementPanel() {
  const [step, setStep] = useState<Step>("form");
  const [isCrossCurrency, setIsCrossCurrency] = useState(false);
  const [fromAsset, setFromAsset] = useState("USDC");
  const [toAsset, setToAsset] = useState("EURC");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [proving, setProving] = useState("");
  const userTier = 4;

  const handleSettle = async () => {
    setStep("proving");
    const steps = [
      "Computing settlement proof in Noir circuit...",
      "Verifying balance constraints (range proof)...",
      "Checking compliance credential nullifier...",
      "Submitting to CovenantSettlement contract...",
      "Executing token transfer via Stellar Asset Contract...",
    ];
    for (const s of steps) {
      setProving(s);
      await new Promise((r) => setTimeout(r, 700));
    }
    setStep("completed");
  };

  const limit = tierLimits[userTier];
  const amountNum = parseFloat(amount || "0");
  const exceedsLimit = amountNum > limit;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="glass-panel p-8">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(139,92,246,0.12)" }}
          >
            <Lock style={{ color: "#a78bfa" }} size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Private Settlement</h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Execute a ZK-verified cross-border transfer on Stellar
            </p>
          </div>
        </div>

        {step === "form" && (
          <div className="space-y-5">
            <label
              className="flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all"
              style={{
                background: isCrossCurrency ? "rgba(139,92,246,0.1)" : "rgba(30,41,59,0.4)",
                border: `1px solid ${isCrossCurrency ? "rgba(139,92,246,0.3)" : "var(--color-border)"}`,
              }}
            >
              <input
                type="checkbox"
                checked={isCrossCurrency}
                onChange={(e) => setIsCrossCurrency(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#8b5cf6" }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Cross-Currency Settlement</div>
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Convert between stablecoins via Stellar DEX path payment
                </div>
              </div>
              <Globe size={18} style={{ color: "var(--color-text-dim)" }} />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#cbd5e1" }}>
                  From Asset
                </label>
                <select
                  className="input-field"
                  value={fromAsset}
                  onChange={(e) => setFromAsset(e.target.value)}
                >
                  {assets.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#cbd5e1" }}>
                  To Asset {!isCrossCurrency && <span style={{ color: "var(--color-text-dim)" }}>(same-asset)</span>}
                </label>
                <select
                  className="input-field"
                  value={isCrossCurrency ? toAsset : fromAsset}
                  onChange={(e) => setToAsset(e.target.value)}
                  disabled={!isCrossCurrency}
                  style={{ opacity: isCrossCurrency ? 1 : 0.5 }}
                >
                  {assets.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#cbd5e1" }}>
                Amount
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  className="input-field"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ paddingRight: "4rem" }}
                />
                <span
                  className="text-xs font-medium"
                  style={{
                    position: "absolute",
                    right: "1rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-dim)",
                  }}
                >
                  {fromAsset}
                </span>
              </div>
              {exceedsLimit && amount && (
                <p className="text-xs mt-1.5" style={{ color: "#f87171" }}>
                  Amount exceeds your Tier {userTier} limit of ${limit.toLocaleString()}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#cbd5e1" }}>
                Recipient Address
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="G... (Stellar address)"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>

            <div
              className="p-4 rounded-lg space-y-2.5"
              style={{ background: "rgba(15,23,42,0.7)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex justify-between text-sm items-center">
                <span style={{ color: "var(--color-text-muted)" }}>Your Compliance Tier</span>
                <span className="tier-badge tier-4">Tier {userTier}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Settlement Limit</span>
                <span className="text-white">${limit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>ZK Proof Required</span>
                <span style={{ color: "#34d399" }}>✓ Verified</span>
              </div>
              {isCrossCurrency && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--color-text-muted)" }}>DEX Route</span>
                  <span className="flex items-center gap-1 text-white">
                    {fromAsset} <ArrowRight size={12} /> {toAsset}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2 pt-1">
                <Info size={13} style={{ color: "var(--color-text-dim)", marginTop: 1, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                  Settlement details are kept private. Only a commitment hash and tier attestation are stored on-chain.
                </p>
              </div>
            </div>

            <button
              onClick={handleSettle}
              disabled={!amount || !recipient || exceedsLimit}
              className="btn-primary w-full"
              style={{
                padding: "0.75rem",
                opacity: (!amount || !recipient || exceedsLimit) ? 0.5 : 1,
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <Lock size={17} />
                Execute Private Settlement
              </span>
            </button>
          </div>
        )}

        {step === "proving" && (
          <div className="py-12 text-center space-y-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: "rgba(139,92,246,0.12)" }}
            >
              <Loader style={{ color: "#a78bfa" }} size={30} className="animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Generating Settlement Proof...</h3>
              <p className="text-sm" style={{ color: "#a78bfa" }}>{proving}</p>
            </div>
            <div className="max-w-xs mx-auto h-1.5 rounded-full" style={{ background: "rgba(30,41,59,0.8)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: "60%",
                  background: "linear-gradient(90deg, #7c3aed, #8b5cf6)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        )}

        {step === "completed" && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(16,185,129,0.12)" }}
              >
                <CheckCircle style={{ color: "#34d399" }} size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Settlement Complete!</h3>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Your private settlement has been executed on Stellar
              </p>
            </div>

            <div
              className="p-5 rounded-lg space-y-3"
              style={{ background: "rgba(15,23,42,0.7)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Settlement Hash</span>
                <span className="text-white font-mono text-xs">0x3e8a7f4c1b2d9e06</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Amount</span>
                <span className="text-white">{amount} {fromAsset}{isCrossCurrency ? ` → ${toAsset}` : ""}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span style={{ color: "var(--color-text-muted)" }}>Compliance Tier</span>
                <span className="tier-badge tier-4">Tier {userTier}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Status</span>
                <span style={{ color: "#34d399" }}>Completed</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Compliance Trail</span>
                <span style={{ color: "var(--color-text-dim)" }}>Encrypted (view key required)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>Transaction</span>
                <a href="#" style={{ color: "#60a5fa" }} className="hover:underline text-xs">
                  View on Stellar Expert ↗
                </a>
              </div>
            </div>

            <button
              onClick={() => {
                setStep("form");
                setAmount("");
                setRecipient("");
              }}
              className="btn-secondary w-full"
              style={{ padding: "0.75rem" }}
            >
              New Settlement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
