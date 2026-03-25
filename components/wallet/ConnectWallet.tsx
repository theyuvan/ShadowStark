"use client";

import { useState } from "react";
import { Bitcoin, Loader2 } from "lucide-react";
import { WalletModal } from "@/components/wallet/WalletModal";
import { WalletDropdown } from "@/components/wallet/WalletDropdown";
import { useWalletStore } from "@/store/walletStore";
import { otcClient } from "@/lib/otcClient";

interface InjectedStarknetWallet {
  enable: (options?: Record<string, unknown>) => Promise<unknown>;
  selectedAddress?: string;
  account?: {
    address?: string;
  };
  disconnect?: () => Promise<void> | void;
}

declare global {
  interface Window {
    starknet?: InjectedStarknetWallet;
  }
}

export function ConnectWallet() {
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const {
    connected,
    connecting,
    address,
    btcBalance,
    strkBalance,
    setConnecting,
    setConnected,
    setAddress,
    setWalletName,
    setBalances,
    disconnect,
  } = useWalletStore();

  const handleConnect = async (wallet: "argentx" | "braavos" | "ready" | "metamask-snap") => {
    try {
      setConnecting(true);
      setWalletName(wallet);

      const injectedWallet = window.starknet;
      if (!injectedWallet) {
        throw new Error("No Starknet wallet detected. Install ArgentX or Braavos.");
      }

      await injectedWallet.enable({ showModal: true });

      const selectedAddress = injectedWallet.selectedAddress || injectedWallet.account?.address;
      if (!selectedAddress) {
        throw new Error("Wallet connection failed: no address returned.");
      }

      setAddress(selectedAddress);
      setConnected(true);

      try {
        if (otcClient.isConfigured()) {
          const balances = await otcClient.getWalletBalances(selectedAddress);
          setBalances(balances.btcBalance, balances.strkBalance);
        } else {
          setBalances("0.0000", "0.00");
        }
      } catch {
        setBalances("0.0000", "0.00");
      }

      setModalOpen(false);
    } catch (error) {
      console.error(error);
      disconnect();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="relative">
      {!connected ? (
        <button
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[#F7931A55] bg-[#F7931A1A] px-3 py-2 text-sm text-btc hover:bg-[#F7931A2A]"
          onClick={() => setModalOpen(true)}
          disabled={connecting}
        >
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bitcoin className="h-4 w-4" />}
          {connecting ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <button
          className="flex w-full items-center justify-between rounded-md border border-border bg-elevated px-3 py-2 text-sm"
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-public" />
            <span className="font-code text-code">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          </span>
          <span className="text-xs text-secondary">Starknet</span>
        </button>
      )}

      {connected && dropdownOpen && address ? (
        <WalletDropdown
          address={address}
          btcBalance={btcBalance}
          strkBalance={strkBalance}
          onDisconnect={() => {
            void window.starknet?.disconnect?.();
            disconnect();
            setDropdownOpen(false);
          }}
        />
      ) : null}

      <WalletModal open={modalOpen} loading={connecting} onClose={() => setModalOpen(false)} onSelect={handleConnect} />
    </div>
  );
}
