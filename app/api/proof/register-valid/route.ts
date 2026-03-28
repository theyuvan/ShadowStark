import { NextResponse } from "next/server";
import {
  ensureApiKeyIfConfigured,
  registerProofRecord,
  registerValidProofOnChain,
} from "@/lib/server/executionGateway";

export const runtime = "nodejs";

interface RegisterBody {
  proofHash?: string;
  publicInputsHash?: string;
  finalStateHash?: string;
  nullifier?: string;
}

export async function POST(request: Request) {
  try {
    ensureApiKeyIfConfigured(request);
    const body = (await request.json()) as RegisterBody;

    if (!body.proofHash || !body.publicInputsHash) {
      return NextResponse.json({ error: "Missing proofHash or publicInputsHash" }, { status: 400 });
    }

    const receipt = await registerValidProofOnChain(body.proofHash, body.publicInputsHash);

    await registerProofRecord({
      proofHash: body.proofHash,
      publicInputsHash: body.publicInputsHash,
      finalStateHash: body.finalStateHash,
      nullifier: body.nullifier,
    });

    return NextResponse.json({
      ok: true,
      receipt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const unauthorized = message.includes("Unauthorized");
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 500 });
  }
}
