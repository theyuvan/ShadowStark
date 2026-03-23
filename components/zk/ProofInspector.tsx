"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Eye, Lock } from "lucide-react";
import { ZKProof } from "@/types";

interface ProofInspectorProps {
  proof: ZKProof | null;
}

/**
 * ProofInspector: Accordion interface showing proof structure.
 * PUBLIC section: Expanded by default, shows commitment, finalhash, nullifier, merkleRoot
 * PRIVATE section: Collapsed by default, shows count of hidden elements, lock icon
 * 
 * PRIVATE fields remain fully redacted in UI.
 */
export function ProofInspector({ proof }: ProofInspectorProps) {
  const [expandedPublic, setExpandedPublic] = useState(true);
  const [expandedPrivate, setExpandedPrivate] = useState(false);

  if (!proof) {
    return (
      <div className="w-full bg-gradient-to-b from-[#1E1E32] to-[#12121E] rounded-lg border border-[#2A2A3E] p-6">
        <p className="text-sm text-[#888899] text-center">
          Generate a proof to inspect its structure
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-b from-[#1E1E32] to-[#12121E] rounded-lg border border-[#2A2A3E] overflow-hidden">
      {/* Proof Hash */}
      <div className="p-4 border-b border-[#2A2A3E]">
        <div className="text-xs text-[#888899] mb-2">Proof Hash</div>
        <div className="font-mono text-sm text-[#00FF88] break-all">
          {proof.proofHash}
        </div>
      </div>

      {/* PUBLIC Section */}
      <motion.div className="border-b border-[#2A2A3E]">
        <button
          onClick={() => setExpandedPublic(!expandedPublic)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1A1A28] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-[#00FF88]" />
            <span className="font-semibold text-[#E0E0E8]">PUBLIC Inputs</span>
            <span className="text-xs px-2 py-1 bg-[#00FF881A] text-[#00FF88] rounded">
              Visible on-chain
            </span>
          </div>
          <motion.div animate={{ rotate: expandedPublic ? 180 : 0 }}>
            <ChevronDown size={18} className="text-[#888899]" />
          </motion.div>
        </button>

        <AnimatePresence>
          {expandedPublic && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 bg-[#0F0F17] space-y-3">
                <div>
                  <div className="text-xs text-[#666677]">commitment</div>
                  <div className="font-mono text-sm text-[#00FF88]">
                    {proof.commitment.slice(0, 32)}...
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#666677]">finalStateHash</div>
                  <div className="font-mono text-sm text-[#00FF88]">
                    {proof.finalStateHash.slice(0, 32)}...
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#666677]">nullifier</div>
                  <div className="font-mono text-sm text-[#00FF88]">
                    {proof.nullifier}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#666677]">merkleRoot</div>
                  <div className="font-mono text-sm text-[#00FF88]">
                    {proof.merkleRoot}
                  </div>
                </div>
                <div className="pt-2 border-t border-[#2A2A3E] grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-[#666677]">constraints</div>
                    <div className="font-mono text-sm text-[#00FF88]">
                      {proof.constraintCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#666677]">proof_size</div>
                    <div className="font-mono text-sm text-[#00FF88]">
                      {proof.proofSize} bytes
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* PRIVATE Section */}
      <motion.div>
        <button
          onClick={() => setExpandedPrivate(!expandedPrivate)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1A1A28] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-[#FF5500]" />
            <span className="font-semibold text-[#E0E0E8]">PRIVATE Witnesses</span>
            <span className="text-xs px-2 py-1 bg-[#FF55001A] text-[#FF5500] rounded">
              Never shown
            </span>
          </div>
          <motion.div animate={{ rotate: expandedPrivate ? 180 : 0 }}>
            <ChevronDown size={18} className="text-[#888899]" />
          </motion.div>
        </button>

        <AnimatePresence>
          {expandedPrivate && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 bg-[#0F0F17] space-y-3 border-t border-[#2A2A3E]">
                <div className="flex items-start gap-3">
                  <Lock size={16} className="text-[#FF5500] mt-1 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-[#FF9944]">
                      Hidden from UI
                    </div>
                    <div className="text-xs text-[#FF7733] mt-2 space-y-1">
                      <p>✓ Merkle tree path elements</p>
                      <p>✓ Range proof bit decomposition</p>
                      <p>✓ Strategy execution steps</p>
                      <p>✓ Trade parameters (amount, price bounds)</p>
                      <p>✓ Nullifier secret key</p>
                      <p>✓ Blinding factors</p>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#2A2A3E]">
                  <div className="text-xs text-[#888899]">
                    Private witnesses are computed locally and never transmitted.
                    Only PUBLIC outputs (commitment, nullifier, merkleRoot) leave
                    your browser.
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Verification Status */}
      <div className="px-4 py-3 bg-[#0F0F17] border-t border-[#2A2A3E]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#00FF88] rounded-full" />
          <span className="text-xs font-mono text-[#00FF88]">
            {proof.verified ? "Verified on-chain" : "Pending on-chain verification"}
          </span>
        </div>
        <div className="text-xs text-[#666677] mt-2">
          Generated {new Date(proof.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
