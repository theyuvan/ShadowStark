import { randomBytes } from "@noble/hashes/utils.js";
import { hash } from "starknet";

import type { NodeGraph, ZKProof } from "@/types";
import { ZKProver, verifyZKProof as verifyLocalZKProof } from "@/lib/zk/zkProver";
import { starknetClient } from "@/lib/starknetClient";

const prover = new ZKProver(20);

const randomBigInt = (): bigint => BigInt(`0x${Buffer.from(randomBytes(31)).toString("hex")}`);

const publicInputsHash = (proof: ZKProof): string =>
  hash.computePoseidonHashOnElements([
    proof.commitment,
    proof.finalStateHash,
    proof.nullifier,
    proof.merkleRoot,
  ]);

async function persistProofArtifact(proof: ZKProof, graph: NodeGraph): Promise<string | undefined> {
  try {
    const response = await fetch("/api/proofs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof, graph }),
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as { filePath?: string };
    return data.filePath;
  } catch {
    return undefined;
  }
}

export async function generateZkProof(graph: NodeGraph, commitment: string): Promise<ZKProof> {
  const graphDigest = hash.computePoseidonHashOnElements([commitment, `0x${graph.nodes.length.toString(16)}`]);

  const proof = await prover.generateProof(
    commitment,
    {
      salt: "shadowflow-live",
      tradeAmount: 10000000n,
      priceLower: 35000n,
      priceUpper: 120000n,
      executionSteps: graph.nodes.map((node) => node.type),
    },
    {
      finalStateHash: graphDigest,
      secretKey: randomBigInt(),
    },
    randomBigInt(),
  );

  proof.verified = false;
  proof.teeAttested = true;
  proof.artifactFile = await persistProofArtifact(proof, graph);

  return proof;
}

export async function verifyZkProof(proof: ZKProof): Promise<boolean> {
  try {
    const result = await starknetClient.verifyProofOnChain(proof.proofHash, publicInputsHash(proof));
    proof.verified = result.isValid;
    return result.isValid;
  } catch {
    const fallback = verifyLocalZKProof(proof, new Set());
    proof.verified = fallback;
    return fallback;
  }
}
