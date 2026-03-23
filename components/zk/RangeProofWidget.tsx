"use client";
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

interface RangeProofWidgetProps {
  valueCommitment: string; // Hashed value (PUBLIC)
  proofGenerated: boolean;
}

/**
 * RangeProofWidget: Visualizes range proof without revealing actual bounds or value.
 * Shows a number line with:
 * - Hidden bounds (zone shape only)
 * - Proof status indicator (shield icon)
 * - "Value is within bounds" confirmation
 * 
 * PRIVATE: lowerBound, upperBound, and actual value remain hidden from UI.
 */
export function RangeProofWidget({
  valueCommitment,
  proofGenerated,
}: RangeProofWidgetProps) {
  // Estimate bounds position (don't reveal actual values)
  const estimatedLowerPos = 20; // Visual position only, not actual value
  const estimatedUpperPos = 80;
  const estimatedValuePos = 50; // Visual position only

  const proofStatus = useMemo(() => {
    if (!proofGenerated) {
      return { text: "Pending", color: "#FFA500", icon: "○" };
    }
    return { text: "Verified", color: "#00FF88", icon: "✓" };
  }, [proofGenerated]);

  return (
    <div className="w-full bg-gradient-to-b from-[#1E1E32] to-[#12121E] rounded-lg border border-[#2A2A3E] p-6">
      <div className="space-y-4">
        {/* Title and Status */}
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm font-semibold text-[#E0E0E8]">
            Range Proof Status
          </h3>
          <motion.div
            className="flex items-center gap-2"
            animate={{ scale: proofGenerated ? 1.1 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: proofStatus.color }}
            />
            <span className="text-xs font-mono" style={{ color: proofStatus.color }}>
              {proofStatus.text}
            </span>
          </motion.div>
        </div>

        {/* Number Line Visualization */}
        <div className="space-y-2">
          <div className="text-xs text-[#888899]">Valid Range Zone (bounds PRIVATE)</div>
          <div className="relative h-12 bg-[#080810] rounded border border-[#2A2A3E] overflow-hidden">
            {/* Track background */}
            <div
              className="absolute inset-y-0 bg-gradient-to-r from-[#FF550033] to-[#00FF8833]"
              style={{
                left: `${estimatedLowerPos}%`,
                right: `${100 - estimatedUpperPos}%`,
              }}
            />

            {/* Bounds markers (visual only, values not shown) */}
            <motion.div
              className="absolute top-1/2 transform -translate-y-1/2 w-1 h-8 bg-[#FF5500] rounded"
              style={{ left: `${estimatedLowerPos}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.3 }}
            />

            <motion.div
              className="absolute top-1/2 transform -translate-y-1/2 w-1 h-8 bg-[#FF5500] rounded"
              style={{ right: `${100 - estimatedUpperPos}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.4 }}
            />

            {/* Value indicator (hidden, but shown as position) */}
            <motion.div
              className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-[#00FF88] rounded-full shadow-lg"
              style={{ left: `${estimatedValuePos}%`, marginLeft: "-6px" }}
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(0, 255, 136, 0.7)",
                  "0 0 8px 4px rgba(0, 255, 136, 0.4)",
                ],
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />

            {/* Tooltip on hover */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-xs font-mono text-[#00FF88]">
                ████ (value hidden)
              </div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-[#666677] px-1">
            <span>0</span>
            <span>████</span>
            <span>max</span>
          </div>
        </div>

        {/* Proof Details */}
        <div className="space-y-2 pt-4 border-t border-[#2A2A3E]">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[#00FF88]" />
            <span className="text-xs text-[#B0B0B8]">
              Proof confirms value is within valid bounds
            </span>
          </div>

          <div className="bg-[#0F0F17] rounded p-3 text-xs font-mono space-y-1">
            <div className="text-[#666677]">
              <span className="text-[#888899]">commitment:</span>{" "}
              <span className="text-[#B0B0B8]">
                {valueCommitment.slice(0, 16)}...
              </span>
            </div>
            <div className="text-[#666677]">
              <span className="text-[#888899]">range_bits:</span>{" "}
              <span className="text-[#00FF88]">[████████]</span> (64-bit decomposition)
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="pt-2 text-center">
          {proofGenerated ? (
            <p className="text-xs text-[#00FF88]">✓ Range proof verified</p>
          ) : (
            <p className="text-xs text-[#FFA500]">⧖ Generating range proof...</p>
          )}
        </div>
      </div>
    </div>
  );
}
