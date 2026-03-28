import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getProofPublicInputsHash } from "@/lib/zk/publicInputs";
import { getProofRecord, readChainState } from "@/lib/server/executionGateway";
import { starknetClient } from "@/lib/starknetClient";
import type { ZKProof } from "@/types";

export const runtime = "nodejs";

interface CheckBody {
  hash?: string;
}

interface ProofFilePayload {
  generatedAt?: string;
  proof?: ZKProof;
}

const proofsDir = path.join(process.cwd(), "proofs");

const normalize = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
};

async function findProofByHash(hashInput: string): Promise<{ fileName: string; proof: ZKProof } | null> {
  const hashValue = normalize(hashInput);

  try {
    const entries = await readdir(proofsDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "valid-proof-registry.json")
      .map((entry) => entry.name);

    for (const fileName of jsonFiles) {
      const raw = await readFile(path.join(proofsDir, fileName), "utf-8");
      const payload = JSON.parse(raw) as ProofFilePayload;
      if (!payload.proof) {
        continue;
      }

      const proofHash = normalize(payload.proof.proofHash);
      const commitment = normalize(payload.proof.commitment);
      if (proofHash === hashValue || commitment === hashValue) {
        return { fileName, proof: payload.proof };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckBody;
    const hashInput = body.hash?.trim();

    if (!hashInput) {
      return NextResponse.json({ error: "Missing hash in request body." }, { status: 400 });
    }

    const artifact = await findProofByHash(hashInput);
    const registry = await getProofRecord(hashInput);

    let chainResult: { verified: boolean; error?: string } | null = null;
    if (artifact?.proof) {
      try {
        const publicInputsHash = getProofPublicInputsHash(artifact.proof);
        const verifyResult = await starknetClient.verifyProofOnChain(artifact.proof.proofHash, publicInputsHash);
        chainResult = { verified: verifyResult.isValid };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown chain verification error";
        chainResult = { verified: false, error: message };
      }
    }

    let chainState: { merkleRoot: string; spentNullifiers: string[] } | null = null;
    try {
      chainState = await readChainState();
    } catch {
      chainState = null;
    }

    return NextResponse.json({
      inputHash: normalize(hashInput),
      foundInArtifacts: Boolean(artifact),
      artifactFile: artifact?.fileName ?? null,
      proofHash: artifact?.proof?.proofHash ?? null,
      commitment: artifact?.proof?.commitment ?? null,
      locallyVerified: artifact?.proof?.verified ?? false,
      registeredAsValid: Boolean(registry),
      registryRecord: registry ?? null,
      chainVerification: chainResult,
      chainState,
      verdict:
        chainResult?.verified || Boolean(registry)
          ? "verified"
          : artifact
            ? "generated_not_verified_onchain"
            : "not_found",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
