import { create } from "zustand";

interface WalletState {
  // Starknet wallet
  connected: boolean;
  connecting: boolean;
  address: string | null;
  network: "starknet-testnet" | "starknet-mainnet";
  walletName: "argentx" | "braavos" | "metamask-snap" | "ready" | null;

  // Balances
  btcBalance: string;  // BTC testnet4 balance (from Mempool.space)
  strkBalance: string; // STRK balance (from on-chain balanceOf)
  ethBalance: string;  // ETH balance (from on-chain balanceOf)

  // Xverse BTC testnet wallet
  btcAddress: string | null;         // Native Segwit / Taproot testnet4 address
  btcConnected: boolean;             // Whether Xverse is connected

  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setAddress: (address: string | null) => void;
  setWalletName: (walletName: WalletState["walletName"]) => void;
  setBalances: (btcBalance: string, strkBalance: string, ethBalance?: string) => void;
  setBtcAddress: (btcAddress: string | null, btcBalance?: string) => void;
  setBtcConnected: (connected: boolean) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  // Starknet wallet
  connected: false,
  connecting: false,
  address: null,
  network: "starknet-testnet",
  walletName: null,

  // Balances
  btcBalance: "0.00000000",
  strkBalance: "0.0000",
  ethBalance: "0.0000",

  // Xverse BTC
  btcAddress: null,
  btcConnected: false,

  // Actions
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setAddress: (address) => set({ address }),
  setWalletName: (walletName) => set({ walletName }),
  setBalances: (btcBalance, strkBalance, ethBalance) =>
    set({ btcBalance, strkBalance, ethBalance: ethBalance ?? "0.0000" }),
  setBtcAddress: (btcAddress, btcBalance) =>
    set({ btcAddress, ...(btcBalance !== undefined ? { btcBalance } : {}) }),
  setBtcConnected: (btcConnected) => set({ btcConnected }),
  disconnect: () =>
    set({
      connected: false,
      connecting: false,
      address: null,
      walletName: null,
      btcBalance: "0.00000000",
      strkBalance: "0.0000",
      ethBalance: "0.0000",
    }),
}));
