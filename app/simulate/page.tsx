"use client";

import { useEffect, useState } from "react";

import { ExecutionVisualizer } from "@/components/visualizer/ExecutionVisualizer";
import { TEEAttestationCard } from "@/components/tee/TEEAttestationCard";
import { MerkleTreeVisualizer, NullifierStatus, ProofInspector, RangeProofWidget } from "@/components/zk";
import { useWalletStore } from "@/store/walletStore";
import { useZKStore } from "@/store/zkStore";
import { otcClient } from "@/lib/otcClient";
import type { TEEAttestation, ZKProof } from "@/types";

interface LatestProofResponse {
  fileName: string;
  generatedAt: string | null;
  proof: ZKProof | null;
}

export default function SimulatePage() {
  const { address, connected } = useWalletStore();
  const currentProof = useZKStore((state) => state.currentProof);
  const setCurrentProof = useZKStore((state) => state.setCurrentProof);
  const spentNullifiers = useZKStore((state) => state.spentNullifiers);
  const merkleDepth = useZKStore((state) => state.merkleDepth);
  const merkleLeafCount = useZKStore((state) => state.merkleLeafCount);
  const [attestation, setAttestation] = useState<TEEAttestation | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!connected || !address || !otcClient.isConfigured()) {
        setAttestation(null);
        return;
      }

      try {
        const latestAttestation = await otcClient.getLatestAttestation(address);
        setAttestation(latestAttestation);
      } catch {
        setAttestation(null);
      }
    };

    void run();
  }, [address, connected]);

  useEffect(() => {
    const loadLatestProof = async () => {
      if (currentProof) {
        return;
      }

      try {
        const response = await fetch("/api/proofs?latest=1", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as LatestProofResponse | null;
        if (data?.proof) {
          setCurrentProof(data.proof);
        }
      } catch {
        // Non-blocking; simulation UI can still render without a loaded proof.
      }
    };

    void loadLatestProof();
  }, [currentProof, setCurrentProof]);

  const isSpent = currentProof?.nullifier
    ? spentNullifiers.includes(BigInt(currentProof.nullifier))
    : false;

  return (
    <div className="space-y-6 p-4">
      <ExecutionVisualizer proof={currentProof} />

      <section className="grid gap-4 xl:grid-cols-2">
        <TEEAttestationCard attestation={attestation} />
        <RangeProofWidget
          valueCommitment={currentProof?.commitment ?? "0x0"}
          proofGenerated={Boolean(currentProof)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <NullifierStatus
          nullifier={currentProof?.nullifier ? BigInt(currentProof.nullifier) : null}
          isSpent={isSpent}
          isNew={Boolean(currentProof)}
        />
        <MerkleTreeVisualizer
          root={currentProof?.merkleRoot ? BigInt(currentProof.merkleRoot) : 0n}
          leafCount={Math.max(merkleLeafCount, currentProof ? 1 : 0)}
          depth={merkleDepth}
          highlightedLeaf={currentProof ? 0 : undefined}
          merklePath={currentProof?.merklePath}
        />
      </section>

      <section>
        <ProofInspector proof={currentProof} />
      </section>
    </div>
  );
}
