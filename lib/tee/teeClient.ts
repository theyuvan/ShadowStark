import type { ExecutionLog, Strategy, TEEAttestation } from "@/types";

export async function runInTEE(
  strategy: Strategy,
  executionFn: () => ExecutionLog[]
): Promise<{ logs: ExecutionLog[]; attestation: TEEAttestation }> {
  if (process.env.NEXT_PUBLIC_ENABLE_REAL_EXECUTION !== "true") {
    throw new Error("TEE execution disabled. Enable NEXT_PUBLIC_ENABLE_REAL_EXECUTION=true.");
  }

  const logs = executionFn();
  const apiUrl = process.env.NEXT_PUBLIC_EXECUTION_API_URL;

  if (!apiUrl) {
    throw new Error("Missing NEXT_PUBLIC_EXECUTION_API_URL for TEE attestation retrieval.");
  }

  const response = await fetch(`${apiUrl}/tee/attest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategyId: strategy.id }),
  });

  if (!response.ok) {
    throw new Error(`TEE attestation request failed: ${response.status}`);
  }

  const attestation = (await response.json()) as TEEAttestation;
  return { logs, attestation };
}
