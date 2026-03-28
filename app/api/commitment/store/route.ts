import { NextResponse } from "next/server";
import { ensureApiKeyIfConfigured, storeCommitmentOnChain } from "@/lib/server/executionGateway";

export const runtime = "nodejs";

interface StoreCommitmentBody {
  commitment?: string;
  nextMerkleRoot?: string;
}

export async function POST(request: Request) {
  try {
    ensureApiKeyIfConfigured(request);
    const body = (await request.json()) as StoreCommitmentBody;

    if (!body.commitment) {
      return NextResponse.json({ error: "Missing commitment" }, { status: 400 });
    }

    const receipt = await storeCommitmentOnChain({
      commitment: body.commitment,
      nextMerkleRoot: body.nextMerkleRoot,
    });

    return NextResponse.json(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const unauthorized = message.includes("Unauthorized");
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 500 });
  }
}
