"use client";

import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  change?: string;
}

export function MetricCard({ label, value, icon, change }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted">{label}</span>
        <div className="text-lg text-primary">{icon}</div>
      </div>
      <div className="text-2xl font-heading font-semibold text-foreground">{value}</div>
      {change && <p className="mt-2 text-xs text-muted">{change}</p>}
    </div>
  );
}
