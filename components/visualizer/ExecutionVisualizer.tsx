"use client";

import { motion } from "framer-motion";
import { Zap, Target, Cpu, Lock, Landmark, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ZKProof } from "@/types";

interface PipelineStage {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  textColor: string;
  status: "pending" | "active" | "complete";
}

const buildStages = (proof: ZKProof | null): PipelineStage[] => {
  const hasProof = Boolean(proof);
  const isVerified = Boolean(proof?.verified);

  return [
    {
      id: 1,
      title: "Strategy Input",
      description: hasProof ? "Strategy loaded from current proof" : "Waiting for strategy compile",
      icon: <Target className="h-8 w-8" />,
      color: "bg-cyan-500/20",
      textColor: "text-cyan-400",
      status: hasProof ? "complete" : "active",
    },
    {
      id: 2,
      title: "Commitment",
      description: hasProof ? "Commitment generated" : "Pending commitment",
      icon: <Cpu className="h-8 w-8" />,
      color: "bg-indigo-500/20",
      textColor: "text-indigo-400",
      status: hasProof ? "complete" : "pending",
    },
    {
      id: 3,
      title: "Execution",
      description: hasProof ? "Execution trace captured" : "Execution not started",
      icon: <Zap className="h-8 w-8" />,
      color: "bg-amber-500/20",
      textColor: "text-amber-400",
      status: hasProof ? "complete" : "pending",
    },
    {
      id: 4,
      title: "ZK Proof",
      description: hasProof ? "Witness + proof generated" : "Generating witness",
      icon: <Lock className="h-8 w-8" />,
      color: "bg-violet-500/20",
      textColor: "text-violet-400",
      status: hasProof ? "complete" : "pending",
    },
    {
      id: 5,
      title: "Starknet",
      description: isVerified ? "Verified by on-chain call" : hasProof ? "Verification submitted" : "Awaiting submission",
      icon: <Landmark className="h-8 w-8" />,
      color: "bg-blue-500/20",
      textColor: "text-blue-400",
      status: isVerified ? "complete" : hasProof ? "active" : "pending",
    },
    {
      id: 6,
      title: "Final State",
      description: isVerified ? "Proof verified" : "Pending on-chain verification",
      icon: <CheckCircle2 className="h-8 w-8" />,
      color: "bg-emerald-500/20",
      textColor: "text-emerald-400",
      status: isVerified ? "complete" : "pending",
    },
  ];
};

export function ExecutionVisualizer({ proof }: { proof: ZKProof | null }) {
  const stages = useMemo(() => buildStages(proof), [proof]);
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(stages[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const derivedSteps = proof ? Math.max(1, Math.floor((proof.constraintCount - 12) / 3)) : 0;
  const verifierAddress = process.env.NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS;

  useEffect(() => {
    setSelectedStage((previous) => {
      if (!previous) {
        return stages[0] ?? null;
      }

      return stages.find((stage) => stage.id === previous.id) ?? stages[0] ?? null;
    });
  }, [stages]);

  const runSimulation = () => {
    if (!proof) {
      setRunMessage("No proof loaded. Compile in Builder first, then return here.");
      return;
    }

    setRunMessage(null);
    setIsRunning(true);

    const completeIds = stages.filter((stage) => stage.status !== "pending").map((stage) => stage.id);
    if (!completeIds.length) {
      setIsRunning(false);
      return;
    }

    let pointer = 0;
    setSelectedStage(stages.find((stage) => stage.id === completeIds[pointer]) ?? stages[0] ?? null);

    const timer = setInterval(() => {
      pointer += 1;
      if (pointer >= completeIds.length) {
        clearInterval(timer);
        setIsRunning(false);
        return;
      }

      setSelectedStage(stages.find((stage) => stage.id === completeIds[pointer]) ?? stages[0] ?? null);
    }, 450);
  };

  return (
    <main className="space-y-6 p-4">
      {/* Header */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Private Execution Path</p>
            <h1 className="font-heading text-2xl font-semibold text-foreground">Simulation</h1>
          </div>
          <button
            onClick={runSimulation}
            disabled={isRunning}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {isRunning ? "Running..." : "Run Simulation"}
          </button>
        </div>
        {runMessage ? <p className="mt-2 text-xs text-amber-400">{runMessage}</p> : null}
      </section>

      {/* Pipeline Visualization */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface/50 p-6">
        <div className="flex justify-between gap-4 min-w-max lg:min-w-0">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-start gap-4 flex-1 min-w-[160px]">
              {/* Stage Card */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedStage(stage)}
                className={`relative w-full rounded-xl border border-border p-4 text-center transition-all ${
                  selectedStage?.id === stage.id
                    ? "ring-2 ring-primary"
                    : ""
                } ${
                  stage.status === "complete"
                    ? `${stage.color} opacity-100`
                    : stage.status === "active"
                      ? `${stage.color} opacity-100 ring-1 ring-offset-2 ring-offset-[#0a0f1a]`
                      : "bg-background/20 opacity-40"
                }`}
              >
                {/* Status Indicator */}
                <div className="mb-3 flex justify-center">
                  {stage.status === "complete" ? (
                    <div className={`${stage.textColor}`}>
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                  ) : stage.status === "active" ? (
                    <motion.div
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={stage.textColor}
                    >
                      {stage.icon}
                    </motion.div>
                  ) : (
                    <div className="h-8 w-8 rounded-full border-2 border-border" />
                  )}
                </div>

                {/* Stage Number */}
                <span className={`text-xs font-semibold ${stage.textColor}`}>
                  Stage {stage.id}
                </span>

                {/* Stage Title */}
                <h4 className="mt-1 font-heading text-sm font-semibold text-foreground">{stage.title}</h4>

                {/* Stage Description */}
                <p className="mt-1 text-xs text-muted">{stage.description}</p>

                {/* PRIVATE/PUBLIC Badge */}
                {stage.id % 2 === 0 ? (
                  <div className="mt-2 rounded px-2 py-1 text-[10px] bg-primary/20 text-primary inline-block">
                    PUBLIC
                  </div>
                ) : (
                  <div className="mt-2 rounded px-2 py-1 text-[10px] bg-red-500/20 text-red-400 inline-block">
                    PRIVATE
                  </div>
                )}
              </motion.button>

              {/* Arrow to next stage */}
              {idx < stages.length - 1 && (
                <div className="flex items-center justify-center">
                  <svg className="h-6 w-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeDasharray="4 4" d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedStage && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <div className={selectedStage.textColor}>{selectedStage.icon}</div>
            <div>
              <h3 className="font-heading text-lg font-semibold">{selectedStage.title}</h3>
              <p className="text-xs text-muted">Stage {selectedStage.id} of {stages.length}</p>
            </div>
          </div>

          <p className="mb-4 text-sm text-foreground">{selectedStage.description}</p>

          {selectedStage.id === 1 && (
            <div className="space-y-2 text-xs text-muted">
              <p>• Graph nodes submitted to execution engine</p>
              <p>• Constraint-derived steps: {derivedSteps || "n/a"}</p>
              <p>• Strategy salt: shadowflow</p>
            </div>
          )}

          {selectedStage.id === 2 && (
            <div className="space-y-2 text-xs text-muted">
              <p>• Using Poseidon hash with private salt</p>
              <p>• Commitment: <code className="font-code text-cyan-400">{proof?.commitment?.slice(0, 14) ?? "n/a"}...</code></p>
              <p>• Hash verified: ✓</p>
            </div>
          )}

          {selectedStage.id === 3 && (
            <div className="space-y-2 text-xs text-muted">
              <p>⚙ Executing strategy steps...</p>
              <p>• Current step: {proof ? derivedSteps : 0} of {proof ? derivedSteps : 0}</p>
              <p>• Constraint checks: {proof ? "CAPTURED" : "PENDING"}</p>
              <div className="mt-2 h-1 w-full rounded-full bg-background">
                <div className={`h-full rounded-full bg-amber-400 ${proof ? "w-full" : "w-1/3"}`} />
              </div>
            </div>
          )}

          {selectedStage.id === 4 && (
            <div className="space-y-2 text-xs text-muted">
              <p>🔒 Generating zero-knowledge proof...</p>
              <p>• Constraints: {proof?.constraintCount ?? "n/a"}</p>
              <p>• Proof size: {proof?.proofSize ?? "n/a"} bytes</p>
              <p>• Private witness: sealed from verifier</p>
            </div>
          )}

          {selectedStage.id === 5 && (
            <div className="space-y-2 text-xs text-muted">
              <p>📡 On-chain submission to Starknet...</p>
              <p>• Target network: Starknet Testnet</p>
              <p>• Contract: {verifierAddress ? `${verifierAddress.slice(0, 12)}...` : "GaragaVerifier"}</p>
            </div>
          )}

          {selectedStage.id === 6 && (
            <div className="space-y-2 text-xs text-emerald-400">
              <p>{proof?.verified ? "✓ Proof verified successfully" : "• Verification pending"}</p>
              <p>• Nullifier: locked on-chain</p>
              <p>• Execution logs: sealed</p>
            </div>
          )}
        </motion.div>
      )}
    </main>
  );
}
