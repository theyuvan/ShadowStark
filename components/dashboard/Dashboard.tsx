"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Lock, Shield, Landmark } from "lucide-react";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { ExecutionTimeline } from "@/components/dashboard/ExecutionTimeline";
import { ProofStatusCard } from "@/components/dashboard/ProofStatusCard";
import { CommitmentsTable } from "@/components/dashboard/CommitmentsTable";
import { useExecutionStore } from "@/store/executionStore";
import { useStrategyStore } from "@/store/strategyStore";
import { useWalletStore } from "@/store/walletStore";
import { otcClient } from "@/lib/otcClient";
import { compileGraphToConstraints } from "@/lib/graphCompiler";
import type { TradeRecord } from "@/types";

export function Dashboard() {
  const logs = useExecutionStore((state) => state.logs);
  const graph = useStrategyStore((state) => state.graph);
  const address = useWalletStore((state) => state.address);
  const connected = useWalletStore((state) => state.connected);
  const [commitments, setCommitments] = useState<TradeRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!connected || !address || !otcClient.isConfigured()) {
        setCommitments([]);
        return;
      }

      try {
        const items = await otcClient.listTrades(address);
        setCommitments(items);
      } catch {
        setCommitments([]);
      }
    };

    void load();
  }, [address, connected]);

  const constraints = useMemo(() => compileGraphToConstraints(graph), [graph]);
  const merkleRoot = commitments[0]?.commitment ? `${commitments[0].commitment.slice(0, 10)}...` : "0x0";

  return (
    <main className="space-y-4 p-4">
      {/* Header */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Real-time Metrics</p>
            <h1 className="font-heading text-2xl font-semibold text-foreground">Dashboard</h1>
          </div>
          <div className="text-[11px] text-muted">Live updates every 5s</div>
        </div>
      </section>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard
          label="Strategies Committed"
          value={String(commitments.length)}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <MetricCard
          label="Proofs Verified"
          value={String(commitments.filter((item) => Boolean(item.proofHash)).length)}
          icon={<Shield className="h-5 w-5" />}
        />
        <MetricCard
          label="Nullifiers Active"
          value={String(logs.filter((item) => item.witnessGenerated).length)}
          icon={<Lock className="h-5 w-5" />}
        />
        <MetricCard
          label="Merkle Root"
          value={merkleRoot}
          icon={<Landmark className="h-5 w-5" />}
        />
      </div>

      {/* 2-Column Layout: Timeline + Proof Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ExecutionTimeline logs={logs} />
        <ProofStatusCard />
      </div>

      {/* Bottom: 3-Tab Table Panel */}
      <CommitmentsTable commitments={commitments} logs={logs} constraints={constraints} />
    </main>
  );
}
