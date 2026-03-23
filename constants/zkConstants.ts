/**
 * ZK Constants: Configuration and parameters for the zero-knowledge system.
 * These values should NOT be changed at runtime; they are protocol constants.
 */

export const ZK_CONSTANTS = {
  // Merkle Tree Parameters
  MERKLE_TREE_DEPTH: 20, // Supports 2^20 = 1M strategies
  MERKLE_ZERO_VALUE: 0n, // Default zero hash for empty subtrees

  // Field Arithmetic (Starknet Poseidon field)
  FIELD_MODULUS: BigInt(
    "3618502788666131213697322783095070189881391808538383355816639022368894575994593"
  ), // Starknet field prime

  // Range Proof Parameters
  RANGE_PROOF_BIT_LENGTH: 64, // Support values up to 2^64 - 1
  RANGE_PROOF_BLINDING_BITS: 256, // Blinding factor size

  // Nullifier System Parameters
  NULLIFIER_FIELD_SIZE: 256, // Nullifier hash bit length
  NULLIFIER_MAX_USES: 1, // Each nullifier can only be used once (replay protection)

  // Proof Size Estimates (in bytes)
  STARK_PROOF_SIZE: 2048, // Typical STARK proof (can vary)
  MERKLE_PROOF_SIZE_PER_LEVEL: 32, // 32 bytes per hash element
  RANGE_PROOF_SIZE: 512, // Bit decomposition witness
  NULLIFIER_SIZE: 32, // One hash

  // Constraint Counts (for gas/complexity estimation)
  BASE_STRATEGY_CONSTRAINTS: 5,
  CONSTRAINT_TYPE_COSTS: {
    range_check: 2, // Bit decomposition
    sum_partition: 4, // Multiple range checks summed
    state_transition: 3, // State machine transition
    assertion: 1, // Simple assertion
  },

  // Cairo Circuit Parameters
  CAIRO_FIELD_BITS: 252, // Starknet field element bits
  CAIRO_MAX_FELTS_PER_PROOF: 128,

  // Proof Aggregation Parameters
  MAX_INDIVIDUAL_PROOFS_PER_BATCH: 32, // Max proofs in one aggregation
  AGGREGATION_OVERHEAD_CONSTRAINTS: 8, // Base cost of aggregation circuit

  // Timestamps and Epochs
  MIN_PROOF_VALIDITY_SECONDS: 3600, // Proof valid for 1 hour
  MAX_CLOCK_SKEW_SECONDS: 60, // Allow 60s clock skew

  // Debug Flags (disable in production)
  DEBUG_LOG_PRIVATE_WITNESSES: false, // NEVER ENABLE IN PRODUCTION
  DEBUG_ALLOW_UNVERIFIED_PROOFS: false, // NEVER ENABLE IN PRODUCTION

  // UI/UX Parameters
  DEFAULT_TREE_RENDER_DEPTH: 4, // How many levels to show in tree visualizer
  RANGE_PROOF_CHART_RESOLUTION: 100, // Number of points for range chart
};

/**
 * Validate that ZK constants are correctly set.
 * Throws if any critical parameters are invalid.
 */
export function validateZKConstants(): void {
  if (ZK_CONSTANTS.MERKLE_TREE_DEPTH < 1 || ZK_CONSTANTS.MERKLE_TREE_DEPTH > 32) {
    throw new Error("MERKLE_TREE_DEPTH must be between 1 and 32");
  }

  if (ZK_CONSTANTS.RANGE_PROOF_BIT_LENGTH < 8 || ZK_CONSTANTS.RANGE_PROOF_BIT_LENGTH > 256) {
    throw new Error("RANGE_PROOF_BIT_LENGTH must be between 8 and 256");
  }

  if (ZK_CONSTANTS.NULLIFIER_MAX_USES < 1) {
    throw new Error("NULLIFIER_MAX_USES must be at least 1");
  }

  // Log validation result (only if debug enabled)
  if (ZK_CONSTANTS.DEBUG_LOG_PRIVATE_WITNESSES) {
    console.warn("⚠️  DEBUG_LOG_PRIVATE_WITNESSES is ENABLED. Never use in production!");
  }

  if (ZK_CONSTANTS.DEBUG_ALLOW_UNVERIFIED_PROOFS) {
    console.warn("⚠️  DEBUG_ALLOW_UNVERIFIED_PROOFS is ENABLED. Never use in production!");
  }
}

/**
 * Estimate constraint count for a given set of constraint types.
 */
export function estimateConstraintCount(
  constraintTypes: Array<"range_check" | "sum_partition" | "state_transition" | "assertion">
): number {
  let count = ZK_CONSTANTS.BASE_STRATEGY_CONSTRAINTS;
  for (const type of constraintTypes) {
    count += ZK_CONSTANTS.CONSTRAINT_TYPE_COSTS[type];
  }
  return count;
}

/**
 * Estimate proof size for serialization.
 */
export function estimateProofSize(
  merkleTreeDepth: number,
  constraintCount: number
): number {
  const merkleSize =
    merkleTreeDepth * ZK_CONSTANTS.MERKLE_PROOF_SIZE_PER_LEVEL;
  const base = ZK_CONSTANTS.STARK_PROOF_SIZE;
  return base + merkleSize + constraintCount * 8; // Rough estimate
}
