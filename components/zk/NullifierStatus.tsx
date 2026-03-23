"use client";
import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, CheckCircle, AlertCircle } from "lucide-react";

interface NullifierStatusProps {
  nullifier: bigint | null;
  isSpent: boolean;
  isNew: boolean;
}

/**
 * NullifierStatus: Displays nullifier state for replay attack prevention.
 * Shows:
 * - Nullifier hash (PUBLIC)
 * - Spent/Unspent status (PUBLIC, from on-chain)
 * - Animation on fresh nullifier generation
 * 
 * PRIVATE: Secret key is never shown or stored.
 */
export function NullifierStatus({
  nullifier,
  isSpent,
  isNew,
}: NullifierStatusProps) {
  const [showAnimation, setShowAnimation] = React.useState(false);

  useEffect(() => {
    if (isNew) {
      setShowAnimation(true);
      const timer = setTimeout(() => setShowAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const nullifierHex = nullifier
    ? "0x" + nullifier.toString(16).slice(0, 16)
    : "Not generated";

  return (
    <div className="w-full bg-gradient-to-b from-[#1E1E32] to-[#12121E] rounded-lg border border-[#2A2A3E] p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm font-semibold text-[#E0E0E8]">
            Nullifier (Replay Protection)
          </h3>
          <motion.div animate={{ scale: showAnimation ? 1.2 : 1 }}>
            <Shield
              size={20}
              className={showAnimation ? "text-[#00FF88]" : "text-[#666677]"}
            />
          </motion.div>
        </div>

        {/* Nullifier Display */}
        <div className="bg-[#0F0F17] rounded-lg p-4 border border-[#2A2A3E]">
          <div className="text-xs text-[#888899] mb-2">Nullifier Hash (PUBLIC)</div>
          <motion.div
            className="font-mono text-sm text-[#00FF88] break-all"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {nullifierHex}
          </motion.div>
        </div>

        {/* Status Indicator */}
        <div className="space-y-2">
          <div className="text-xs text-[#888899]">Status</div>
          <motion.div
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{
              backgroundColor: isSpent ? "#FF55001A" : "#00FF881A",
              borderLeft: `3px solid ${isSpent ? "#FF5500" : "#00FF88"}`,
            }}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {isSpent ? (
              <>
                <AlertCircle size={16} className="text-[#FF5500]" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#FF9944]">Already Spent</p>
                  <p className="text-xs text-[#FF7733]">
                    This execution cannot be replayed
                  </p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle size={16} className="text-[#00FF88]" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#00FF88]">Not Spent</p>
                  <p className="text-xs text-[#00CC66]">
                    {isNew ? "✓ Fresh nullifier" : "Ready for execution"}
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Info Box */}
        <div className="bg-[#0F0F17] rounded-lg p-4 text-xs text-[#888899] space-y-2 border border-[#2A2A3E]">
          <p>
            <span className="text-[#00FF88]">How it works:</span> Each strategy
            execution generates a unique nullifier. Once used, it&apos;s recorded
            on-chain to prevent the same execution from being replayed.
          </p>
          <p>
            <span className="text-[#FFA500]">Secret Key:</span> Never transmitted
            or stored. Only your browser computes the nullifier.
          </p>
        </div>

        {/* Animation pulse on fresh nullifier */}
        {showAnimation && (
          <motion.div
            className="absolute inset-0 rounded-lg border border-[#00FF88]"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.05, opacity: 0 }}
            transition={{ duration: 1 }}
          />
        )}
      </div>
    </div>
  );
}
