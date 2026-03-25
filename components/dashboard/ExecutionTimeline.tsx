"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ExecutionLog } from "@/types";

interface ExecutionTimelineProps {
  logs: ExecutionLog[];
}

export function ExecutionTimeline({ logs }: ExecutionTimelineProps) {
  const data = logs.length
    ? logs.map((log) => ({ step: String(log.stepIndex + 1), activity: log.constraintsSatisfied ? 1 : 0 }))
    : [{ step: "0", activity: 0 }];

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-4 font-heading text-sm font-semibold">Execution Timeline</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" vertical={false} />
          <XAxis
            dataKey="step"
            stroke="rgba(99,102,241,0.5)"
            style={{ fontSize: "12px" }}
            tick={{ fill: "rgba(99,102,241,0.7)" }}
          />
          <YAxis
            stroke="rgba(99,102,241,0.5)"
            style={{ fontSize: "12px" }}
            tick={{ fill: "rgba(99,102,241,0.7)" }}
          />
          <Tooltip
            contentStyle={{
              background: "#0E0E1C",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#6366F1" }}
            formatter={() => ["Activity (masked for privacy)", "Value"]}
          />
          <Area type="monotone" dataKey="activity" stroke="#6366F1" fillOpacity={1} fill="url(#colorActivity)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
