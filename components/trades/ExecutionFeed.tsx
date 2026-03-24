"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

import type { ExecutionLog } from "@/types";

interface ExecutionFeedProps {
  logs: ExecutionLog[];
}

const actionColors: Record<ExecutionLog["action"], string> = {
  CONDITION_CHECK: "text-cyan-400",
  SPLIT: "text-amber-400",
  EXECUTE: "text-emerald-400",
  CONSTRAINT_PASS: "text-violet-400",
  DELAY: "text-muted",
};

const actionLabels: Record<ExecutionLog["action"], string> = {
  CONDITION_CHECK: "Condition Check",
  SPLIT: "Split Distribution",
  EXECUTE: "Execute Trade",
  CONSTRAINT_PASS: "Constraint OK",
  DELAY: "Waiting",
};

export function ExecutionFeed({ logs }: ExecutionFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!logs.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-border/50 bg-surface/50 text-xs text-muted">
        No execution logs yet
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="space-y-1 overflow-y-auto rounded-xl border border-border/50 bg-surface/50 p-3"
      style={{ maxHeight: "320px" }}
    >
      {logs.map((log, idx) => (
        <div key={idx} className="flex items-center justify-between gap-2 border-b border-border/20 pb-2 text-xs last:border-0 last:pb-0">
          <div className="flex items-center gap-2 flex-1">
            <code className="font-code text-muted">{log.stepIndex + 1}</code>
            <div className={`font-semibold ${actionColors[log.action]}`}>
              {actionLabels[log.action]}
            </div>
            <span className="ml-auto text-muted">Amount: <span className="redacted text-red-400">███</span></span>
          </div>
          {log.constraintsSatisfied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <div className="h-4 w-4 rounded border border-red-400 opacity-50" />
          )}
        </div>
      ))}
    </div>
  );
}
