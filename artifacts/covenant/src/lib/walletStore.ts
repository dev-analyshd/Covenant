import { create } from "zustand";
import {
  StellarWalletsKit,
  Networks,
  FreighterModule,
  AlbedoModule,
  xBullModule,
  RabetModule,
  LobstrModule,
  HanaModule,
  HotWalletModule,
  KleverModule,
  BitgetModule,
  CactusLinkModule,
  OneKeyModule,
  LedgerModule,
} from "@creit.tech/stellar-wallets-kit";
import { COVENANT_PUBLIC } from "./stellar";

let inited = false;

function ensureInit() {
  if (inited) return;
  StellarWalletsKit.init({
    network: Networks.TESTNET,
    modules: [
      new FreighterModule(),
      new AlbedoModule(),
      new xBullModule(),
      new RabetModule(),
      new LobstrModule(),
      new HanaModule(),
      new KleverModule(),
      new HotWalletModule(),
      new BitgetModule(),
      new CactusLinkModule(),
      new OneKeyModule(),
      new LedgerModule(),
    ],
  } as any);
  inited = true;
}

interface WalletState {
  address: string | null;
  walletId: string | null;
  connecting: boolean;
  error: string | null;
  usingDemo: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  walletId: null,
  connecting: false,
  error: null,
  usingDemo: true,

  connect: async () => {
    ensureInit();
    set({ connecting: true, error: null });
    try {
      const { address } = await StellarWalletsKit.authModal();
      const walletId = (StellarWalletsKit as any).selectedModule?.productId ?? null;
      set({ address, walletId, connecting: false, usingDemo: false });
    } catch (err: any) {
      const msg = err?.message || "Wallet connection failed or was cancelled";
      set({ error: msg, connecting: false });
    }
  },

  disconnect: async () => {
    try {
      await StellarWalletsKit.disconnect();
    } catch {
      // ignore
    }
    set({ address: null, walletId: null, usingDemo: true, error: null });
  },

  signTransaction: async (xdr: string) => {
    const { usingDemo } = get();
    if (usingDemo) {
      throw new Error("Connect a real wallet to sign — demo mode uses server-side signing only.");
    }
    return StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: "Test SDF Network ; September 2015",
      address: get().address ?? undefined,
    });
  },
}));

export function activeAddress(): string {
  return useWalletStore.getState().address ?? COVENANT_PUBLIC;
}

export const SUPPORTED_WALLET_COUNT = 10;
