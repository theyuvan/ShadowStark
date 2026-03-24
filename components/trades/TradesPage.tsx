"use client";

import { useState } from "react";
import { useStrategyStore } from "@/store/strategyStore";

import { StrategyCard } from "@/components/trades/StrategyCard";
import { ExecutionFeed } from "@/components/trades/ExecutionFeed";
import { NewTradePanel } from "@/components/trades/NewTradePanel";
import { TradeHistory } from "@/components/trades/TradeHistory";
import type { ExecutionLog, TradeRecord } from "@/types";

export function TradesPage() {
  const { graph } = useStrategyStore();
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "pending">("active");

  // Mock data for demo
  const mockExecutionLogs: ExecutionLog[] = [
    {
      stepIndex: 0,
      nodeId: "node-1",
      action: "CONDITION_CHECK",
      maskedAmount: "***",
      timestamp: Date.now() - 5000,
      constraintsSatisfied: true,
      witnessGenerated: true,
    },
    {
      stepIndex: 1,
      nodeId: "node-2",
      action: "SPLIT",
      maskedAmount: "***",
      timestamp: Date.now() - 3000,
      constraintsSatisfied: true,
      witnessGenerated: true,
    },
    {
      stepIndex: 2,
      nodeId: "node-3",
      action: "EXECUTE",
      maskedAmount: "***",
      timestamp: Date.now() - 1000,
      constraintsSatisfied: true,
      witnessGenerated: true,
    },
  ];

  const mockActiveStrategies = [
    {
      id: "strat-1",
      graph,
      salt: "shadowflow",
      createdAt: Date.now() - 3600000,
      direction: "buy" as const,
      status: "active" as const,
    },
    {
      id: "strat-2",
      graph,
      salt: "shadowflow-2",
      createdAt: Date.now() - 7200000,
      direction: "sell" as const,
      status: "pending" as const,
    },
  ];

  const mockTradeHistory: TradeRecord[] = [
    {
      id: "trade-1",
      direction: "buy",
      status: "complete",
      createdAt: Date.now() - 86400000,
      commitment: "0x3f2a5bc81098765432abcdef3f2a5bc8",
      proofHash: "0xabc123def456",
      maskedAmount: "***",
      maskedPrice: "***",
      usesTEE: false,
    },
    {
      id: "trade-2",
      direction: "sell",
      status: "complete",
      createdAt: Date.now() - 172800000,
      commitment: "0x2e1b9cd7987654321fedcba2e1b9cd79",
      proofHash: "0xdef789abc012",
      maskedAmount: "***",
      maskedPrice: "***",
      usesTEE: false,
    },
  ];

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
              {mockActiveStrategies.length} ACTIVE
            </span>
            <span className="rounded-md border border-amber/30 bg-amber/10 px-2 py-1 text-amber-400">
              {mockTradeHistory.length} COMPLETED
            </span>
          </div>
        </div>
      </section>

      {/* Main Content: 60/40 split */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.65fr]">
        {/* LEFT: Active Strategies + Execution Feed (60%) */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-border/50">
            {[
              { id: "active" as const, label: "Active Strategies" },
              { id: "pending" as const, label: "Pending Proof" },
              { id: "completed" as const, label: "Completed" },
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
            {mockActiveStrategies
              .filter(
                (s) =>
                  activeTab === "active" ? s.status === "active" : s.status === "pending"
              )
              .map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onViewProof={() => {
                    // TODO: Show proof inspector modal
                  }}
                />
              ))}
          </div>

          {/* Execution Feed */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Execution Feed
            </h3>
            <ExecutionFeed logs={mockExecutionLogs} />
          </div>
        </div>

        {/* RIGHT: New Trade Form + Quick Stats (40%) */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Total Committed", value: "2" },
              { label: "Proofs Verified", value: "2" },
              { label: "BTC Volume", value: "████" },
              { label: "Active Nullifiers", value: "8" },
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
          <NewTradePanel />
        </div>
      </div>

      {/* Bottom: Trade History */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Trade History</h3>
        <TradeHistory trades={mockTradeHistory} />
      </div>
    </main>
  );
}
