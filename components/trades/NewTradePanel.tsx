"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { TradeIntentPayload } from "@/lib/otcClient";

interface NewTradePanelProps {
  walletAddress: string | null;
  submitting?: boolean;
  onSubmitIntent: (payload: Omit<TradeIntentPayload, "walletAddress">) => Promise<void>;
}

export function NewTradePanel({ walletAddress, submitting = false, onSubmitIntent }: NewTradePanelProps) {
  const router = useRouter();
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [showConfig, setShowConfig] = useState(false);
  const [templateId, setTemplateId] = useState<"simple" | "split" | "guarded">("simple");
  const [priceThreshold, setPriceThreshold] = useState<number | "">(43000);
  const [amount, setAmount] = useState<number | "">(0.1);
  const [splitCount, setSplitCount] = useState(3);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleTemplateSelect = (template: "simple" | "split" | "guarded") => {
    setShowConfig(true);
    setTemplateId(template);
  };

  const handleOpenBuilder = () => {
    router.push("/builder");
  };

  const handleCreateIntent = async () => {
    setSubmitError(null);

    if (!walletAddress) {
      setSubmitError("Connect wallet before creating intents.");
      return;
    }

    if (!priceThreshold || !amount) {
      setSubmitError("Price and amount are required.");
      return;
    }

    try {
      await onSubmitIntent({
        direction,
        templateId,
        priceThreshold,
        amount,
        splitCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit intent.";
      setSubmitError(message);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <h3 className="font-heading text-lg font-semibold">Create Strategy</h3>

      {/* Direction Toggle */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-widest">Direction</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setDirection("buy")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all ${
              direction === "buy"
                ? "bg-emerald-500 text-white"
                : "border border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            BUY
          </button>
          <button
            onClick={() => setDirection("sell")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all ${
              direction === "sell"
                ? "bg-red-500 text-white"
                : "border border-red-500/40 text-red-500 hover:bg-red-500/10"
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            SELL
          </button>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-widest">Quick Templates</Label>
        <div className="space-y-2">
          {([
            { id: "simple", name: "Simple Buy/Sell", desc: "Condition → Execute" },
            { id: "split", name: "Split & Trade", desc: "Condition → Split → Execute" },
            { id: "guarded", name: "Guarded Trade", desc: "Condition + Constraint → Split → Execute" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => handleTemplateSelect(t.id)}
              className="w-full rounded-lg border border-border bg-background/50 p-3 text-left text-xs hover:border-primary/50 hover:bg-background/75 transition-all"
            >
              <div className="font-semibold text-foreground">{t.name}</div>
              <div className="text-muted">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Config (shown after template selected) */}
      {showConfig && (
        <div className="space-y-3 border-t border-border/50 pt-3">
          <div>
            <Label className="text-xs">Price Threshold (USD)</Label>
            <Input
              type="number"
              value={priceThreshold}
              onChange={(e) => setPriceThreshold(e.target.value ? Number(e.target.value) : "")}
              className="mt-1 bg-elevated text-sm"
              placeholder="43000"
            />
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1">
              Amount (BTC) <Badge variant="private" className="ml-auto text-[10px]">PRIVATE</Badge>
            </Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
              className="mt-1 bg-elevated text-sm"
              placeholder="0.1"
            />
          </div>

          <div>
            <Label className="text-xs">Split into {splitCount} parts</Label>
            <input
              type="range"
              min="1"
              max="10"
              value={splitCount}
              onChange={(e) => setSplitCount(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>

          <Button onClick={handleOpenBuilder} className="w-full">
            Open in Builder →
          </Button>

          <Button onClick={handleCreateIntent} className="w-full" disabled={submitting || !walletAddress}>
            {submitting ? "Submitting Intent..." : "Submit OTC Intent"}
          </Button>

          {!walletAddress ? (
            <p className="text-xs text-amber-400">Wallet required for BUY/SELL intent submission.</p>
          ) : null}

          {submitError ? <p className="text-xs text-red-400">{submitError}</p> : null}
        </div>
      )}
    </div>
  );
}
