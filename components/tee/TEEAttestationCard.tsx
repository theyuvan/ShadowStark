"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import type { TEEAttestation } from "@/types";

interface TEEAttestationCardProps {
  attestation?: TEEAttestation | null;
}

export function TEEAttestationCard({ attestation }: TEEAttestationCardProps) {
  if (!attestation) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-heading text-lg font-semibold">TEE Attestation</h3>
        <p className="mt-2 text-xs text-muted">No attestation available yet. Execute a real strategy to generate one.</p>
      </div>
    );
  }

  const data = attestation;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-surface p-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-semibold">TEE Attestation</h3>
          <p className="text-xs text-muted">Intel SGX enclaved execution</p>
        </div>
      </div>

      {/* Attestation Details */}
      <div className="space-y-3 border-t border-border pt-4">
        {/* Type */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Type</span>
          <span className="font-heading font-semibold text-emerald-400">{data.enclaveType}</span>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Status</span>
          <motion.div
            animate={data.valid ? { opacity: [0.8, 1, 0.8] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className={`rounded px-2 py-1 text-xs font-semibold ${
              data.valid
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {data.valid ? "✓ Valid" : "✗ Invalid"}
          </motion.div>
        </div>

        {/* Measurement Hash */}
        <div className="space-y-1">
          <span className="text-sm text-muted">Measurement Hash (MRENCLAVE)</span>
          <code className="block truncate rounded bg-background/50 px-2 py-1 text-[10px] text-cyan-400 font-code">
            {data.measurementHash}
          </code>
        </div>

        {/* Timestamp */}
        <div>
          <span className="text-xs text-muted">Attested</span>
          <p className="text-xs font-semibold text-foreground">
            {new Date(data.timestamp).toLocaleDateString()} @ {new Date(data.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 border-t border-border pt-3">
        <button className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-foreground hover:bg-background transition-colors">
          Verify on Starknet
        </button>
      </div>
    </motion.div>
  );
}
