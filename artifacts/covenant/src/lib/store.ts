import { create } from "zustand";
import {
  StellarAccount,
  StellarTransaction,
  NetworkStats,
  COVENANT_PUBLIC,
  fetchAccount,
  fetchTransactions,
  fetchNetworkStats,
  fetchOperations,
} from "./stellar";

export interface CredentialRecord {
  id: string;
  nullifier: string;
  addressCommitment: string;
  viewKeyHash: string;
  tier: number;
  issuedAt: Date;
  expiresAt: Date;
  kycProvider: string;
  riskScore: number;
  txHash?: string;
  proofBytes: string;
  proofSizeBytes: number;
  circuitConstraints: number;
}

export interface SettlementRecord {
  id: string;
  settlementHash: string;
  fromAsset: string;
  toAsset: string;
  amount: string;
  tier: number;
  recipient: string;
  timestamp: Date;
  txHash?: string;
  crossCurrency: boolean;
  proofBytes: string;
  ledger?: number;
  gasUsed?: number;
}

export interface AuditLogEntry {
  id: string;
  settlementId: string;
  viewKey: string;
  regulatorId: string;
  timestamp: Date;
  jurisdiction: string;
  accessLogged: boolean;
}

interface CovenantState {
  account: StellarAccount | null;
  transactions: StellarTransaction[];
  operations: any[];
  networkStats: NetworkStats | null;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  walletConnected: boolean;

  credentials: CredentialRecord[];
  settlements: SettlementRecord[];
  auditLog: AuditLogEntry[];

  totalProofsGenerated: number;
  totalProofBytes: number;

  setWalletConnected: (v: boolean) => void;
  refresh: () => Promise<void>;
  addCredential: (c: CredentialRecord) => void;
  addSettlement: (s: SettlementRecord) => void;
  addAuditEntry: (a: AuditLogEntry) => void;
}

export const useCovenantStore = create<CovenantState>((set, get) => ({
  account: null,
  transactions: [],
  operations: [],
  networkStats: null,
  loading: false,
  error: null,
  lastRefresh: null,
  walletConnected: false,
  credentials: [],
  settlements: [],
  auditLog: [],
  totalProofsGenerated: 0,
  totalProofBytes: 0,

  setWalletConnected: (v) => set({ walletConnected: v }),

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [account, transactions, networkStats, operations] = await Promise.all([
        fetchAccount(COVENANT_PUBLIC),
        fetchTransactions(COVENANT_PUBLIC, 20),
        fetchNetworkStats(),
        fetchOperations(COVENANT_PUBLIC, 30),
      ]);
      set({
        account,
        transactions,
        networkStats,
        operations,
        loading: false,
        lastRefresh: new Date(),
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to load Stellar data", loading: false });
    }
  },

  addCredential: (c) =>
    set((s) => ({
      credentials: [c, ...s.credentials],
      totalProofsGenerated: s.totalProofsGenerated + 1,
      totalProofBytes: s.totalProofBytes + c.proofSizeBytes,
    })),

  addSettlement: (s) =>
    set((st) => ({
      settlements: [s, ...st.settlements],
      totalProofsGenerated: st.totalProofsGenerated + 1,
      totalProofBytes: st.totalProofBytes + 256,
    })),

  addAuditEntry: (a) =>
    set((s) => ({ auditLog: [a, ...s.auditLog] })),
}));
