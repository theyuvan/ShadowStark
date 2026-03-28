import { NextResponse } from "next/server";
import { ensureApiKeyIfConfigured, isNullifierSpentOnChainOrRegistry } from "@/lib/server/executionGateway";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    ensureApiKeyIfConfigured(request);
    const { searchParams } = new URL(request.url);
    const nullifier = searchParams.get("nullifier");

    if (!nullifier) {
      return NextResponse.json({ error: "Missing nullifier query parameter" }, { status: 400 });
    }

    const spent = await isNullifierSpentOnChainOrRegistry(nullifier);
    return NextResponse.json({ spent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const unauthorized = message.includes("Unauthorized");
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 500 });
  }
}
