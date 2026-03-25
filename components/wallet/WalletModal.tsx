"use client";

import { Loader2, Wallet } from "lucide-react";

const wallets = [
  { id: "argentx", name: "ArgentX", description: "Most popular Starknet wallet", recommended: true },
  { id: "braavos", name: "Braavos", description: "Smart wallet with biometrics", recommended: false },
  { id: "ready", name: "Ready Wallet", description: "Ready mobile/web Starknet wallet", recommended: false },
  { id: "metamask-snap", name: "MetaMask Snap", description: "Via Starknet Snap", recommended: false },
] as const;

export function WalletModal({
  open,
  loading,
  onClose,
  onSelect,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSelect: (wallet: "argentx" | "braavos" | "ready" | "metamask-snap") => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[460px] rounded-xl border border-border bg-elevated p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">Connect to ShadowFlow</h3>
            <p className="text-sm text-secondary">Choose your wallet to connect securely</p>
          </div>
          <button className="text-secondary hover:text-foreground" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-2">
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => onSelect(wallet.id)}
              disabled={loading}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-base p-3 text-left hover:bg-highlight"
            >
              <Wallet className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="font-display text-sm font-medium">{wallet.name}</p>
                <p className="text-xs text-secondary">{wallet.description}</p>
              </div>
              {wallet.recommended ? <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] text-primary">Recommended</span> : null}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-btc">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting...
          </div>
        ) : null}
      </div>
    </div>
  );
}
