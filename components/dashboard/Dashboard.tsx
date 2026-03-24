"use client";

import { BarChart3, Lock, Shield, Landmark } from "lucide-react";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { ExecutionTimeline } from "@/components/dashboard/ExecutionTimeline";
import { ProofStatusCard } from "@/components/dashboard/ProofStatusCard";
import { CommitmentsTable } from "@/components/dashboard/CommitmentsTable";
import type { ExecutionLog, ZKConstraint } from "@/types";

// Mock data
const mockExecutionLogs: ExecutionLog[] = [
  {
    stepIndex: 0,
    nodeId: "cond-1",
    action: "CONDITION_CHECK",
    maskedAmount: "***",
    timestamp: Date.now() - 3600000,
    constraintsSatisfied: true,
    witnessGenerated: true,
  },
  {
    stepIndex: 1,
    nodeId: "split-2",
    action: "SPLIT",
    maskedAmount: "***",
    timestamp: Date.now() - 1800000,
    constraintsSatisfied: true,
    witnessGenerated: true,
  },
  {
    stepIndex: 2,
    nodeId: "exec-3",
    action: "EXECUTE",
    maskedAmount: "***",
    timestamp: Date.now() - 900000,
    constraintsSatisfied: true,
    witnessGenerated: true,
  },
];

const mockConstraints: ZKConstraint[] = [
  {
    nodeId: "cond-1",
    constraintType: "range_check",
    publicInputs: ["threshold"],
    privateWitness: ["price", "salt"],
    estimatedSize: 256,
  },
  {
    nodeId: "split-2",
    constraintType: "sum_partition",
    publicInputs: ["count"],
    privateWitness: ["amounts"],
    estimatedSize: 512,
  },
  {
    nodeId: "exec-3",
    constraintType: "state_transition",
    publicInputs: ["direction"],
    privateWitness: ["amount", "timing"],
    estimatedSize: 384,
  },
];

export function Dashboard() {
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
          value="2"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <MetricCard
          label="Proofs Verified"
          value="2"
          icon={<Shield className="h-5 w-5" />}
        />
        <MetricCard
          label="Nullifiers Active"
          value="8"
          icon={<Lock className="h-5 w-5" />}
        />
        <MetricCard
          label="Merkle Root"
          value="0x3f2a...b8c1"
          icon={<Landmark className="h-5 w-5" />}
        />
      </div>

      {/* 2-Column Layout: Timeline + Proof Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ExecutionTimeline />
        <ProofStatusCard />
      </div>

      {/* Bottom: 3-Tab Table Panel */}
      <CommitmentsTable logs={mockExecutionLogs} constraints={mockConstraints} />
    </main>
  );
}
