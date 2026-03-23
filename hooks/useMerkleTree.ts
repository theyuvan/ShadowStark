"use client";
import { useCallback, useRef, useEffect } from "react";
import { useZKStore } from "@/store/zkStore";
import { PoseidonMerkleTree } from "@/lib/zk/merkleTree";
import { ZK_CONSTANTS } from "@/constants/zkConstants";
import { MerkleProof } from "@/types";

/**
 * useMerkleTree: Hook for managing Merkle tree operations.
 * Maintains tree state and generates/verifies proofs.
 */
export function useMerkleTree() {
  const {
    merkleRoot,
    merkleDepth,
    merkleLeafCount,
    setMerkleState,
  } = useZKStore();

  const treeRef = useRef<PoseidonMerkleTree | null>(null);

  // Initialize tree on mount
  useEffect(() => {
    if (!treeRef.current) {
      treeRef.current = new PoseidonMerkleTree(
        ZK_CONSTANTS.MERKLE_TREE_DEPTH
      );
    }
  }, []);

  const insertLeaf = useCallback(
    (leaf: bigint): void => {
      if (!treeRef.current) {
        throw new Error("Merkle tree not initialized");
      }

      treeRef.current.insert(leaf);

      // Update store
      const newRoot = treeRef.current.getRoot();
      const newLeafCount = treeRef.current.getLeafCount();
      setMerkleState(
        newRoot,
        treeRef.current.getDepth(),
        newLeafCount
      );
    },
    [setMerkleState]
  );

  const getProof = useCallback(
    (leafIndex: number): MerkleProof => {
      if (!treeRef.current) {
        throw new Error("Merkle tree not initialized");
      }

      return treeRef.current.getProof(leafIndex);
    },
    []
  );

  const verifyProof = useCallback(
    (proof: MerkleProof): boolean => {
      if (!treeRef.current) {
        throw new Error("Merkle tree not initialized");
      }

      return treeRef.current.verify(proof);
    },
    []
  );

  const getRoot = useCallback((): bigint => {
    if (!treeRef.current) {
      throw new Error("Merkle tree not initialized");
    }

    return treeRef.current.getRoot();
  }, []);

  const getTreeState = useCallback(() => {
    if (!treeRef.current) {
      throw new Error("Merkle tree not initialized");
    }

    return treeRef.current.getState();
  }, []);

  const getLeafCount = useCallback((): number => {
    if (!treeRef.current) {
      return 0;
    }

    return treeRef.current.getLeafCount();
  }, []);

  return {
    insertLeaf,
    getProof,
    verifyProof,
    getRoot,
    getTreeState,
    getLeafCount,
    merkleRoot,
    merkleDepth,
    merkleLeafCount,
  };
}
