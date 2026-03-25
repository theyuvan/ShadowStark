import { create } from "zustand";

interface WalletState {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  network: "starknet-testnet" | "starknet-mainnet";
  walletName: "argentx" | "braavos" | "metamask-snap" | "ready" | null;
  btcBalance: string;
  strkBalance: string;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setAddress: (address: string | null) => void;
  setWalletName: (walletName: WalletState["walletName"]) => void;
  setBalances: (btcBalance: string, strkBalance: string) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  connected: false,
  connecting: false,
  address: null,
  network: "starknet-testnet",
  walletName: null,
  btcBalance: "0.0000",
  strkBalance: "0.00",
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setAddress: (address) => set({ address }),
  setWalletName: (walletName) => set({ walletName }),
  setBalances: (btcBalance, strkBalance) => set({ btcBalance, strkBalance }),
  disconnect: () =>
    set({
      connected: false,
      connecting: false,
      address: null,
      walletName: null,
      btcBalance: "0.0000",
      strkBalance: "0.00",
    }),
}));
