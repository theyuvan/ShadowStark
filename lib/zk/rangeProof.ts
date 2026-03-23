import { RangeProofWitness } from "@/types";
import { poseidonHash } from "@scure/starknet";

const hash2 = (left: bigint, right: bigint): bigint => poseidonHash(left, right);

/**
 * Range Proof Witness Generator
 * Converts a value and range into a witness suitable for ZK range check circuit.
 * Implements bit-decomposition range proof compatible with Cairo/STARK.
 */
export function generateRangeProof(
  value: bigint,
  lowerBound: bigint,
  upperBound: bigint,
  blindingFactor: bigint
): RangeProofWitness {
  // Verify value is in range
  if (value < lowerBound || value > upperBound) {
    throw new Error(
      `Value ${value} not in range [${lowerBound}, ${upperBound}]`
    );
  }

  // Bit decompose the value for range proof
  // Range checks work by decomposing value into bits and proving each bit is 0 or 1
  const bitLength = 64; // Support up to 2^64 - 1
  const bits: bigint[] = [];

  let remaining = value;
  for (let i = 0; i < bitLength; i++) {
    bits.push(remaining & 1n);
    remaining = remaining >> 1n;
  }

  // Compute public commitment: Poseidon(value, blindingFactor)
  const publicCommitment = hash2(value, blindingFactor);

  return {
    bits, // PRIVATE: Bit decomposition proves sum of bits equals value
    blindingFactor, // PRIVATE: Keeps value hidden
    publicCommitment, // PUBLIC: Commitment visible on-chain
    lowerBound, // PRIVATE: Witness-only (not verified on-chain, but checked off-chain)
    upperBound, // PRIVATE: Witness-only
  };
}

/**
 * Verify a range proof locally (off-chain).
 * On-chain: STARK circuit will verify bit decomposition sums to value.
 */
export function verifyRangeProof(proof: RangeProofWitness): boolean {
  // Verify bit decomposition sums correctly
  let sum = 0n;
  for (let i = 0; i < proof.bits.length; i++) {
    if (proof.bits[i] !== 0n && proof.bits[i] !== 1n) {
      return false; // Invalid bit
    }
    sum += proof.bits[i] * (1n << BigInt(i));
  }

  // Verify commitment matches
  const commitmentCheck = hash2(sum, proof.blindingFactor);
  return commitmentCheck === proof.publicCommitment;
}

/**
 * Extract the value from a range proof (requires knowledge of blindingFactor).
 * Reconstructs value from bit decomposition.
 */
export function reconstructValueFromBits(bits: bigint[]): bigint {
  let value = 0n;
  for (let i = 0; i < bits.length; i++) {
    value += bits[i] * (1n << BigInt(i));
  }
  return value;
}
