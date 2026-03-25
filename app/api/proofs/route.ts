import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface PersistRequestBody {
  proof?: Record<string, unknown>;
  graph?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PersistRequestBody;

    if (!body.proof) {
      return NextResponse.json({ error: "Missing proof payload" }, { status: 400 });
    }

    const proofsDir = path.join(process.cwd(), "proofs");
    await mkdir(proofsDir, { recursive: true });

    const proofHashRaw = String((body.proof?.proofHash as string | undefined) ?? "proof");
    const safeHash = proofHashRaw.replace(/^0x/, "").slice(0, 16) || "proof";
    const fileName = `${Date.now()}-${safeHash}.json`;
    const target = path.join(proofsDir, fileName);

    await writeFile(
      target,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          proof: body.proof,
          graph: body.graph ?? null,
        },
        null,
        2,
      ),
      "utf-8",
    );

    return NextResponse.json({
      ok: true,
      fileName,
      filePath: `proofs/${fileName}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
