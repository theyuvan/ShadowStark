"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletStore } from "@/store/walletStore";
import { otcClient } from "@/lib/otcClient";

import { StrategyCard } from "@/components/trades/StrategyCard";
import { ExecutionFeed } from "@/components/trades/ExecutionFeed";
import { NewTradePanel } from "@/components/trades/NewTradePanel";
import { TradeHistory } from "@/components/trades/TradeHistory";
import type { ExecutionLog, TradeRecord } from "@/types";
import type { StrategySummary } from "@/lib/otcClient";

const intentTypedData = (payload: {
  walletAddress: string;
  direction: "buy" | "sell";
  templateId: "simple" | "split" | "guarded";
  priceThreshold: number;
  amount: number;
  splitCount: number;
  selectedPath: string;
  depositAmount: number;
}) => ({
  types: {
    StarkNetDomain: [
      { name: "name", type: "shortstring" },
      { name: "version", type: "shortstring" },
      { name: "chainId", type: "shortstring" },
    ],
    OTCIntent: [
      { name: "wallet", type: "felt" },
      { name: "direction", type: "shortstring" },
      { name: "template", type: "shortstring" },
      { name: "priceThreshold", type: "felt" },
      { name: "amount", type: "felt" },
      { name: "splitCount", type: "felt" },
      { name: "selectedPath", type: "shortstring" },
      { name: "depositAmount", type: "felt" },
    ],
  },
  primaryType: "OTCIntent",
  domain: {
    name: "ShadowFlow",
    version: "1",
    chainId: "SN_SEPOLIA",
  },
  message: {
    wallet: payload.walletAddress,
    direction: payload.direction,
    template: payload.templateId,
    priceThreshold: `${payload.priceThreshold}`,
    amount: `${payload.amount}`,
    splitCount: `${payload.splitCount}`,
    selectedPath: payload.selectedPath,
    depositAmount: `${payload.depositAmount}`,
  },
});

async function signIntentPayload(payload: {
  walletAddress: string;
  direction: "buy" | "sell";
  templateId: "simple" | "split" | "guarded";
  priceThreshold: number;
  amount: number;
  splitCount: number;
  selectedPath: string;
  depositAmount: number;
}) {
  const signer = (
    window as Window & {
      starknet?: { account?: { signMessage?: (typedData: Record<string, unknown>) => Promise<unknown> } };
    }
  ).starknet?.account?.signMessage;
  if (!signer) {
    throw new Error("Wallet signature is required to submit private OTC intents.");
  }

  const nonce = `${Date.now()}`;
  const signedAt = Date.now();
  const signature = await signer(intentTypedData(payload));

  return {
    nonce,
    signedAt,
    signature: JSON.stringify(signature),
  };
}

export function TradesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"open" | "matched" | "settled">("open");
  const { connected, address, btcBalance, strkBalance } = useWalletStore();
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reloadData = useCallback(async () => {
    if (!address || !connected) {
      setStrategies([]);
      setLogs([]);
      setTrades([]);
      return;
    }

    if (!otcClient.isConfigured()) {
      setErrorMessage("Real mode requires NEXT_PUBLIC_ENABLE_REAL_EXECUTION=true and NEXT_PUBLIC_EXECUTION_API_URL.");
      setStrategies([]);
      setLogs([]);
      setTrades([]);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const [nextStrategies, nextLogs, nextTrades] = await Promise.all([
        otcClient.listStrategies(address),
        otcClient.listExecutionLogs(address),
        otcClient.listTrades(address),
      ]);
      setStrategies(nextStrategies);
      setLogs(nextLogs);
      setTrades(nextTrades);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load trade data.";
      setErrorMessage(message);
      setStrategies([]);
      setLogs([]);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [address, connected]);

  useEffect(() => {
    void reloadData();
  }, [reloadData]);

  const filteredStrategies = useMemo(
    () =>
      strategies.filter((s) => {
        if (activeTab === "open") return s.status === "open";
        if (activeTab === "matched") return s.status === "matched";
        return s.status === "settled";
      }),
    [activeTab, strategies],
  );

  const handleSubmitIntent = useCallback(
    async (payload: {
      direction: "buy" | "sell";
      templateId: "simple" | "split" | "guarded";
      priceThreshold: number;
      amount: number;
      splitCount: number;
      depositConfirmed: boolean;
      depositAmount: number;
      selectedPath: string;
    }) => {
      if (!address) {
        throw new Error("Wallet not connected.");
      }

      if (!payload.depositConfirmed || payload.depositAmount <= 0) {
        throw new Error("Deposit must be confirmed before submitting intent.");
      }

      setSubmitting(true);
      setErrorMessage(null);
      try {
        const walletAuth = await signIntentPayload({
          walletAddress: address,
          direction: payload.direction,
          templateId: payload.templateId,
          priceThreshold: payload.priceThreshold,
          amount: payload.amount,
          splitCount: payload.splitCount,
          selectedPath: payload.selectedPath,
          depositAmount: payload.depositAmount,
        });

        await otcClient.submitIntent({ ...payload, walletAddress: address, walletAuth });
        await reloadData();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Intent submission failed.";
        setErrorMessage(message);
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [address, reloadData],
  );

  const handleOpenProof = useCallback((proofHash: string) => {
    if (!proofHash) {
      return;
    }
    const baseUrl = process.env.NEXT_PUBLIC_STARKSCAN_TX_BASE_URL || "https://sepolia.starkscan.co/tx";
    window.open(`${baseUrl}/${proofHash}`, "_blank", "noopener,noreferrer");
  }, []);

  const handleInspectOrder = useCallback(
    (commitment: string) => {
      router.push(`/verify?hash=${encodeURIComponent(commitment)}`);
    },
    [router],
  );

  return (
    <main className="space-y-4 p-4">
      {/* Header */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">My Strategies</p>
            <h1 className="font-heading text-2xl font-semibold text-foreground">Trades & Execution</h1>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
              {strategies.filter((s) => s.status === "open").length} OPEN
            </span>
            <span className="rounded-md border border-amber/30 bg-amber/10 px-2 py-1 text-amber-400">
              {trades.filter((t) => t.status === "matched").length} MATCHED
            </span>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-400">
              {trades.filter((t) => t.status === "settled").length} SETTLED
            </span>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{errorMessage}</div>
      ) : null}

      {!connected ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
          Connect wallet to load live BUY/SELL OTC intents and execute trades.
        </div>
      ) : null}

      {/* Main Content: 60/40 split */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.65fr]">
        {/* LEFT: Active Strategies + Execution Feed (60%) */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-border/50">
            {[
              { id: "open" as const, label: "Open Orders" },
              { id: "matched" as const, label: "Matched" },
              { id: "settled" as const, label: "Settled" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Strategy Cards */}
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-border/50 bg-surface/50 p-4 text-xs text-muted">Loading strategies...</div>
            ) : filteredStrategies.length ? (
              filteredStrategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onViewProof={handleOpenProof}
                  onInspect={handleInspectOrder}
                />
              ))
            ) : (
              <div className="rounded-xl border border-border/50 bg-surface/50 p-4 text-xs text-muted">
                No strategies found for this tab.
              </div>
            )}
          </div>

          {/* Execution Feed */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Execution Feed
            </h3>
            <ExecutionFeed logs={logs} />
          </div>
        </div>

        {/* RIGHT: New Trade Form + Quick Stats (40%) */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Total Committed", value: String(strategies.length) },
              { label: "Proofs Verified", value: String(trades.filter((t) => Boolean(t.proofHash)).length) },
              { label: "BTC Volume", value: trades.length ? "LIVE" : "0" },
              { label: "Active Nullifiers", value: String(logs.filter((l) => l.witnessGenerated).length) },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/50 bg-background/50 p-3 text-xs"
              >
                <p className="text-muted mb-1">{stat.label}</p>
                <p className="font-heading text-lg font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* New Trade Panel */}
          <NewTradePanel
            walletAddress={address}
            btcBalance={btcBalance}
            strkBalance={strkBalance}
            submitting={submitting}
            onSubmitIntent={handleSubmitIntent}
          />
        </div>
      </div>

      {/* Bottom: Trade History */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Trade History</h3>
        <TradeHistory
          trades={trades}
          onViewProof={(trade) => {
            if (trade.proofHash) {
              handleOpenProof(trade.proofHash);
            }
          }}
        />
      </div>
    </main>
  );
}
