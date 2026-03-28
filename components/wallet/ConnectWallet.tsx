"use client";

import { useState } from "react";
import { Bitcoin, Loader2 } from "lucide-react";
import { WalletModal } from "@/components/wallet/WalletModal";
import { WalletDropdown } from "@/components/wallet/WalletDropdown";
import { useWalletStore } from "@/store/walletStore";
import { fetchAllBalances } from "@/lib/balanceFetcher";
import { btcClient } from "@/lib/btcClient";

// ─── Xverse sats-connect types (lightweight, avoids full import issues) ────────
type SatsConnectRequest = {
  getAccounts: {
    params: { purposes: string[]; message?: string };
    result: { address: string; addressType: string; publicKey: string; purpose: string }[];
  };
};

declare global {
  interface Window {
    XverseProviders?: {
      BitcoinProvider?: {
        request: <K extends keyof SatsConnectRequest>(
          method: K,
          params: SatsConnectRequest[K]["params"],
        ) => Promise<{ result: { addresses: SatsConnectRequest["getAccounts"]["result"] } }>;
      };
    };
    starknet?: {
      enable: (opts?: Record<string, unknown>) => Promise<unknown>;
      selectedAddress?: string;
      account?: { address?: string };
      disconnect?: () => Promise<void> | void;
    };
  }
}

// ─── Detect Xverse injection ──────────────────────────────────────────────────
function getXverseProvider() {
  if (typeof window === "undefined") return null;
  return window.XverseProviders?.BitcoinProvider ?? null;
}

async function connectXverse(): Promise<{ paymentAddress: string; ordinalsAddress: string } | null> {
  const provider = getXverseProvider();
  if (!provider) return null;

  try {
    const response = await provider.request("getAccounts", {
      purposes: ["payment", "ordinals"],
      message: "ShadowFlow BTC OTC — connect Xverse wallet for BTC testnet4 transfers",
    });
    const addresses = response?.result?.addresses ?? [];
    const payment = addresses.find((a) => a.purpose === "payment");
    const ordinals = addresses.find((a) => a.purpose === "ordinals");
    return {
      paymentAddress: payment?.address ?? ordinals?.address ?? "",
      ordinalsAddress: ordinals?.address ?? payment?.address ?? "",
    };
  } catch (err) {
    console.warn("[Xverse] getAccounts failed:", err);
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConnectWallet() {
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [xverseConnecting, setXverseConnecting] = useState(false);
  const [xverseError, setXverseError] = useState<string | null>(null);

  const {
    connected,
    connecting,
    address,
    btcAddress,
    btcConnected,
    btcBalance,
    strkBalance,
    setConnecting,
    setConnected,
    setAddress,
    setWalletName,
    setBalances,
    setBtcAddress,
    setBtcConnected,
    disconnect,
  } = useWalletStore();

  // ── Starknet connect ─────────────────────────────────────────────────────────
  const handleConnect = async (wallet: "argentx" | "braavos" | "ready" | "metamask-snap") => {
    try {
      setConnecting(true);
      setWalletName(wallet);

      const injectedWallet = window.starknet;
      if (!injectedWallet) {
        throw new Error("No Starknet wallet detected. Install ArgentX or Braavos from their official sites.");
      }

      await injectedWallet.enable({ showModal: true });

      const selectedAddress = injectedWallet.selectedAddress || injectedWallet.account?.address;
      if (!selectedAddress) {
        throw new Error("Wallet connection failed — no address returned.");
      }

      setAddress(selectedAddress);
      setConnected(true);

      // Fetch STRK + ETH balances DIRECTLY from Starknet RPC (not an API stub)
      const currentBtcAddr = btcAddress ?? undefined;
      const balances = await fetchAllBalances(selectedAddress, currentBtcAddr);
      setBalances(balances.btc, balances.strk, balances.eth);

      setModalOpen(false);
    } catch (error) {
      console.error("[ConnectWallet] Starknet connect failed:", error);
      disconnect();
    } finally {
      setConnecting(false);
    }
  };

  // ── Xverse BTC connect ────────────────────────────────────────────────────────
  const handleXverseConnect = async () => {
    setXverseError(null);
    setXverseConnecting(true);

    // Check for Xverse extension
    const provider = getXverseProvider();
    if (!provider) {
      setXverseError(
        "Xverse not detected. Install from https://www.xverse.app/download and make sure Bitcoin Testnet4 is enabled in Settings → Network.",
      );
      setXverseConnecting(false);
      return;
    }

    try {
      const accounts = await connectXverse();
      if (!accounts || !accounts.paymentAddress) {
        throw new Error("Xverse returned no addresses. Ensure Bitcoin Testnet mode is enabled in Xverse → Settings → Network.");
      }

      const btcAddr = accounts.paymentAddress;
      setBtcAddress(btcAddr);
      setBtcConnected(true);

      // Immediately fetch the BTC testnet4 balance from Mempool.space
      const bal = await btcClient.getBalance(btcAddr);
      setBtcAddress(btcAddr, bal.totalBtc);

      // Also refresh Starknet balances if already connected
      if (address) {
        const balances = await fetchAllBalances(address, btcAddr);
        setBalances(balances.btc, balances.strk, balances.eth);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Xverse connection failed.";
      setXverseError(msg);
      console.error("[ConnectWallet] Xverse connect failed:", err);
    } finally {
      setXverseConnecting(false);
    }
  };

  return (
    <div className="relative space-y-2">
      {/* ── Starknet wallet button ── */}
      {!connected ? (
        <button
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[#F7931A55] bg-[#F7931A1A] px-3 py-2 text-sm text-btc hover:bg-[#F7931A2A]"
          onClick={() => setModalOpen(true)}
          disabled={connecting}
        >
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bitcoin className="h-4 w-4" />}
          {connecting ? "Connecting..." : "Connect ArgentX / Braavos"}
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

      {/* ── Xverse BTC wallet button ── */}
      <div>
        {!btcConnected ? (
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[#F7931A88] bg-[#F7931A15] px-3 py-2 text-sm text-[#F7931A] hover:bg-[#F7931A25] disabled:opacity-50"
            onClick={handleXverseConnect}
            disabled={xverseConnecting}
          >
            {xverseConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="text-base leading-none">₿</span>
            )}
            {xverseConnecting ? "Connecting Xverse..." : "Connect Xverse (BTC)"}
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-md border border-[#F7931A44] bg-[#F7931A10] px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#F7931A]" />
              <span className="font-mono text-[#F7931A]">
                {btcAddress?.slice(0, 8)}...{btcAddress?.slice(-6)}
              </span>
            </span>
            <span className="font-semibold text-[#F7931A]">{btcBalance} BTC</span>
          </div>
        )}

        {xverseError && (
          <p className="mt-1 text-[10px] leading-snug text-red-400">{xverseError}</p>
        )}
      </div>

      {/* ── Starknet wallet dropdown ── */}
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

      <WalletModal
        open={modalOpen}
        loading={connecting}
        onClose={() => setModalOpen(false)}
        onSelect={handleConnect}
      />
    </div>
  );
}
