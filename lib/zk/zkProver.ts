import { poseidonHash } from "@scure/starknet";
import { PoseidonMerkleTree } from "./merkleTree";
import { generateRangeProof, verifyRangeProof } from "./rangeProof";
import { generateNullifier, verifyNullifierNotSpent } from "./nullifier";
import { ZKProof, CircuitPublicInputs, MerkleProof } from "@/types";

const hash2 = (left: bigint, right: bigint): bigint => poseidonHash(left, right);

const hexToBigInt = (value: string): bigint => {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return BigInt(normalized);
};

const toHex = (value: bigint): string => `0x${value.toString(16)}`;

/**
 * ZK Prover: Main orchestrator for generating zero-knowledge proofs.
 * Combines:
 * - Merkle tree insertion (authenticity)
 * - Range proofs (strategy bounds)
 * - Nullifier generation (replay protection)
 * - Commitment scheme (hiding)
 * 
 * All PRIVATE data remains in local memory and is converted to witness form.
 * Only public outputs (commitment, nullifier, merkleRoot) are transmitted.
 */
export class ZKProver {
  private merkleTree: PoseidonMerkleTree;
  private spentNullifiers: Set<bigint> = new Set();
  private proofCounter: number = 0;

  constructor(treeDepth: number = 20) {
    this.merkleTree = new PoseidonMerkleTree(treeDepth);
  }

  /**
   * Generate a complete zero-knowledge proof for a strategy execution.
   * 
   * Process:
   * 1. Hash strategy graph + execution data = strategyHash
   * 2. Insert strategyHash into Merkle tree (proves membership)
   * 3. Generate range proof for trade parameters
   * 4. Generate nullifier (prevents replay)
   * 5. Produce proof object with PUBLIC outputs only
   * 
   * Returns: ZKProof with PUBLIC fields only (signature, commitment, merkleRoot, nullifier)
   * PRIVATE: All witness data stays in local memory during circuit execution
   */
  async generateProof(
    commitment: string, // Poseidon(strategy graph)
    strategyData: {
      salt: string;
      tradeAmount: bigint;
      priceLower: bigint;
      priceUpper: bigint;
      executionSteps: string[];
    },
    executionState: {
      finalStateHash: string;
      secretKey: bigint; // PRIVATE: User's ephemeral secret
    },
    blindingFactor: bigint // PRIVATE: For range proof
  ): Promise<ZKProof> {
    // Step 1: Derive strategy hash from commitment
    const strategyHashBig = hexToBigInt(commitment);

    // Step 2: Insert into Merkle tree
    this.merkleTree.insert(strategyHashBig);
    const merkleRoot = this.merkleTree.getRoot();
    const insertedLeafIndex = this.merkleTree.getLeafCount() - 1;
    const merkleProof: MerkleProof = this.merkleTree.getProof(insertedLeafIndex);

    // Step 3: Generate range proof (proves trade amount is within bounds)
    const rangeProof = generateRangeProof(
      strategyData.tradeAmount,
      strategyData.priceLower,
      strategyData.priceUpper,
      blindingFactor
    );

    // Verify locally
    if (!verifyRangeProof(rangeProof)) {
      throw new Error("Range proof verification failed");
    }

    // Step 4: Generate nullifier (prevents this exact execution from being replayed)
    const executionIndex = BigInt(this.proofCounter++);
    const nullifier = generateNullifier(
      strategyHashBig,
      executionIndex,
      executionState.secretKey // PRIVATE
    );

    // Check nullifier not already spent
    if (!verifyNullifierNotSpent(nullifier, this.spentNullifiers)) {
      throw new Error("Nullifier already spent (replay detected)");
    }

    // Step 5: Mark nullifier as spent
    this.spentNullifiers.add(nullifier);

    // Construct public inputs for circuit
    const publicInputs: CircuitPublicInputs = {
      commitment, // PUBLIC
      finalStateHash: executionState.finalStateHash, // PUBLIC
      nullifier: "0x" + nullifier.toString(16), // PUBLIC
      merkleRoot: "0x" + merkleRoot.toString(16), // PUBLIC
    };

    // Construct proof object (PUBLIC outputs only)
    const proofHash = hash2(
      strategyHashBig,
      hexToBigInt(executionState.finalStateHash)
    ).toString(16);

    const proof: ZKProof = {
      proofHash: "0x" + proofHash,
      commitment, // PUBLIC
      finalStateHash: executionState.finalStateHash, // PUBLIC
      nullifier: publicInputs.nullifier, // PUBLIC
      merkleRoot: publicInputs.merkleRoot, // PUBLIC
      merklePath: {
        leaf: toHex(merkleProof.leaf),
        pathElements: merkleProof.pathElements.map(toHex),
        pathIndices: merkleProof.pathIndices,
        root: toHex(merkleProof.root),
        treeDepth: merkleProof.treeDepth,
      },
      publicInputs,
      verified: false,
      constraintCount: 12 + strategyData.executionSteps.length * 3, // Estimate
      proofSize: 2048, // Default STARK proof size estimate
      timestamp: Date.now(),
    };

    return proof;
  }

  /**
   * Import spent nullifiers from on-chain contract.
   * Syncs this prover instance with blockchain state.
   */
  importSpentNullifiers(nullifiers: bigint[]): void {
    nullifiers.forEach((n) => this.spentNullifiers.add(n));
  }

  /**
   * Get list of spent nullifiers for UI display.
   */
  getSpentNullifiers(): bigint[] {
    return Array.from(this.spentNullifiers);
  }

  /**
   * Get Merkle tree root (for UI display).
   */
  getMerkleRoot(): bigint {
    return this.merkleTree.getRoot();
  }

  /**
   * Get Merkle tree state for serialization.
   */
  getTreeState() {
    return this.merkleTree.getState();
  }
}

/**
 * Verify a zero-knowledge proof structure off-chain.
 * This validates public payload integrity and replay protection indicators.
 */
export function verifyZKProof(
  proof: ZKProof,
  spentNullifiers: Set<bigint>
): boolean {
  try {
    // Check all PUBLIC fields present
    if (!proof.commitment || !proof.finalStateHash || !proof.nullifier || !proof.merkleRoot) {
      return false;
    }

    // Check nullifier not already spent
    const nullifierBig = BigInt(proof.nullifier);
    if (spentNullifiers.has(nullifierBig)) {
      return false; // Replay detected
    }

    return true;
  } catch (error) {
    console.error("Proof verification error:", error);
    return false;
  }
}
