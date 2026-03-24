"use client";

import { ExternalLink } from "lucide-react";
import type { TradeRecord } from "@/types";

interface TradeHistoryProps {
  trades: TradeRecord[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  if (!trades.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border/50 bg-surface/50 text-xs text-muted">
        No trade history yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/50 bg-surface/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50 bg-background/50">
            <th className="px-4 py-3 text-left text-muted">Date</th>
            <th className="px-4 py-3 text-left text-muted">Direction</th>
            <th className="px-4 py-3 text-left text-muted">Status</th>
            <th className="px-4 py-3 text-left text-muted">Commitment</th>
            <th className="px-4 py-3 text-left text-muted">Action</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, idx) => (
            <tr
              key={trade.id}
              className={`border-b border-border/30 transition-colors hover:bg-surface/50 ${
                idx % 2 === 0 ? "bg-background/20" : ""
              }`}
            >
              <td className="px-4 py-2 text-muted">
                {new Date(trade.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="px-4 py-2">
                <span
                  className={trade.direction === "buy" ? "text-emerald-400" : "text-red-400"}
                >
                  {trade.direction.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-2">
                <span
                  className={
                    trade.status === "complete"
                      ? "text-emerald-400"
                      : trade.status === "active"
                        ? "text-cyan-400"
                        : "text-amber-400"
                  }
                >
                  {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
                </span>
              </td>
              <td className="px-4 py-2">
                <code className="font-code text-cyan-400">
                  {trade.commitment.slice(0, 10)}...{trade.commitment.slice(-4)}
                </code>
              </td>
              <td className="px-4 py-2">
                <button className="flex items-center gap-1 text-primary hover:underline">
                  View Proof <ExternalLink className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
