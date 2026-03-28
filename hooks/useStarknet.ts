"use client";

import { useCallback } from "react";
import { starknetClient } from "@/lib/starknetClient";
import { ZKProof } from "@/types";
import { getProofPublicInputsHash } from "@/lib/zk/publicInputs";

/**
 * useStarknet: Hook for on-chain verification and settlement.
 * Handles:
 * - Storing commitments on-chain
 * - Verifying and executing proofs
 * - Checking nullifier spending status
 * - Syncing merkle roots/nullifiers with smart contract
 */
export function useStarknet() {
  const storeCommitment = useCallback(async (commitment: string) => {
    return starknetClient.storeCommitment(commitment);
  }, []);

  /**
   * Verify a zero-knowledge proof on-chain and execute the strategy.
   * Called after local proof generation and verification.
   */
  const verifyAndExecuteProof = useCallback(
    async (proof: ZKProof) => {
      try {
        const publicInputsHash = getProofPublicInputsHash(proof);
        const executionApiKey = process.env.NEXT_PUBLIC_EXECUTION_API_KEY;

        const registerResponse = await fetch("/api/proof/register-valid", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(executionApiKey ? { "x-api-key": executionApiKey } : {}),
          },
          body: JSON.stringify({
            proofHash: proof.proofHash,
            publicInputsHash,
            finalStateHash: proof.finalStateHash,
            nullifier: proof.nullifier,
          }),
        });

        if (!registerResponse.ok) {
          throw new Error("Failed to register valid proof with backend execution gateway.");
        }

        // Call Starknet contract to verify proof and execute strategy
        const result = await starknetClient.verifyAndStore({
          proofHash: proof.proofHash,
          publicInputsHash,
          finalStateHash: proof.finalStateHash,
          nullifier: proof.nullifier,
        });

        // Contract will:
        // 1. Call Garaga verifier to check STARK proof
        // 2. Verify Merkle root is valid
        // 3. Check nullifier not already spent
        // 4. Execute strategy transaction
        // 5. Store nullifier on-chain

        return result;
      } catch (error) {
        console.error("Proof verification failed on-chain:", error);
        throw error;
      }
    },
    []
  );

  /**
   * Check if a nullifier has been spent on-chain.
   */
  const checkNullifierSpent = useCallback(
    async (nullifier: string): Promise<boolean> => {
      return starknetClient.checkNullifierSpent(nullifier);
    },
    []
  );

  /**
   * Sync merkle root and spent nullifiers from on-chain.
   * Called on mount and after proof execution.
   */
  const syncWithChain = useCallback(
    async (): Promise<{
      merkleRoot: string;
      spentNullifiers: string[];
    }> => {
      return starknetClient.syncChainState();
    },
    []
  );

  return {
    storeCommitment,
    verifyAndExecuteProof,
    checkNullifierSpent,
    syncWithChain,
  };
}
