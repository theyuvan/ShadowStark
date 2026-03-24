"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import type { ExecutionLog, ZKConstraint } from "@/types";

type TabType = "commitments" | "logs" | "constraints";

interface CommitmentsTableProps {
  logs: ExecutionLog[];
  constraints: ZKConstraint[];
}

const mockCommitments = [
  {
    timestamp: Date.now() - 86400000,
    commitment: "0x3f2a5bc81098765432abcdef3f2a5bc8",
    status: "verified",
  },
  {
    timestamp: Date.now() - 172800000,
    commitment: "0x2e1b9cd7987654321fedcba2e1b9cd79",
    status: "verified",
  },
  {
    timestamp: Date.now() - 259200000,
    commitment: "0x1d0a8be69876543210edcba1d0a8be69",
    status: "pending",
  },
];

export function CommitmentsTable({ logs, constraints }: CommitmentsTableProps) {
  const [activeTab, setActiveTab] = useState<TabType>("commitments");

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-border/50">
        {[
          { id: "commitments" as const, label: "Commitments" },
          { id: "logs" as const, label: "Execution Logs" },
          { id: "constraints" as const, label: "ZK Constraints" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Commitments Tab */}
      {activeTab === "commitments" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-background/30">
                <th className="px-4 py-2 text-left text-muted">Timestamp</th>
                <th className="px-4 py-2 text-left text-muted">Commitment</th>
                <th className="px-4 py-2 text-left text-muted">Status</th>
                <th className="px-4 py-2 text-left text-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {mockCommitments.map((item, idx) => (
                <tr key={idx} className="border-b border-border/30 hover:bg-background/20">
                  <td className="px-4 py-2 text-muted">
                    {new Date(item.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    <code className="font-code text-cyan-400">{item.commitment.slice(0, 10)}...{item.commitment.slice(-4)}</code>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        item.status === "verified" ? "text-emerald-400" : "text-amber-400"
                      }
                    >
                      {item.status === "verified" ? "Verified ✓" : "Pending..."}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button className="flex items-center gap-1 text-primary hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Execution Logs Tab */}
      {activeTab === "logs" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-background/30">
                <th className="px-4 py-2 text-left text-muted">Step</th>
                <th className="px-4 py-2 text-left text-muted">Action</th>
                <th className="px-4 py-2 text-left text-muted">Amount</th>
                <th className="px-4 py-2 text-left text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={idx} className="border-b border-border/30 hover:bg-background/20">
                  <td className="px-4 py-2">
                    <code className="font-code text-cyan-400">{log.stepIndex + 1}</code>
                  </td>
                  <td className="px-4 py-2 text-muted">{log.action}</td>
                  <td className="px-4 py-2">
                    <span className="redacted text-red-400">████</span>
                  </td>
                  <td className="px-4 py-2">
                    {log.constraintsSatisfied ? (
                      <span className="text-emerald-400">✓ Satisfied</span>
                    ) : (
                      <span className="text-red-400">✗ Failed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ZK Constraints Tab */}
      {activeTab === "constraints" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-background/30">
                <th className="px-4 py-2 text-left text-muted">Node ID</th>
                <th className="px-4 py-2 text-left text-muted">Type</th>
                <th className="px-4 py-2 text-left text-muted">Public Inputs</th>
                <th className="px-4 py-2 text-left text-muted">Private Witness</th>
              </tr>
            </thead>
            <tbody>
              {constraints.map((c, idx) => (
                <tr key={idx} className="border-b border-border/30 hover:bg-background/20">
                  <td className="px-4 py-2">
                    <code className="font-code text-cyan-400">{c.nodeId.slice(0, 8)}...</code>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded px-2 py-1 bg-primary/20 text-primary text-[10px]">
                      {c.constraintType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted">{c.publicInputs.length} inputs</td>
                  <td className="px-4 py-2 text-muted">
                    <span className="text-red-400">{c.privateWitness.length} private values</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
