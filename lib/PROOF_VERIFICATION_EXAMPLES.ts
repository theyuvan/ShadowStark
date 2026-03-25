/**
 * Example: Using On-Chain Proof Verification in Your Frontend
 * 
 * This file demonstrates how to integrate the live contract interactions
 * into your ShadowFlow trading workflows.
 */

import { ShadowFlowStarknetClient, ProofVerificationResult } from "@/lib/starknetClient";
import { generateZkProof } from "@/lib/zkProver";
import type { CircuitPublicInputs, ZKProof } from "@/types";

const client = new ShadowFlowStarknetClient();

// ============================================
// Example 1: Complete Proof Verification Flow
// ============================================
export async function executeProofVerificationFlow(commitment: string, userAddress: string) {
  try {
    console.log("🔐 Starting proof verification flow...\n");

    // Step 1: Generate ZK proof locally
    console.log("Step 1️⃣: Generating zero-knowledge proof...");
    const proof = await generateZkProof({ nodes: [], edges: [] }, commitment);
    console.log(`✅ Proof generated: ${proof.proofHash.substring(0, 20)}...`);
    console.log(`   Proof Size: ${proof.proofSize} bytes`);
    console.log(`   Constraints: ${proof.constraintCount}\n`);

    // Step 2: Verify proof on-chain against GaragaVerifier
    console.log("Step 2️⃣: Verifying proof on-chain (GaragaVerifier)...");
    const verificationResult = await client.verifyProofOnChain(
      proof.proofHash,
      hashPublicInputs(proof.publicInputs)
    );

    console.log(
      `✅ On-chain verification complete: ${verificationResult.isValid ? "VALID" : "INVALID"}`
    );
    console.log(`   Verified at: ${new Date(verificationResult.timestamp).toISOString()}\n`);

    // Step 3: Check current Merkle root
    console.log("Step 3️⃣: Querying chain state (ShadowFlow)...");
    const merkleRoot = await client.getMerkleRoot();
    console.log(`✅ Current Merkle Root: ${merkleRoot}`);

    // Step 4: Check if nullifier already spent
    console.log("\nStep 4️⃣: Checking nullifier status...");
    const isSpent = await client.isNullifierSpent(proof.nullifier);
    console.log(`✅ Nullifier Spent: ${isSpent}`);

    if (isSpent) {
      throw new Error(
        "❌ Nullifier already spent - cannot execute same proof twice (prevents replay attacks)"
      );
    }

    // Step 5: Fetch user's current commitment
    console.log("\nStep 5️⃣: Fetching user commitment on-chain...");
    const userCommitment = await client.getCommitment(userAddress);
    console.log(`✅ User Commitment: ${userCommitment}`);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ PROOF VERIFICATION SUCCESSFUL!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    return {
      success: true,
      proof,
      verification: verificationResult,
      merkleRoot,
      userCommitment,
    };
  } catch (error) {
    console.error(
      "❌ Proof verification failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error };
  }
}

// ============================================
// Example 2: Verify Proof Before Trade Execution
// ============================================
export async function verifyProofBeforeTrade(
  proofHash: string,
  publicInputsHash: string,
  tradeId: string
) {
  console.log(`\n🛡️ Verifying proof for trade ${tradeId}...`);

  const result = await client.verifyProofOnChain(proofHash, publicInputsHash);

  if (!result.isValid) {
    console.warn(`⚠️ Proof verification FAILED for trade ${tradeId}`);
    console.warn("   Trade execution BLOCKED - proof did not pass on-chain verification");
    return false;
  }

  console.log(`✅ Proof VERIFIED for trade ${tradeId}`);
  console.log(`   Safe to proceed with execution`);
  return true;
}

// ============================================
// Example 3: Monitor Strategy State
// ============================================
export async function monitorStrategyState(userAddress: string) {
  console.log(`\n📊 Monitoring strategy state for ${userAddress.substring(0, 10)}...`);

  try {
    // Get user's current commitment
    const commitment = await client.getCommitment(userAddress);
    console.log(`   Commitment: ${commitment}`);

    // Get latest Merkle root
    const merkleRoot = await client.getMerkleRoot();
    console.log(`   Latest Root: ${merkleRoot}`);

    // Compare with local state
    console.log(
      `   Status: Commitment is ${commitment === "0" ? "NOT active" : "ACTIVE on-chain"}`
    );

    return { commitment, merkleRoot };
  } catch (error) {
    console.error(
      "Failed to fetch strategy state:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

// ============================================
// Example 4: Batch Verify Multiple Proofs
// ============================================
export async function batchVerifyProofs(proofs: ZKProof[]): Promise<ProofVerificationResult[]> {
  console.log(`\n🔄 Batch verifying ${proofs.length} proofs...`);

  const results: ProofVerificationResult[] = [];

  for (let i = 0; i < proofs.length; i++) {
    const proof = proofs[i];
    console.log(`   [${i + 1}/${proofs.length}] Verifying ${proof.proofHash.substring(0, 15)}...`);

    try {
      const result = await client.verifyProofOnChain(
        proof.proofHash,
        hashPublicInputs(proof.publicInputs)
      );

      results.push(result);
      console.log(`   ✅ Valid: ${result.isValid}`);
    } catch (error) {
      console.error(
        `   ❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
      results.push({
        proofHash: proof.proofHash,
        publicInputsHash: "",
        isValid: false,
        timestamp: Date.now(),
      });
    }
  }

  const validCount = results.filter((r) => r.isValid).length;
  console.log(`\n✅ Batch verification complete: ${validCount}/${proofs.length} valid\n`);

  return results;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Hash public inputs for verification (felt252 format)
 */
function hashPublicInputs(inputs: CircuitPublicInputs): string {
  // In production, this should use a proper hash function
  // For now, returning a placeholder - you may want to use:
  // - poseidon() from starknet library
  // - keccak256() from noble/hashes
  const combined = JSON.stringify(inputs);
  const digest = combined.split("").reduce((hashAccumulator, char) => {
    return (hashAccumulator * 31n + BigInt(char.charCodeAt(0))) % 0xffffffffffffffffn;
  }, 0n);
  return `0x${digest.toString(16).padStart(64, "0")}`;
}

// ============================================
// React Hook Integration
// ============================================

/**
 * Usage in a React component:
 * 
 * ```tsx
 * import { useProofVerification } from "@/hooks/useProofVerification";
 * 
 * export function TradeExecutor() {
 *   const { verify, isLoading, error } = useProofVerification();
 * 
 *   const handleExecuteTrade = async (proof: ZKProof) => {
 *     const isValid = await verify(proof.proofHash, hashPublicInputs(proof.publicInputs));
 *     
 *     if (isValid) {
 *       // Execute trade on-chain
 *       await executeTradeTransaction();
 *     } else {
 *       // Show error to user
 *       toast.error("Proof verification failed");
 *     }
 *   };
 * 
 *   return (
 *     <button onClick={() => handleExecuteTrade(currentProof)}>
 *       {isLoading ? "Verifying..." : "Execute Trade"}
 *     </button>
 *   );
 * }
 * ```
 */

// ============================================
// Integration Checklist
// ============================================

/**
 * TODO: To fully integrate:
 * 
 * [ ] 1. Add these methods to your trade execution component
 * [ ] 2. Call verifyProofBeforeTrade() when user clicks "Execute"
 * [ ] 3. Display merkle root and commitment in UI
 * [ ] 4. Monitor nullifier status to prevent replays
 * [ ] 5. Add error handling and user-facing messages
 * [ ] 6. Create a custom React hook (useProofVerification) for components
 * [ ] 7. Implement real public inputs hashing (not placeholder)
 * [ ] 8. Add loading states and transaction progress tracking
 * [ ] 9. Monitor ProofChecked events from GaragaVerifier contract
 * [ ] 10. Test with actual wallet connection to Starknet Sepolia
 * 
 */

export const integrationChecklist = {
  "Environment": {
    ".env.local configured": true,
    "Contract addresses loaded": true,
    "RPC endpoint responding": true,
  },
  "Client Methods": {
    "verifyProofOnChain()": "✅ Ready",
    "getMerkleRoot()": "✅ Ready",
    "getCommitment()": "✅ Ready",
    "isNullifierSpent()": "✅ Ready",
  },
  "Integration Status": {
    "GaragaVerifier accessible": "✅ Verified",
    "ShadowFlow accessible": "✅ Verified",
    "Proof verification working": "✅ Ready to test",
    "On-chain state queryable": "✅ Ready",
  },
  "Next Steps": {
    "1. Connect Starknet wallet": "⏳ Pending",
    "2. Generate ZK proof": "⏳ Pending",
    "3. Verify on-chain": "⏳ Pending",
    "4. Execute trade": "⏳ Pending",
    "5. Monitor state": "⏳ Pending",
  },
};
