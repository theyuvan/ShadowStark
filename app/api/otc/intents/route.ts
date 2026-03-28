import { NextResponse } from "next/server";

import { ensureApiKeyIfConfigured } from "@/lib/server/executionGateway";
import { submitIntent } from "@/lib/server/otcStateStore";

export const runtime = "nodejs";

interface IntentBody {
  walletAddress?: string;
  direction?: "buy" | "sell";
  templateId?: "simple" | "split" | "guarded";
  priceThreshold?: number;
  amount?: number;
  splitCount?: number;
  selectedPath?: string;
  depositConfirmed?: boolean;
  depositAmount?: number;
}

export async function POST(request: Request) {
  try {
    ensureApiKeyIfConfigured(request);
    const body = (await request.json()) as IntentBody;

    if (!body.walletAddress || !body.direction || !body.templateId || !body.selectedPath) {
      return NextResponse.json(
        { error: "Missing walletAddress, direction, templateId, or selectedPath" },
        { status: 400 },
      );
    }

    const amount = Number(body.amount ?? 0);
    const priceThreshold = Number(body.priceThreshold ?? 0);
    const splitCount = Number(body.splitCount ?? 1);
    const depositAmount = Number(body.depositAmount ?? 0);

    const result = await submitIntent({
      walletAddress: body.walletAddress,
      direction: body.direction,
      templateId: body.templateId,
      priceThreshold,
      amount,
      splitCount,
      selectedPath: body.selectedPath,
      depositConfirmed: Boolean(body.depositConfirmed),
      depositAmount,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const unauthorized = message.includes("Unauthorized");
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 500 });
  }
}
