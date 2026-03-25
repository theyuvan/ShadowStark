"use client";

import { useProofStore } from "@/store/proofStore";

const steps = ["Serialize", "Hash", "Prove", "Verify"];

export function ProofStatusCard() {
  const { status, progress } = useProofStore();

  const currentStep =
    status === "idle" ? 0 : status === "generating" ? 2 : status === "verifying" ? 3 : steps.length;

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (currentStep / steps.length) * circumference;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-4 font-heading text-sm font-semibold">ZK Proof Status</h3>

      <div className="flex flex-col items-center">
        <div className="relative h-40 w-40">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(99,102,241,0.2)"
              strokeWidth="3"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#A855F7"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <p className="text-2xl font-heading font-semibold text-foreground">
                {status === "idle" ? 0 : Math.max(progress, Math.round((currentStep / steps.length) * 100))}%
              </p>
              <p className="text-xs text-muted">{status === "complete" ? "Complete" : status === "error" ? "Error" : "In Progress"}</p>
            </div>
          </div>
        </div>

        {/* Step Labels */}
        <div className="mt-6 flex w-full justify-between gap-2 text-[10px]">
          {steps.map((step, idx) => (
            <div
              key={step}
              className={`flex flex-col items-center gap-1 ${
                idx < currentStep
                  ? "text-emerald-400"
                  : idx === currentStep
                    ? "text-amber-400"
                    : "text-muted"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  idx < currentStep
                    ? "bg-emerald-400"
                    : idx === currentStep
                      ? "bg-amber-400 animate-pulse"
                      : "bg-border"
                }`}
              />
              <span>{step}</span>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <button className="mt-6 w-full rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors">
          Generate New Proof
        </button>
      </div>
    </div>
  );
}
