"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface CheckResult {
  inputHash: string;
  foundInArtifacts: boolean;
  artifactFile: string | null;
  proofHash: string | null;
  commitment: string | null;
  locallyVerified: boolean;
  registeredAsValid: boolean;
  verdict: "verified" | "generated_not_verified_onchain" | "not_found";
  chainVerification: { verified: boolean; error?: string } | null;
}

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const [hashInput, setHashInput] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runCheck = async (hashValue: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/proof/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: hashValue }),
      });

      const data = (await response.json()) as CheckResult | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? "Failed to verify hash");
      }

      setResult(data as CheckResult);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to verify hash";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runCheck(hashInput);
  };

  useEffect(() => {
    const hashFromQuery = searchParams.get("hash");
    if (!hashFromQuery) {
      return;
    }

    setHashInput(hashFromQuery);
    void runCheck(hashFromQuery);
  }, [searchParams]);

  return (
    <main className="space-y-4 p-4">
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Proof Checker</p>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Commitment / Proof Hash Verifier</h1>
        <p className="mt-2 text-sm text-secondary">
          Paste a commitment or proof hash to check artifact existence, registry status, and on-chain verifier response.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-xs uppercase tracking-[0.2em] text-muted">Hash</label>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-code text-sm text-foreground"
            value={hashInput}
            onChange={(event) => setHashInput(event.target.value)}
            placeholder="0x..."
          />
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={loading || !hashInput.trim()}
          >
            {loading ? "Checking..." : "Check Hash"}
          </button>
        </form>

        {error ? (
          <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>
        ) : null}
      </section>

      {result ? (
        <section className="rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Verification Result</h2>
            <span
              className={`rounded px-2 py-1 text-xs font-semibold ${
                result.verdict === "verified"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : result.verdict === "generated_not_verified_onchain"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-red-500/20 text-red-400"
              }`}
            >
              {result.verdict}
            </span>
          </div>

          <div className="grid gap-2 text-xs text-secondary">
            <p><span className="text-foreground">Input:</span> <span className="font-code">{result.inputHash}</span></p>
            <p><span className="text-foreground">Artifact Found:</span> {String(result.foundInArtifacts)}</p>
            <p><span className="text-foreground">Artifact File:</span> {result.artifactFile ?? "n/a"}</p>
            <p><span className="text-foreground">Proof Hash:</span> {result.proofHash ?? "n/a"}</p>
            <p><span className="text-foreground">Commitment:</span> {result.commitment ?? "n/a"}</p>
            <p><span className="text-foreground">Local Verification:</span> {String(result.locallyVerified)}</p>
            <p><span className="text-foreground">Registered Valid:</span> {String(result.registeredAsValid)}</p>
            <p><span className="text-foreground">On-chain Verify:</span> {result.chainVerification ? String(result.chainVerification.verified) : "n/a"}</p>
            {result.chainVerification?.error ? (
              <p><span className="text-foreground">Chain Error:</span> {result.chainVerification.error}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
