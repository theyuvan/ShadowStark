import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { ZKProof, AggregatedProof } from "@/types";
import { ZK_CONSTANTS } from "@/constants/zkConstants";

interface ZKStore {
  // Merkle Tree State
  merkleRoot: bigint;
  merkleDepth: number;
  merkleLeafCount: number;

  // Proof State
  currentProof: ZKProof | null;
  proofHistory: ZKProof[];
  proofVerified: boolean;

  // Nullifier State
  spentNullifiers: bigint[]; // PUBLIC: Tracked from on-chain
  pendingNullifier: bigint | null; // Current session nullifier

  // Aggregation State
  aggregatedProofs: AggregatedProof[];
  pendingProofCount: number;

  // Session State
  isProofGenerating: boolean;
  isVerifying: boolean;
  lastProofTime: number;
  errorMessage: string | null;

  // Actions
  setMerkleRoot: (root: bigint) => void;
  setMerkleState: (root: bigint, depth: number, leafCount: number) => void;
  setCurrentProof: (proof: ZKProof) => void;
  addProofToHistory: (proof: ZKProof) => void;
  setProofVerified: (verified: boolean) => void;
  addSpentNullifier: (nullifier: bigint) => void;
  setSpentNullifiers: (nullifiers: bigint[]) => void;
  setPendingNullifier: (nullifier: bigint | null) => void;
  addAggregatedProof: (proof: AggregatedProof) => void;
  setPendingProofCount: (count: number) => void;
  setProofGenerating: (generating: boolean) => void;
  setVerifying: (verifying: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  resetSession: () => void;
  clearProofHistory: () => void;
}

const initialState = {
  merkleRoot: ZK_CONSTANTS.MERKLE_ZERO_VALUE,
  merkleDepth: ZK_CONSTANTS.MERKLE_TREE_DEPTH,
  merkleLeafCount: 0,
  currentProof: null,
  proofHistory: [],
  proofVerified: false,
  spentNullifiers: [],
  pendingNullifier: null,
  aggregatedProofs: [],
  pendingProofCount: 0,
  isProofGenerating: false,
  isVerifying: false,
  lastProofTime: 0,
  errorMessage: null,
};

export const useZKStore = create<ZKStore>()(
  immer((set) => ({
    ...initialState,

    setMerkleRoot: (root: bigint) =>
      set((state) => {
        state.merkleRoot = root;
      }),

    setMerkleState: (root: bigint, depth: number, leafCount: number) =>
      set((state) => {
        state.merkleRoot = root;
        state.merkleDepth = depth;
        state.merkleLeafCount = leafCount;
      }),

    setCurrentProof: (proof: ZKProof) =>
      set((state) => {
        state.currentProof = proof;
        state.lastProofTime = Date.now();
      }),

    addProofToHistory: (proof: ZKProof) =>
      set((state) => {
        state.proofHistory.push(proof);
        // Keep only last 50 proofs to prevent memory bloat
        if (state.proofHistory.length > 50) {
          state.proofHistory = state.proofHistory.slice(-50);
        }
      }),

    setProofVerified: (verified: boolean) =>
      set((state) => {
        state.proofVerified = verified;
      }),

    addSpentNullifier: (nullifier: bigint) =>
      set((state) => {
        if (!state.spentNullifiers.includes(nullifier)) {
          state.spentNullifiers.push(nullifier);
        }
      }),

    setSpentNullifiers: (nullifiers: bigint[]) =>
      set((state) => {
        state.spentNullifiers = nullifiers;
      }),

    setPendingNullifier: (nullifier: bigint | null) =>
      set((state) => {
        state.pendingNullifier = nullifier;
      }),

    addAggregatedProof: (proof: AggregatedProof) =>
      set((state) => {
        state.aggregatedProofs.push(proof);
      }),

    setPendingProofCount: (count: number) =>
      set((state) => {
        state.pendingProofCount = count;
      }),

    setProofGenerating: (generating: boolean) =>
      set((state) => {
        state.isProofGenerating = generating;
      }),

    setVerifying: (verifying: boolean) =>
      set((state) => {
        state.isVerifying = verifying;
      }),

    setErrorMessage: (message: string | null) =>
      set((state) => {
        state.errorMessage = message;
      }),

    resetSession: () =>
      set((state) => {
        state.currentProof = null;
        state.proofVerified = false;
        state.pendingNullifier = null;
        state.pendingProofCount = 0;
        state.isProofGenerating = false;
        state.isVerifying = false;
        state.errorMessage = null;
        state.lastProofTime = 0;
      }),

    clearProofHistory: () =>
      set((state) => {
        state.proofHistory = [];
        state.aggregatedProofs = [];
      }),
  }))
);
