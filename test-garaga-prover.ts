/**
 * Test script for Garaga ZK Prover
 * Verifies that real cryptographic proofs are being generated
 */

import { GaragaProver, type PythPriceData } from "@/lib/server/garagaProver";

console.log("🧪 Testing Garaga ZK Proof Generation...\n");

// Mock Pyth price data
const pythPriceData: PythPriceData = {
  price: BigInt(Math.floor(62000 * 1e18)),
  confidence: BigInt(Math.floor(62000 * 1e18 * 0.01)),
  expo: -18,
  publishTime: Math.floor(Date.now() / 1000),
};

// Generate a proof
const proof = GaragaProver.generatePriceAndAmountProof(
  "test-intent-001",
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "1.5",
  "btc",
  "92500",
  "strk",
  61666.66, // Stated rate (1.5 BTC = 92500 STRK)
  pythPriceData,
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
);

console.log("✅ Proof Generated:");
console.log(JSON.stringify(
  {
    proofHash: proof.proofHash.slice(0, 20) + "...",
    commitment: proof.commitment.slice(0, 20) + "...",
    nullifier: proof.nullifier.slice(0, 20) + "...",
    merkleRoot: proof.merkleRoot.slice(0, 20) + "...",
    
    circuitExecuted: proof.circuitExecuted,
    amountConstraintsChecked: proof.amountConstraintsChecked,
    priceConstraintChecked: proof.priceConstraintChecked,
    priceVerified: proof.priceVerified,
    
    constraintCount: proof.constraintCount,
    publicInputs: {
      amountsVerified: proof.publicInputs.amountsVerified,
    },
  },
  null,
  2
));

// Verify the proof locally
const isValid = GaragaProver.verifyProofLocally(proof);
console.log(`\n✅ Local verification: ${isValid ? "PASSED ✓" : "FAILED ✗"}`);

console.log("\n🎯 Summary:");
console.log(`  Circuit Executed: ${proof.circuitExecuted ? "YES ✓" : "NO ✗"}`);
console.log(`  Constraints Checked: ${proof.constraintCount}`);
console.log(`  Price Verified: ${proof.priceVerified ? "YES ✓" : "NO ✗"}`);
console.log(`  Amounts Verified: ${proof.publicInputs.amountsVerified ? "YES ✓" : "NO ✗"}`);
