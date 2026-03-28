import { NextResponse } from "next/server";
import {
  ensureApiKeyIfConfigured,
  getProofRecord,
  verifyAndStoreOnChain,
} from "@/lib/server/executionGateway";

export const runtime = "nodejs";

interface VerifyAndStoreBody {
  proofHash?: string;
  publicInputsHash?: string;
  finalStateHash?: string;
  nullifier?: string;
}

export async function POST(request: Request) {
  try {
    ensureApiKeyIfConfigured(request);
    const body = (await request.json()) as VerifyAndStoreBody;

    if (!body.proofHash) {
      return NextResponse.json({ error: "Missing proofHash" }, { status: 400 });
    }

    const record = await getProofRecord(body.proofHash);

    const publicInputsHash = body.publicInputsHash || record?.publicInputsHash;
    const finalStateHash = body.finalStateHash || record?.finalStateHash;
    const nullifier = body.nullifier || record?.nullifier;

    if (!record) {
      return NextResponse.json(
        {
          error:
            "Proof hash is not registered by trusted backend. Call /api/proof/register-valid first.",
        },
        { status: 400 },
      );
    }

    if (!publicInputsHash || !finalStateHash || !nullifier) {
      return NextResponse.json(
        { error: "Missing publicInputsHash, finalStateHash, or nullifier" },
        { status: 400 },
      );
    }

    const receipt = await verifyAndStoreOnChain({
      proofHash: body.proofHash,
      publicInputsHash,
      finalStateHash,
      nullifier,
    });

    return NextResponse.json(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const unauthorized = message.includes("Unauthorized");
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 500 });
  }
}
