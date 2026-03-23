"use client";

import { useCallback, useRef, useEffect } from "react";
import { ZKProver, verifyZKProof } from "@/lib/zk/zkProver";
import { useProofStore } from "@/store/proofStore";
import { useStrategyStore } from "@/store/strategyStore";
import { useZKStore } from "@/store/zkStore";
import { useMerkleTree } from "./useMerkleTree";
import { useNullifier } from "./useNullifier";
import { ZKProof } from "@/types";

/**
 * useZKProver: Comprehensive hook for orchestrating zero-knowledge proof generation.
 * Integrates:
 * - Merkle tree insertion (authenticity)
 * - Range proof generation (bounds validation)
 * - Nullifier creation (replay protection)
 * - Proof aggregation
 * 
 * All PRIVATE operations stay local; only PUBLIC outputs are transmitted.
 */
export function useZKProver() {
  const { graph, commitment } = useStrategyStore();
  const { setProofGenerating, setVerifying, setErrorMessage, setCurrentProof, addProofToHistory } = useZKStore();
  const { startProofGeneration, setProgress, setProof, setStatus } = useProofStore();

  const { insertLeaf, getRoot } = useMerkleTree();
  const { generateNewNullifier, checkNullifierSpent, consumeNullifier } = useNullifier();

  const proverRef = useRef<ZKProver | null>(null);

  // Initialize ZK prover on mount
  useEffect(() => {
    if (!proverRef.current) {
      proverRef.current = new ZKProver(20); // Depth 20
    }
  }, []);

  /**
   * Main proof generation pipeline.
   * PRIVATE data: tradeAmount, price bounds, execution steps, secret key — all local.
   * PUBLIC output: commitment, nullifier, merkleRoot, finalStateHash.
   */
  const generateProof = useCallback(
    async (strategyData: {
      tradeAmount: bigint;
      priceLower: bigint;
      priceUpper: bigint;
      executionSteps: string[];
    }) => {
      if (!proverRef.current || !commitment) {
        throw new Error("Prover or commitment not initialized");
      }

      try {
        setProofGenerating(true);
        startProofGeneration();
        setProgress(10);
        setStatus("generating");

        // Step 1: Generate nullifier (prevents replay)
        setProgress(25);
        const strategyHashBig = BigInt("0x" + commitment.slice(0, 16));
        const executionIndex = BigInt(Date.now());
        const nullifier = generateNewNullifier(strategyHashBig, executionIndex);

        // Check nullifier not already spent
        if (checkNullifierSpent(nullifier)) {
          throw new Error("Replay detected: nullifier already spent");
        }

        // Step 2: Insert strategy into Merkle tree
        setProgress(40);
        insertLeaf(strategyHashBig);
        const merkleRoot = getRoot();

        // Step 3: Generate complete zero-knowledge proof
        setProgress(60);
        const executionState = {
          finalStateHash: "0x" + BigInt(Date.now()).toString(16),
          secretKey: BigInt(
            "0x" +
              Array.from(crypto.getRandomValues(new Uint8Array(32)))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")
          ),
        };

        const blindingFactor = BigInt(
          "0x" +
            Array.from(crypto.getRandomValues(new Uint8Array(32)))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
        );

        const proof = await proverRef.current.generateProof(
          commitment,
          {
            salt: "0x0", // Default salt
            ...strategyData,
          },
          executionState,
          blindingFactor
        );

        // Step 4: Verify proof locally
        setProgress(75);
        setStatus("verifying");
        setVerifying(true);
        const verified = verifyZKProof(proof, new Set([])); // Empty set for initial verification

        // Step 5: Mark nullifier as spent (local state, will be confirmed on-chain)
        if (verified) {
          consumeNullifier(nullifier);
        }

        // Update proof stores
       setProgress(90);
        setProof({ ...proof, verified });
        setCurrentProof(proof);
        addProofToHistory(proof);

        setProgress(100);
        setStatus(verified ? "complete" : "error");
        setErrorMessage(null);

        return proof;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage(message);
        setStatus("error");
        throw error;
      } finally {
        setProofGenerating(false);
        setVerifying(false);
      }
    },
    [
      commitment,
      startProofGeneration,
      setProgress,
      setStatus,
      setProofGenerating,
      setVerifying,
      setErrorMessage,
      setCurrentProof,
      addProofToHistory,
      insertLeaf,
      getRoot,
      generateNewNullifier,
      checkNullifierSpent,
      consumeNullifier,
    ]
  );

  /**
   * Verify an existing proof (local verification before on-chain).
   */
  const verifyProof = useCallback(
    (proof: ZKProof): boolean => {
      try {
        return verifyZKProof(proof, new Set([]));
      } catch (error) {
        console.error("Proof verification error:", error);
        return false;
      }
    },
    []
  );

  /**
   * Get current Merkle root (for UI display).
   */
  const getMerkleRoot = useCallback(() => {
    return proverRef.current?.getMerkleRoot() ?? 0n;
  }, []);

  /**
   * Get spent nullifiers (for UI display).
   */
  const getSpentNullifiers = useCallback(() => {
    return proverRef.current?.getSpentNullifiers() ?? [];
  }, []);

  return {
    generateProof,
    verifyProof,
    getMerkleRoot,
    getSpentNullifiers,
  };
}
