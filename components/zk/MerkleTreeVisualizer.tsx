"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Trees } from "lucide-react";
import { poseidonHash } from "@scure/starknet";
import type { ProofMerklePath } from "@/types";

interface MerkleTreeVisualizerProps {
  root?: bigint;
  leafCount?: number;
  depth?: number;
  highlightedLeaf?: number;
  merklePath?: ProofMerklePath;
}

const toBigInt = (hex: string): bigint => BigInt(hex.startsWith("0x") ? hex : `0x${hex}`);
const shortHex = (hex: string) => `${hex.slice(0, 14)}...${hex.slice(-8)}`;

export function MerkleTreeVisualizer({
  root = 0n,
  leafCount = 0,
  depth = 0,
  highlightedLeaf,
  merklePath,
}: MerkleTreeVisualizerProps) {
  const pathSteps = useMemo(() => {
    if (!merklePath) {
      return [] as Array<{ level: number; side: "left" | "right"; sibling: string; parent: string }>;
    }

    let current = toBigInt(merklePath.leaf);
    return merklePath.pathElements.map((siblingHex, level) => {
      const sibling = toBigInt(siblingHex);
      const isRight = merklePath.pathIndices[level] === 1;
      const parent = isRight ? poseidonHash(sibling, current) : poseidonHash(current, sibling);
      const parentHex = `0x${parent.toString(16)}`;
      current = parent;

      return {
        level,
        side: isRight ? "right" : "left",
        sibling: siblingHex,
        parent: parentHex,
      };
    });
  }, [merklePath]);

  const computedRoot = pathSteps.length ? pathSteps[pathSteps.length - 1].parent : null;
  const displayedRootHex = merklePath?.root ?? `0x${root.toString(16)}`;
  const rootMatches = computedRoot ? computedRoot.toLowerCase() === displayedRootHex.toLowerCase() : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20">
          <Trees className="h-6 w-6 text-indigo-400" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-semibold">Merkle Path (Real)</h3>
          <p className="text-xs text-muted">{leafCount} leaves, depth {depth}</p>
        </div>
      </div>

      {!merklePath ? (
        <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted">
          No Merkle proof path available yet. Compile and generate a proof to render full cryptographic path.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background/50 p-3 text-xs">
            <p className="text-muted">Leaf</p>
            <code className="font-code text-cyan-400">{shortHex(merklePath.leaf)}</code>
            {highlightedLeaf !== undefined ? (
              <p className="mt-1 text-muted">Leaf index: {highlightedLeaf}</p>
            ) : null}
          </div>

          <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-border bg-background/40 p-3">
            {pathSteps.map((step) => (
              <div key={`merkle-step-${step.level}`} className="rounded border border-border/70 bg-base p-2 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-muted">Level {step.level}</span>
                  <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] text-primary">
                    current is {step.side}
                  </span>
                </div>
                <p className="text-muted">Sibling: <code className="font-code text-cyan-400">{shortHex(step.sibling)}</code></p>
                <p className="text-muted">Parent: <code className="font-code text-emerald-400">{shortHex(step.parent)}</code></p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-background/50 p-3 text-xs">
            <p className="text-muted">Root</p>
            <code className="font-code text-cyan-400">{shortHex(displayedRootHex)}</code>
            <p className={`mt-2 ${rootMatches ? "text-emerald-400" : "text-amber-400"}`}>
              {rootMatches ? "✓ Computed path root matches proof root" : "⧖ Root check pending / mismatch"}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
