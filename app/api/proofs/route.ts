import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import type { ZKProof } from "@/types";

export const runtime = "nodejs";

interface PersistRequestBody {
  proof?: Record<string, unknown>;
  graph?: Record<string, unknown>;
}

interface ProofFilePayload {
  generatedAt?: string;
  proof?: ZKProof;
  graph?: Record<string, unknown> | null;
}

const proofsDir = path.join(process.cwd(), "proofs");

async function readProofFiles(): Promise<Array<{ fileName: string; payload: ProofFilePayload }>> {
  try {
    const entries = await readdir(proofsDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "valid-proof-registry.json")
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));

    const loaded = await Promise.all(
      jsonFiles.map(async (fileName) => {
        try {
          const raw = await readFile(path.join(proofsDir, fileName), "utf-8");
          const payload = JSON.parse(raw) as ProofFilePayload;
          return { fileName, payload };
        } catch {
          return null;
        }
      }),
    );

    return loaded.filter((item): item is { fileName: string; payload: ProofFilePayload } => Boolean(item));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latestOnly = searchParams.get("latest") === "1";

  const files = await readProofFiles();
  if (!files.length) {
    return NextResponse.json(latestOnly ? null : []);
  }

  if (latestOnly) {
    const latest = files[0];
    return NextResponse.json({
      fileName: latest.fileName,
      generatedAt: latest.payload.generatedAt ?? null,
      proof: latest.payload.proof ?? null,
    });
  }

  return NextResponse.json(
    files.map((item) => ({
      fileName: item.fileName,
      generatedAt: item.payload.generatedAt ?? null,
      proofHash: item.payload.proof?.proofHash ?? null,
      commitment: item.payload.proof?.commitment ?? null,
      verified: item.payload.proof?.verified ?? false,
    })),
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PersistRequestBody;

    if (!body.proof) {
      return NextResponse.json({ error: "Missing proof payload" }, { status: 400 });
    }

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
