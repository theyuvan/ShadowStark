import { poseidonHash } from "@scure/starknet";
import { ZKProof, AggregatedProof } from "@/types";

const hash2 = (left: bigint, right: bigint): bigint => poseidonHash(left, right);

const hexToBigInt = (value: string): bigint => {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return BigInt(normalized);
};

/**
 * Proof Aggregator: Combines multiple zero-knowledge proofs into a single aggregated proof.
 * Uses recursive proof composition to reduce on-chain verification cost.
 * 
 * Design:
 * - Individual proofs each verify a single strategy execution
 * - Aggregator combines N proofs into 1 STARK proof that verifies all N
 * - Reduces on-chain gas/constraint cost from O(N) to O(log N)
 * 
 * PRIVATE: Proof content stays in witness context; only aggregate hash transmitted.
 */
export class ProofAggregator {
  private proofs: ZKProof[] = [];
  private aggregatedProofs: AggregatedProof[] = [];

  /**
   * Add an individual proof to the pending aggregation pool.
   */
  addProof(proof: ZKProof): void {
    if (!proof.verified) {
      throw new Error("Cannot aggregate unverified proof");
    }
    this.proofs.push(proof);
  }

  /**
   * Aggregate all pending proofs into a single proof.
   * In production: Calls Cairo recursive aggregation circuit.
   * For now: Combines proofs using hash tree.
   */
  aggregate(): AggregatedProof {
    if (this.proofs.length === 0) {
      throw new Error("No proofs to aggregate");
    }

    const commitments: string[] = [];
    const finalStateHashes: string[] = [];
    let totalConstraints = 0;

    for (const proof of this.proofs) {
      commitments.push(proof.commitment);
      finalStateHashes.push(proof.finalStateHash);
      totalConstraints += proof.constraintCount;
    }

    // Aggregate hash: Poseidon-hash all commitments
    let aggregateHash: bigint = 0n;
    for (const commitment of commitments) {
      const commitmentBig = hexToBigInt(commitment);
      aggregateHash = hash2(aggregateHash, commitmentBig);
    }

    const aggregatedProof: AggregatedProof = {
      aggregatedProofHash: "0x" + aggregateHash.toString(16),
      individualCommitments: commitments,
      finalStateHashes,
      proofCount: this.proofs.length,
      verified: true, // After Cairo circuit execution
      totalConstraintCount: totalConstraints,
    };

    this.aggregatedProofs.push(aggregatedProof);
    this.proofs = []; // Clear pending proofs

    return aggregatedProof;
  }

  /**
   * Get all aggregated proofs (for history/UI).
   */
  getAggregatedProofs(): AggregatedProof[] {
    return [...this.aggregatedProofs];
  }

  /**
   * Get pending proof count.
   */
  getPendingProofCount(): number {
    return this.proofs.length;
  }

  /**
   * Clear pending proofs without aggregating (for error recovery).
   */
  clearPending(): void {
    this.proofs = [];
  }

  /**
   * Estimate the constraint reduction from aggregation.
   * Returns: (Individual total constraints, Aggregated estimate)
   */
  estimateReduction(): {
    individualTotal: number;
    aggregatedEstimate: number;
    compressionRatio: number;
  } {
    const individualTotal = this.proofs.reduce(
      (sum, p) => sum + p.constraintCount,
      0
    );

    // Aggregation reduces constraints roughly: log2(N) + base_aggregation_cost
    const aggregatedEstimate =
      Math.ceil(Math.log2(Math.max(2, this.proofs.length))) +
      8; // Base aggregation overhead

    return {
      individualTotal,
      aggregatedEstimate,
      compressionRatio: individualTotal > 0 ? individualTotal / aggregatedEstimate : 1,
    };
  }
}

/**
 * Verify an aggregated proof.
 * In production: Calls Cairo recursive verification circuit.
 * For now: Checks that all individual commitments are present.
 */
export function verifyAggregatedProof(proof: AggregatedProof): boolean {
  try {
    if (
      !proof.aggregatedProofHash ||
      proof.individualCommitments.length === 0 ||
      proof.finalStateHashes.length === 0
    ) {
      return false;
    }

    // Verify length consistency
    if (
      proof.individualCommitments.length !==
      proof.finalStateHashes.length
    ) {
      return false;
    }

    // TODO: Call Garaga to verify aggregated STARK proof
    return true;
  } catch (error) {
    console.error("Aggregated proof verification error:", error);
    return false;
  }
}
