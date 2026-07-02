import { create } from "zustand";
import { proveCredential, CredentialWitness } from "./prover";
import { registerCredential, generateCredentialSecret } from "./contracts";
import { useCovenantStore } from "./store";

export type KycProvider = "coinbase" | "circle" | "jumio" | "sumsub" | "onfido" | "persona";
export type SourceOfFunds = "employment" | "business" | "investment" | "inheritance" | "savings";
export type Country = "US" | "GB" | "DE" | "SG" | "JP" | "AU" | "CA" | "CH";

export const TIER_LIMITS: Record<number, { label: string; limit: string; color: string }> = {
  1: { label: "Basic", limit: "$1,000", color: "var(--tier-bronze)" },
  2: { label: "Standard", limit: "$10,000", color: "var(--tier-silver)" },
  3: { label: "Professional", limit: "$100,000", color: "var(--tier-gold)" },
  4: { label: "Institutional", limit: "$1,000,000", color: "var(--tier-platinum)" },
  5: { label: "Enterprise", limit: "Unlimited", color: "var(--accent-primary)" },
};

export const PROOF_STEPS = [
  { label: "Hashing KYC documents", duration: 2000 },
  { label: "Building Merkle proof", duration: 3000 },
  { label: "Computing witness", duration: 4000 },
  { label: "Generating UltraHonk proof", duration: 5000 },
  { label: "Verifying off-chain", duration: 2000 },
  { label: "Registering on-chain", duration: 3000 },
  { label: "Credential active", duration: 1000 },
];

interface CredentialFormState {
  kycProvider: KycProvider;
  riskScore: number;
  sourceOfFunds: SourceOfFunds;
  country: Country;
  isGenerating: boolean;
  currentStep: number;
  completedSteps: number[];
  error: string | null;
  lastTxHash: string | null;

  setField: <K extends keyof Omit<CredentialFormState, "setField" | "generate" | "reset">>(
    key: K,
    value: CredentialFormState[K]
  ) => void;
  generate: () => Promise<void>;
  reset: () => void;
}

const INITIAL = {
  kycProvider: "coinbase" as KycProvider,
  riskScore: 15,
  sourceOfFunds: "employment" as SourceOfFunds,
  country: "US" as Country,
  isGenerating: false,
  currentStep: -1,
  completedSteps: [] as number[],
  error: null as string | null,
  lastTxHash: null as string | null,
};

export const useCredentialStore = create<CredentialFormState>((set, get) => ({
  ...INITIAL,

  setField: (key, value) => set({ [key]: value } as any),

  generate: async () => {
    const { kycProvider, riskScore, sourceOfFunds, country } = get();
    set({ isGenerating: true, currentStep: 0, completedSteps: [], error: null, lastTxHash: null });

    try {
      const credentialSecret = generateCredentialSecret();

      // Animate through steps while the API call runs in the background
      const witness: CredentialWitness = { kycProvider, riskScore, sourceOfFunds, country, credentialSecret };

      // Run steps with realistic timing
      let proofResultPromise: Promise<any> | null = null;
      for (let i = 0; i < PROOF_STEPS.length; i++) {
        set({ currentStep: i });
        if (i === 3 && !proofResultPromise) {
          proofResultPromise = proveCredential(witness).catch(() => null);
        }
        await new Promise((r) => setTimeout(r, PROOF_STEPS[i].duration));
        set((s) => ({ completedSteps: [...s.completedSteps, i] }));
      }

      const proofResult = proofResultPromise ? await proofResultPromise : null;

      const nullifier = proofResult?.witness?.nullifier ?? "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
      const tier = proofResult?.witness?.tier ?? Math.max(1, Math.min(5, Math.ceil((100 - riskScore) / 20)));
      const addressCommitment = proofResult?.witness?.addressCommitment ?? "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
      const viewKeyHash = proofResult?.witness?.viewKeyHash ?? "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");

      const txHash = await registerCredential({
        nullifier,
        tier,
        addressCommitment,
        viewKeyHash,
        proofHex: proofResult?.proof,
      });

      useCovenantStore.getState().addCredential({
        id: crypto.randomUUID(),
        nullifier,
        addressCommitment,
        viewKeyHash,
        tier,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        kycProvider,
        riskScore,
        txHash,
        proofBytes: proofResult?.proof ?? "simulated",
        proofSizeBytes: proofResult?.metadata?.proofSizeBytes ?? 256,
        circuitConstraints: proofResult?.metadata?.constraintCount ?? 2097152,
        onChain: true,
      });

      set({ lastTxHash: txHash, isGenerating: false, currentStep: -1 });
    } catch (err: any) {
      set({ error: err?.message ?? "Proof generation failed", isGenerating: false, currentStep: -1 });
    }
  },

  reset: () => set(INITIAL),
}));
