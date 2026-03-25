"use client";

import { useEffect, useState } from "react";

import { ExecutionVisualizer } from "@/components/visualizer/ExecutionVisualizer";
import { TEEAttestationCard } from "@/components/tee/TEEAttestationCard";
import { MerkleTreeVisualizer, NullifierStatus, ProofInspector, RangeProofWidget } from "@/components/zk";
import { useWalletStore } from "@/store/walletStore";
import { useZKStore } from "@/store/zkStore";
import { otcClient } from "@/lib/otcClient";
import type { TEEAttestation } from "@/types";

export default function SimulatePage() {
  const { address, connected } = useWalletStore();
  const currentProof = useZKStore((state) => state.currentProof);
  const spentNullifiers = useZKStore((state) => state.spentNullifiers);
  const [attestation, setAttestation] = useState<TEEAttestation | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!connected || !address || !otcClient.isConfigured()) {
        if (currentProof?.teeAttested) {
          setAttestation({
            enclaveType: "Nitro",
            measurementHash: currentProof.proofHash,
            timestamp: currentProof.timestamp,
            valid: true,
          });
        } else {
          setAttestation(null);
        }
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
  }, [address, connected, currentProof]);

  const isSpent = currentProof?.nullifier
    ? spentNullifiers.includes(BigInt(currentProof.nullifier))
    : false;

  return (
    <div className="space-y-6 p-4">
      <ExecutionVisualizer />

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
          leafCount={currentProof ? 1 : 0}
          depth={3}
          highlightedLeaf={currentProof ? 0 : undefined}
        />
      </section>

      <section>
        <ProofInspector proof={currentProof} />
      </section>
    </div>
  );
}
