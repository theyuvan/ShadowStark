"use client";
import { useCallback } from "react";
import { useZKStore } from "@/store/zkStore";
import {
  generateNullifier,
  verifyNullifierNotSpent,
  NullifierManager,
} from "@/lib/zk/nullifier";

/**
 * useNullifier: Hook for managing nullifier generation and verification.
 * Handles ephemeral secret key management (NOT stored).
 */
export function useNullifier() {
  const {
    spentNullifiers,
    pendingNullifier,
    setPendingNullifier,
    addSpentNullifier,
    setSpentNullifiers,
  } = useZKStore();

  const generateNewNullifier = useCallback(
    (strategyHash: bigint, executionIndex: bigint): bigint => {
      // Generate ephemeral secret key (PRIVATE — never stored)
      const secretKey = BigInt(
        "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      );

      const nullifier = generateNullifier(strategyHash, executionIndex, secretKey);
      setPendingNullifier(nullifier);
      return nullifier;
    },
    [setPendingNullifier]
  );

  const checkNullifierSpent = useCallback(
    (nullifier: bigint): boolean => {
      return !verifyNullifierNotSpent(
        nullifier,
        new Set(spentNullifiers)
      );
    },
    [spentNullifiers]
  );

  const consumeNullifier = useCallback(
    (nullifier: bigint): void => {
      addSpentNullifier(nullifier);
    },
    [addSpentNullifier]
  );

  const syncWithChain = useCallback(
    (chainNullifiers: bigint[]): void => {
      setSpentNullifiers(chainNullifiers);
    },
    [setSpentNullifiers]
  );

  return {
    generateNewNullifier,
    checkNullifierSpent,
    consumeNullifier,
    syncWithChain,
    pendingNullifier,
    spentNullifiers,
  };
}
