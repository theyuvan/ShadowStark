"use client";

import { Copy, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import type { Strategy } from "@/types";

interface StrategyCardProps {
  strategy: Strategy & { direction: "buy" | "sell"; status: "active" | "pending" | "complete" };
  onViewProof: (commitmentHash: string) => void;
}

export function StrategyCard({ strategy, onViewProof }: StrategyCardProps) {
  const isBuy = strategy.direction === "buy";
  const borderColor = isBuy ? "border-emerald-500" : "border-red-500";

  const commitment = Buffer.from(JSON.stringify(strategy.graph)).toString("hex").slice(0, 14);
  const shortCommit = `0x${commitment}...${commitment.slice(-4)}`;

  return (
    <motion.div
      whileHover={{ translateY: -1 }}
      className={`rounded-xl border-l-4 border-border bg-surface p-4 ${borderColor}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`rounded px-2 py-1 text-xs font-semibold ${
              isBuy
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {isBuy ? "BUY" : "SELL"}
          </div>
          <div className="rounded px-2 py-1 text-xs font-semibold bg-amber-500/20 text-amber-400">
            BTC
          </div>
        </div>
        <div
          className={`rounded px-2 py-1 text-xs font-semibold ${
            strategy.status === "active"
              ? "bg-cyan-500/20 text-cyan-400"
              : strategy.status === "pending"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-emerald-500/20 text-emerald-400"
          }`}
        >
          {strategy.status === "active"
            ? "Active"
            : strategy.status === "pending"
              ? "Pending Proof"
              : "Complete"}
        </div>
      </div>

      <div className="mb-3 space-y-1 text-xs text-muted">
        <div>
          Strategy: IF BTC [op] <span className="redacted text-red-400">████</span> → Split{" "}
          <span className="redacted text-red-400">████</span> → Execute{" "}
          <span className="redacted text-red-400">████</span> BTC
        </div>
        <div className="flex items-center gap-2">
          {strategy.status === "pending" ? (
            <>
              <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              <span>Proof pending...</span>
            </>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Proof verified ✓</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted">Commitment:</span>
          <code className="font-code text-cyan-400">{shortCommit}</code>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(commitment)}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewProof(commitment)}
          className="gap-1 text-xs text-primary hover:text-primary"
        >
          View proof <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}
