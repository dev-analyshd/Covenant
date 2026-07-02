import { create } from "zustand";
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";
import { HotWalletModule } from "@creit.tech/stellar-wallets-kit/modules/hotwallet";
import { KleverModule } from "@creit.tech/stellar-wallets-kit/modules/klever";
import { BitgetModule } from "@creit.tech/stellar-wallets-kit/modules/bitget";
import { CactusLinkModule } from "@creit.tech/stellar-wallets-kit/modules/cactuslink";
import { OneKeyModule } from "@creit.tech/stellar-wallets-kit/modules/onekey";
import { LedgerModule } from "@creit.tech/stellar-wallets-kit/modules/ledger";
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

export const SUPPORTED_WALLET_COUNT = 12;
