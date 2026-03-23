import { randomBytes } from "@noble/hashes/utils.js";

import type { NodeGraph, ZKProof, CircuitPublicInputs } from "@/types";

const hex = (size: number) => `0x${Buffer.from(randomBytes(size)).toString("hex")}`;

export async function generateZkProof(graph: NodeGraph, commitment: string): Promise<ZKProof> {
  await new Promise((resolve) => setTimeout(resolve, 900));

  const publicInputs: CircuitPublicInputs = {
    commitment,
    finalStateHash: hex(32),
    nullifier: hex(32),
    merkleRoot: hex(32),
  };

  return {
    proofHash: hex(32),
    commitment,
    finalStateHash: publicInputs.finalStateHash,
    nullifier: publicInputs.nullifier,
    merkleRoot: publicInputs.merkleRoot,
    publicInputs,
    verified: false,
    constraintCount: 12 + graph.nodes.length * 3,
    proofSize: 2048,
    timestamp: Date.now(),
  };
}

export async function verifyZkProof(proof: ZKProof): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return proof.proofHash.length > 10 && proof.verified === false; // Stub: returns false until on-chain
}
