import { useState } from "react";
import { ArrowLeftRight, ArrowRight, ChevronDown, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { proveSettlement } from "../lib/prover";
import { useCovenantStore } from "../lib/store";
import { toast } from "sonner";

type Asset = "XLM" | "USDC" | "EURC" | "PYUSD";

interface ExchangeRate {
  from: Asset;
  to: Asset;
  rate: number;
  path: Asset[];
  slippage: number;
  fee: string;
}

const MOCK_RATES: Record<string, ExchangeRate> = {
  "USDC-EURC":  { from: "USDC",  to: "EURC",  rate: 0.924, path: ["USDC", "XLM", "EURC"],  slippage: 0.12, fee: "0.003 XLM" },
  "EURC-USDC":  { from: "EURC",  to: "USDC",  rate: 1.082, path: ["EURC", "XLM", "USDC"],  slippage: 0.12, fee: "0.003 XLM" },
  "XLM-USDC":   { from: "XLM",   to: "USDC",  rate: 0.12,  path: ["XLM", "USDC"],           slippage: 0.08, fee: "0.001 XLM" },
  "XLM-EURC":   { from: "XLM",   to: "EURC",  rate: 0.11,  path: ["XLM", "EURC"],           slippage: 0.10, fee: "0.002 XLM" },
  "USDC-PYUSD": { from: "USDC",  to: "PYUSD", rate: 1.001, path: ["USDC", "PYUSD"],         slippage: 0.05, fee: "0.001 XLM" },
};

const ASSETS: Asset[] = ["XLM", "USDC", "EURC", "PYUSD"];

function AssetIcon({ asset }: { asset: Asset }) {
  const colors: Record<Asset, string> = {
    XLM: "#0ea5e9",
    USDC: "#2563eb",
    EURC: "#7c3aed",
    PYUSD: "#ea580c",
  };
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ background: colors[asset] }}
    >
      {asset.slice(0, 2)}
    </div>
  );
}

export default function Bridge() {
  const { credentials, settlements } = useCovenantStore();
  const [sendAsset, setSendAsset] = useState<Asset>("USDC");
  const [receiveAsset, setReceiveAsset] = useState<Asset>("EURC");
  const [sendAmount, setSendAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [done, setDone] = useState(false);

  const rateKey = `${sendAsset}-${receiveAsset}`;
  const rate = MOCK_RATES[rateKey];
  const receiveAmount = rate && sendAmount ? (parseFloat(sendAmount) * rate.rate).toFixed(6) : "—";
  const exceedsSlippage = rate && rate.slippage > 0.5;
  const activeTier = credentials[0]?.tier ?? 0;

  const handleSwapAssets = () => {
    setSendAsset(receiveAsset);
    setReceiveAsset(sendAsset);
    setSendAmount("");
  };

  const handleBridge = async () => {
    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setIsSwapping(true);
    try {
      await proveSettlement({
        fromAsset: sendAsset,
        toAsset: receiveAsset,
        amount: parseFloat(sendAmount),
        complianceNullifier: credentials[0]?.nullifier ?? "0x" + "00".repeat(32),
      });
      setDone(true);
      toast.success("Bridge settlement submitted", {
        description: `${sendAmount} ${sendAsset} → ${receiveAmount} ${receiveAsset}`,
      });
    } catch (err: any) {
      toast.error("Bridge failed", { description: err?.message });
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Bridge</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Cross-currency settlement with ZK compliance proof
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bridge form */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Cross-Currency Settlement</h2>
            </div>

            <div className="p-5 space-y-3">
              {done ? (
                <div className="p-5 rounded-lg text-center space-y-3" style={{ background: "var(--accent-success-subtle)" }}>
                  <CheckCircle2 size={32} className="mx-auto" style={{ color: "var(--accent-success)" }} />
                  <p className="font-semibold" style={{ color: "var(--accent-success)" }}>Bridge submitted!</p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {sendAmount} {sendAsset} → {receiveAmount} {receiveAsset}
                  </p>
                  <button
                    onClick={() => { setDone(false); setSendAmount(""); }}
                    className="text-sm underline"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    New bridge
                  </button>
                </div>
              ) : (
                <>
                  {/* Send */}
                  <div
                    className="p-4 rounded-xl"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>Send</p>
                    <div className="flex items-center gap-3">
                      <AssetIcon asset={sendAsset} />
                      <div className="flex-1">
                        <input
                          type="number"
                          value={sendAmount}
                          onChange={(e) => setSendAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full text-xl font-bold bg-transparent outline-none"
                          style={{ color: "var(--text-primary)" }}
                        />
                      </div>
                      <select
                        value={sendAsset}
                        onChange={(e) => setSendAsset(e.target.value as Asset)}
                        className="text-sm font-semibold bg-transparent outline-none cursor-pointer"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {ASSETS.filter(a => a !== receiveAsset).map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Swap button */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={handleSwapAssets}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:rotate-180"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)", transition: "transform 0.3s ease" }}
                    >
                      <ArrowLeftRight size={14} />
                    </button>
                  </div>

                  {/* Receive */}
                  <div
                    className="p-4 rounded-xl"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>Receive (estimated)</p>
                    <div className="flex items-center gap-3">
                      <AssetIcon asset={receiveAsset} />
                      <div className="flex-1">
                        <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{receiveAmount}</p>
                      </div>
                      <select
                        value={receiveAsset}
                        onChange={(e) => setReceiveAsset(e.target.value as Asset)}
                        className="text-sm font-semibold bg-transparent outline-none cursor-pointer"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {ASSETS.filter(a => a !== sendAsset).map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Rate info */}
                  {rate && (
                    <div className="space-y-1.5 py-1">
                      {[
                        { label: "Exchange Rate", value: `1 ${sendAsset} = ${rate.rate} ${receiveAsset}` },
                        { label: "Network Fee", value: rate.fee },
                        { label: "Slippage", value: `${rate.slippage}%` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
                          <span style={{ color: "var(--text-secondary)" }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!rate && sendAmount && (
                    <div className="flex items-center gap-2 p-3 rounded-lg text-xs" style={{ background: "var(--accent-warning-subtle)", color: "var(--accent-warning)" }}>
                      <AlertTriangle size={13} />
                      No direct path available. Try a different pair.
                    </div>
                  )}

                  <button
                    onClick={handleBridge}
                    disabled={isSwapping || !sendAmount || !rate || activeTier === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: "var(--accent-primary)",
                      color: "#fff",
                      opacity: isSwapping || !sendAmount || !rate || activeTier === 0 ? 0.5 : 1,
                    }}
                  >
                    {isSwapping ? <Loader2 size={15} className="animate-spin" /> : <ArrowLeftRight size={15} />}
                    {isSwapping ? "Bridging…" : activeTier === 0 ? "Credential required" : "Bridge Assets"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Path visualization + history */}
        <div className="lg:col-span-3 space-y-4">
          {/* Route visualization */}
          {rate && (
            <div
              className="p-5 rounded-xl"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Settlement Path</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {rate.path.map((asset, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}>
                      <AssetIcon asset={asset as Asset} />
                      {asset}
                    </div>
                    {i < rate.path.length - 1 && (
                      <ArrowRight size={14} style={{ color: "var(--text-tertiary)" }} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
                Routed via Stellar DEX path payments with ZK compliance verification at each hop.
              </p>
            </div>
          )}

          {/* Supported pairs */}
          <div
            className="p-5 rounded-xl"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Supported Pairs</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(MOCK_RATES).map((r) => (
                <button
                  key={`${r.from}-${r.to}`}
                  onClick={() => { setSendAsset(r.from); setReceiveAsset(r.to); }}
                  className="flex items-center gap-2 p-2.5 rounded-lg text-xs transition-all"
                  style={{
                    background: sendAsset === r.from && receiveAsset === r.to ? "var(--accent-primary-subtle)" : "var(--bg-elevated)",
                    border: `1px solid ${sendAsset === r.from && receiveAsset === r.to ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                    color: "var(--text-secondary)",
                  }}
                >
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{r.from}</span>
                  <ArrowRight size={10} style={{ color: "var(--text-tertiary)" }} />
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{r.to}</span>
                  <span className="ml-auto" style={{ color: "var(--text-tertiary)" }}>×{r.rate}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bridge history from settlements */}
          {settlements.filter(s => s.crossCurrency).length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Bridge History</h3>
              </div>
              {settlements.filter(s => s.crossCurrency).map(s => (
                <div key={s.id} className="flex items-center gap-4 px-5 py-3 text-sm" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <span style={{ color: "var(--text-primary)" }}>{s.fromAsset} → {s.toAsset}</span>
                  <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{s.amount}</span>
                  <span className="ml-auto text-xs" style={{ color: "var(--text-tertiary)" }}>{new Date(s.timestamp).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
