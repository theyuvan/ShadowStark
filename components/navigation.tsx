"use client"

import { useState, useCallback } from "react"
import { Activity, Bitcoin, Loader2, Shield, Wallet, X, Zap } from "lucide-react"
import Link from "next/link"
import { useXverseWallet } from "@/hooks/useXverseWallet"

// ─── Starknet window declaration ────────────────────────────────────────────
declare global {
  interface Window {
    starknet?: {
      enable: (opts?: Record<string, unknown>) => Promise<unknown>
      selectedAddress?: string
      account?: { address?: string }
      disconnect?: () => Promise<void> | void
    }
  }
}

type ConnectedWalletInfo = {
  address: string
  provider: string
  chain: "btc" | "strk"
}

function shortAddress(address: string): string {
  if (address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function Navigation() {
  const {
    wallet: btcWallet,
    isConnecting: btcConnecting,
    connectXverse,
    connectUnisat,
    error: btcError,
    xverseAvailable,
    unisatAvailable,
    disconnectWallet: disconnectBtc,
  } = useXverseWallet()

  const [strkAddress, setStrkAddress] = useState<string | null>(null)
  const [strkProvider, setStrkProvider] = useState<string | null>(null)
  const [strkConnecting, setStrkConnecting] = useState(false)
  const [strkError, setStrkError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Determine which wallet is connected (prefer whichever was connected)
  const connectedWallet: ConnectedWalletInfo | null =
    btcWallet?.connected
      ? { address: btcWallet.address, provider: btcWallet.provider, chain: "btc" }
      : strkAddress
        ? { address: strkAddress, provider: strkProvider ?? "strk", chain: "strk" }
        : null

  const connectStarknet = useCallback(async (providerName: string) => {
    setStrkConnecting(true)
    setStrkError(null)
    try {
      const injected = window.starknet
      if (!injected) throw new Error("No Starknet wallet detected. Install Ready, ArgentX, or Braavos.")
      await injected.enable({ showModal: true })
      const addr = injected.selectedAddress ?? injected.account?.address
      if (!addr) throw new Error("No address returned by Starknet wallet.")
      setStrkAddress(addr)
      setStrkProvider(providerName)
      setModalOpen(false)
    } catch (err) {
      setStrkError(err instanceof Error ? err.message : "Connection failed.")
    } finally {
      setStrkConnecting(false)
    }
  }, [])

  const handleDisconnect = useCallback(() => {
    disconnectBtc()
    setStrkAddress(null)
    setStrkProvider(null)
    window.starknet?.disconnect?.()
  }, [disconnectBtc])

  const isConnecting = btcConnecting || strkConnecting

  return (
    <div className="container mx-auto px-4 pt-5 pb-4">
      <nav className="surface-strong mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#ea580c]" strokeWidth={2.2} />
          <Link href="/" className="text-xs font-bold uppercase tracking-[0.15em] hover:opacity-80">
            ShadowFlow
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-5">
          <Link href="/about" className="text-xs font-semibold uppercase tracking-widest text-[#4a4a4a] hover:text-black transition-colors">About</Link>
          <Link href="/otc-intent" className="text-xs font-semibold uppercase tracking-widest text-[#4a4a4a] hover:text-black transition-colors">OTC Intent</Link>
          <Link href="/transactions" className="text-xs font-semibold uppercase tracking-widest text-[#4a4a4a] hover:text-black transition-colors">Transactions</Link>
        </div>

        <div className="flex items-center gap-2">
          {connectedWallet ? (
            <div className="flex items-center gap-2">
              <div className="inline-flex h-10 items-center gap-2 border-2 border-black bg-[#ECFFF0] px-3 text-xs font-bold uppercase tracking-wide text-[#1E6B31]">
                {connectedWallet.chain === "btc" ? (
                  <Bitcoin className="h-3.5 w-3.5 text-[#F7931A]" />
                ) : (
                  <Zap className="h-3.5 w-3.5 text-[#EC796B]" />
                )}
                {connectedWallet.provider}: {shortAddress(connectedWallet.address)}
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-black bg-white px-2 text-xs hover:bg-red-50"
                title="Disconnect"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={isConnecting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10253f] px-3 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
            >
              {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      <div className="mx-auto mt-3 flex max-w-6xl items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5b5b5b]">
        <Activity className="w-4 h-4" />
        Starknet Privacy OTC Interface
      </div>

      {/* ── Wallet selection modal ─────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[460px] rounded-2xl border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Connect Wallet</h3>
                <p className="text-sm text-[#666]">Choose a wallet to connect</p>
              </div>
              <button className="text-[#666] hover:text-black text-xl" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            {/* BTC Wallets */}
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#F7931A]">
              <Bitcoin className="h-4 w-4" /> Bitcoin Wallets
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={async () => { await connectXverse(); setModalOpen(false); }}
                disabled={btcConnecting || !xverseAvailable}
                className="flex items-center gap-2 rounded-xl border-2 border-black bg-[#FFF8F0] p-3 text-left text-sm font-semibold hover:bg-[#FFEDD5] disabled:opacity-40 transition-colors"
              >
                <span className="text-lg">⚡</span>
                <div>
                  <p className="font-bold">Xverse</p>
                  <p className="text-[10px] text-[#888]">BTC Testnet4</p>
                </div>
              </button>
              <button
                onClick={async () => { await connectUnisat(); setModalOpen(false); }}
                disabled={btcConnecting || !unisatAvailable}
                className="flex items-center gap-2 rounded-xl border-2 border-black bg-[#FFF8F0] p-3 text-left text-sm font-semibold hover:bg-[#FFEDD5] disabled:opacity-40 transition-colors"
              >
                <span className="text-lg">₿</span>
                <div>
                  <p className="font-bold">Unisat</p>
                  <p className="text-[10px] text-[#888]">BTC Testnet4</p>
                </div>
              </button>
            </div>

            {/* STRK Wallets */}
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#EC796B]">
              <Zap className="h-4 w-4" /> Starknet Wallets
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => connectStarknet("ready")}
                disabled={strkConnecting}
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-black bg-[#FFF5F3] p-3 text-sm font-semibold hover:bg-[#FFE4E0] disabled:opacity-40 transition-colors"
              >
                <Wallet className="h-5 w-5 text-[#EC796B]" />
                <span className="text-xs font-bold">Ready</span>
                <span className="text-[9px] text-[#999]">STRK Sepolia</span>
              </button>
              <button
                onClick={() => connectStarknet("argentx")}
                disabled={strkConnecting}
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-black bg-[#FFF5F3] p-3 text-sm font-semibold hover:bg-[#FFE4E0] disabled:opacity-40 transition-colors"
              >
                <span className="text-xl">⚡</span>
                <span className="text-xs font-bold">ArgentX</span>
                <span className="text-[9px] text-[#999]">STRK Sepolia</span>
              </button>
              <button
                onClick={() => connectStarknet("braavos")}
                disabled={strkConnecting}
                className="flex flex-col items-center gap-1 rounded-xl border-2 border-black bg-[#FFF5F3] p-3 text-sm font-semibold hover:bg-[#FFE4E0] disabled:opacity-40 transition-colors"
              >
                <span className="text-xl">🛡</span>
                <span className="text-xs font-bold">Braavos</span>
                <span className="text-[9px] text-[#999]">STRK Sepolia</span>
              </button>
            </div>

            {(btcError || strkError) && (
              <p className="mt-3 text-xs text-red-600">{btcError || strkError}</p>
            )}

            {isConnecting && (
              <div className="mt-3 flex items-center gap-2 text-sm text-[#666]">
                <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
              </div>
            )}

            {!xverseAvailable && !unisatAvailable && (
              <p className="mt-2 text-[10px] text-[#aaa]">
                No BTC wallet detected. Install{" "}
                <a href="https://www.xverse.app/download" target="_blank" rel="noopener noreferrer" className="underline text-[#F7931A]">Xverse</a>
                {" or "}
                <a href="https://unisat.io" target="_blank" rel="noopener noreferrer" className="underline text-[#F7931A]">Unisat</a>.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
