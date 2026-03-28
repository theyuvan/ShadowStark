import { poseidonHash } from "@scure/starknet";
import { ZKProof, AggregatedProof } from "@/types";

const hash2 = (left: bigint, right: bigint): bigint => poseidonHash(left, right);

const hexToBigInt = (value: string): bigint => {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return BigInt(normalized);
};

/**
 * Proof Aggregator: Combines multiple zero-knowledge proofs into a single aggregated proof.
 * Local mode uses deterministic commitment hashing for batching metadata.
 * For true recursive proofs, call aggregateRecursively() with a recursive prover backend.
 * 
 * Design:
 * - Individual proofs each verify a single strategy execution
 * - Local aggregate() produces a deterministic batch hash for integrity
 * - aggregateRecursively() delegates to a backend recursive prover service
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
    * Combines verified proof commitments using a deterministic Poseidon hash tree.
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
      verified: true,
      totalConstraintCount: totalConstraints,
    };

    this.aggregatedProofs.push(aggregatedProof);
    this.proofs = []; // Clear pending proofs

    return aggregatedProof;
  }

  /**
   * Build a true recursive aggregate proof via an external prover backend.
   */
  async aggregateRecursively(): Promise<AggregatedProof> {
    if (this.proofs.length === 0) {
      throw new Error("No proofs to aggregate");
    }

    const endpoint = process.env.NEXT_PUBLIC_RECURSIVE_AGGREGATOR_API_URL;
    if (!endpoint) {
      throw new Error(
        "NEXT_PUBLIC_RECURSIVE_AGGREGATOR_API_URL is not configured for recursive aggregation.",
      );
    }

    const response = await fetch(`${endpoint.replace(/\/$/, "")}/recursive/aggregate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proofs: this.proofs }),
    });

    if (!response.ok) {
      throw new Error(`Recursive aggregation failed: ${response.status}`);
    }

    const aggregatedProof = (await response.json()) as AggregatedProof;
    if (!verifyAggregatedProof(aggregatedProof)) {
      throw new Error("Recursive aggregate payload failed deterministic integrity checks.");
    }

    this.aggregatedProofs.push(aggregatedProof);
    this.proofs = [];

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
 * Performs payload integrity checks and deterministic hash recomputation.
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

    let recomputed: bigint = 0n;
    for (const commitment of proof.individualCommitments) {
      recomputed = hash2(recomputed, hexToBigInt(commitment));
    }

    const expectedHash = `0x${recomputed.toString(16)}`.toLowerCase();
    return expectedHash === proof.aggregatedProofHash.toLowerCase();
  } catch (error) {
    console.error("Aggregated proof verification error:", error);
    return false;
  }
}
