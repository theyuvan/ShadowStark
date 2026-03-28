import { hash } from "starknet";

import type { ZKProof } from "@/types";

export function getProofPublicInputsHash(proof: ZKProof): string {
  return hash.computePoseidonHashOnElements([
    proof.commitment,
    proof.finalStateHash,
    proof.nullifier,
    proof.merkleRoot,
  ]);
}
