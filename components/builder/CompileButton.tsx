"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";

import { Button } from "@/components/ui/button";
import { compileCommitment } from "@/lib/commitment";
import { generateZkProof, verifyZkProof } from "@/lib/zkProver";
import type { Strategy } from "@/types";
import type { ZKProof } from "@/types";

interface CompileButtonProps {
  strategy: Strategy;
  disabled?: boolean;
  onCompiled: (result: { commitment: string; proof: ZKProof; verified: boolean }) => void;
  onError?: (message: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

const walletConfirmationTypedData = (commitment: string) => ({
  types: {
    StarkNetDomain: [
      { name: "name", type: "shortstring" },
      { name: "version", type: "shortstring" },
      { name: "chainId", type: "shortstring" },
    ],
    CompileIntent: [
      { name: "action", type: "shortstring" },
      { name: "commitment", type: "felt" },
    ],
  },
  primaryType: "CompileIntent",
  domain: {
    name: "ShadowFlow",
    version: "1",
    chainId: "SN_SEPOLIA",
  },
  message: {
    action: "compile_to_zk",
    commitment,
  },
});

async function requestWalletCompileConfirmation(commitment: string): Promise<void> {
  const signer = (
    window as Window & {
      starknet?: { account?: { signMessage?: (typedData: Record<string, unknown>) => Promise<unknown> } };
    }
  ).starknet?.account?.signMessage;
  if (!signer) {
    throw new Error("Wallet signature is required. Reconnect using a Starknet wallet with signMessage support.");
  }

  await signer(walletConfirmationTypedData(commitment));
}

export function CompileButton({ strategy, disabled, onCompiled, onError, onLoadingChange }: CompileButtonProps) {
  const [loading, setLoading] = useState(false);
  const connected = useWalletStore((state) => state.connected);
  const address = useWalletStore((state) => state.address);

  return (
    <Button
      disabled={disabled || loading}
      onClick={async () => {
        if (!connected || !address) {
          onError?.("Connect wallet before compiling to ZK.");
          return;
        }

        setLoading(true);
        onLoadingChange?.(true);
        try {
          const commitment = compileCommitment(strategy);
          await requestWalletCompileConfirmation(commitment);
          const proof = await generateZkProof(strategy.graph, commitment);
          const verified = await verifyZkProof(proof);
          onCompiled({ commitment, proof, verified });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to compile strategy to ZK.";
          onError?.(message);
        } finally {
          setLoading(false);
          onLoadingChange?.(false);
        }
      }}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Compile to ZK (Wallet Confirm) →
    </Button>
  );
}
