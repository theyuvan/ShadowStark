import { poseidonHash } from "@scure/starknet";

const hash2 = (left: bigint, right: bigint): bigint => poseidonHash(left, right);

/**
 * Nullifier System: Replay attack protection for zero-knowledge strategies.
 * 
 * Design:
 * - secretKey: NEVER stored anywhere (user ephemeral-only)
 * - nullifier = Poseidon(strategy_hash, execution_index, secretKey)
 * - Each strategy execution produces a unique nullifier
 * - Smart contract stores used nullifiers to prevent replays
 * 
 * PRIVATE: secretKey and nullifier derivation (SHA256 or similar) kept local
 */

/**
 * Generate a nullifier from a strategy, execution index, and secret key.
 * The secret key should NEVER be transmitted or stored permanently.
 * PRIVATE: All parameters except the returned nullifier must not be logged.
 */
export function generateNullifier(
  strategyHash: bigint,
  executionIndex: bigint,
  secretKey: bigint // PRIVATE: Ephemeral only
): bigint {
  // Nullifier = Poseidon(strategy_hash, execution_index, secretKey)
  // This ensures each execution of the same strategy produces a different nullifier
  const nullifier = hash2(hash2(strategyHash, executionIndex), secretKey);
  return nullifier;
}

/**
 * Verify that a nullifier has not been spent (used) before.
 * On-chain: Smart contract maintains a set of spent nullifiers.
 * Off-chain: We maintain a local Set for simulation.
 */
export function verifyNullifierNotSpent(
  nullifier: bigint,
  spentNullifiers: Set<bigint>
): boolean {
  return !spentNullifiers.has(nullifier);
}

/**
 * Mark a nullifier as spent.
 * Called after successful proof verification on-chain.
 */
export function consumeNullifier(
  nullifier: bigint,
  spentNullifiers: Set<bigint>
): void {
  spentNullifiers.add(nullifier);
}

/**
 * Validate nullifier format (must be a valid bigint hash).
 */
export function isValidNullifier(nullifier: bigint): boolean {
  return nullifier >= 0n;
}

/**
 * Nullifier Manager: Keeps track of spent nullifiers in the current session.
 * This is a LOCAL memory structure; the canonical record is on-chain.
 */
export class NullifierManager {
  private spentNullifiers: Set<bigint> = new Set();

  /**
   * Check if a nullifier has been spent.
   */
  isSpent(nullifier: bigint): boolean {
    return this.spentNullifiers.has(nullifier);
  }

  /**
   * Mark a nullifier as spent.
   */
  spend(nullifier: bigint): void {
    this.spentNullifiers.add(nullifier);
  }

  /**
   * Get all spent nullifiers (for UI sync with on-chain contract).
   */
  getAllSpent(): bigint[] {
    return Array.from(this.spentNullifiers);
  }

  /**
   * Clear all spent nullifiers (for test resets).
   */
  clear(): void {
    this.spentNullifiers.clear();
  }

  /**
   * Import spent nullifiers from on-chain contract state.
   * Called during initialization to sync with smart contract.
   */
  importFromChain(chainNullifiers: bigint[]): void {
    chainNullifiers.forEach((n) => this.spentNullifiers.add(n));
  }
}
