"use client";

import { Copy, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";

export interface StrategyCardData {
  id: string;
  direction: "buy" | "sell";
  status: "open" | "matched" | "settled";
  commitment: string;
  createdAt: number;
}

interface StrategyCardProps {
  strategy: StrategyCardData;
  onViewProof: (commitmentHash: string) => void;
  onInspect: (commitmentHash: string) => void;
}

export function StrategyCard({ strategy, onViewProof, onInspect }: StrategyCardProps) {
  const isBuy = strategy.direction === "buy";
  const borderColor = isBuy ? "border-emerald-500" : "border-red-500";

  const shortCommit = `${strategy.commitment.slice(0, 14)}...${strategy.commitment.slice(-4)}`;

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
            strategy.status === "open"
              ? "bg-cyan-500/20 text-cyan-400"
              : strategy.status === "matched"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-emerald-500/20 text-emerald-400"
          }`}
        >
          {strategy.status === "open" ? "Open" : strategy.status === "matched" ? "Matched" : "Settled"}
        </div>
      </div>

      <div className="mb-3 space-y-1 text-xs text-muted">
        <div>
          Strategy: IF BTC [op] <span className="redacted text-red-400">████</span> → Split{" "}
          <span className="redacted text-red-400">████</span> → Execute{" "}
          <span className="redacted text-red-400">████</span> BTC
        </div>
        <div className="flex items-center gap-2">
          {strategy.status !== "settled" ? (
            <>
              <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              <span>{strategy.status === "open" ? "Waiting for counter-order..." : "Partially matched..."}</span>
            </>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Settled with shared proof ✓</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted">Commitment:</span>
          <code className="font-code text-cyan-400">{shortCommit}</code>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(strategy.commitment)}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        {strategy.status === "settled" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewProof(strategy.commitment)}
            className="gap-1 text-xs text-primary hover:text-primary"
          >
            View proof <ExternalLink className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onInspect(strategy.commitment)}
            className="gap-1 text-xs text-cyan-400 hover:text-cyan-300"
          >
            Inspect order <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
