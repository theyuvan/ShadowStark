import { randomBytes } from "@noble/hashes/utils.js";
import { hash } from "starknet";
import { poseidonHash } from "@scure/starknet";

import type { NodeGraph, ZKProof } from "@/types";
import { ZKProver, verifyZKProof as verifyLocalZKProof } from "@/lib/zk/zkProver";
import { getProofPublicInputsHash } from "@/lib/zk/publicInputs";
import { starknetClient } from "@/lib/starknetClient";

const prover = new ZKProver(20);
const ALLOW_LOCAL_ZK_FALLBACK = process.env.NEXT_PUBLIC_ALLOW_LOCAL_ZK_FALLBACK === "true";

const randomBigInt = (): bigint => BigInt(`0x${Buffer.from(randomBytes(31)).toString("hex")}`);

const toBigIntHex = (value: string): bigint => BigInt(value.startsWith("0x") ? value : `0x${value}`);

const deriveStrategyInputs = (graph: NodeGraph) => {
  const executeNode = graph.nodes.find((node) => node.type === "execute");
  const conditionNodes = graph.nodes.filter((node) => node.type === "condition");
  const constraintNodes = graph.nodes.filter((node) => node.type === "constraint");

  const tradeAmountBtc =
    executeNode && "amount" in executeNode.data && typeof executeNode.data.amount === "number"
      ? executeNode.data.amount
      : 0.01;
  const tradeAmount = BigInt(Math.max(1, Math.round(tradeAmountBtc * 100_000_000)));

  let priceLower = 0;
  let priceUpper = 1_000_000;

  conditionNodes.forEach((node) => {
    if (!("price" in node.data) || typeof node.data.price !== "number") {
      return;
    }

    const value = node.data.price;
    if (node.data.operator === "<") {
      priceUpper = Math.min(priceUpper, value);
    } else if (node.data.operator === ">") {
      priceLower = Math.max(priceLower, value);
    } else {
      priceLower = Math.max(priceLower, value);
      priceUpper = Math.min(priceUpper, value);
    }
  });

  constraintNodes.forEach((node) => {
    if (!("value" in node.data) || typeof node.data.value !== "number") {
      return;
    }

    const value = node.data.value;
    if (node.data.operator === "<" || node.data.operator === "<=") {
      priceUpper = Math.min(priceUpper, value);
    } else if (node.data.operator === ">" || node.data.operator === ">=") {
      priceLower = Math.max(priceLower, value);
    } else {
      priceLower = Math.max(priceLower, value);
      priceUpper = Math.min(priceUpper, value);
    }
  });

  if (priceUpper <= priceLower) {
    priceUpper = priceLower + 1;
  }

  return {
    tradeAmount,
    priceLower: BigInt(Math.max(0, Math.round(priceLower))),
    priceUpper: BigInt(Math.max(1, Math.round(priceUpper))),
    executionSteps: graph.nodes.map((node) => `${node.type}:${node.id}`),
  };
};

const verifyMerklePathConsistency = (proof: ZKProof): boolean => {
  if (!proof.merklePath) {
    return false;
  }

  let current = toBigIntHex(proof.merklePath.leaf);
  for (let index = 0; index < proof.merklePath.pathElements.length; index += 1) {
    const sibling = toBigIntHex(proof.merklePath.pathElements[index]);
    const isRight = proof.merklePath.pathIndices[index] === 1;
    current = isRight ? poseidonHash(sibling, current) : poseidonHash(current, sibling);
  }

  const computed = `0x${current.toString(16)}`.toLowerCase();
  const rootFromPath = proof.merklePath.root.toLowerCase();
  const rootFromProof = proof.merkleRoot.toLowerCase();

  return computed === rootFromPath && computed === rootFromProof;
};

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
  const strategyInputs = deriveStrategyInputs(graph);

  const proof = await prover.generateProof(
    commitment,
    {
      salt: "shadowflow-live",
      tradeAmount: strategyInputs.tradeAmount,
      priceLower: strategyInputs.priceLower,
      priceUpper: strategyInputs.priceUpper,
      executionSteps: strategyInputs.executionSteps,
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
    const result = await starknetClient.verifyProofOnChain(proof.proofHash, getProofPublicInputsHash(proof));
    proof.verified = result.isValid;
    return result.isValid;
  } catch {
    if (!ALLOW_LOCAL_ZK_FALLBACK) {
      proof.verified = false;
      return false;
    }

    const localStructural = verifyLocalZKProof(proof, new Set());
    const pathConsistent = verifyMerklePathConsistency(proof);
    const fallback = localStructural && pathConsistent;
    proof.verified = fallback;
    return fallback;
  }
}
