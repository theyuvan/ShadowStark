import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Account, RpcProvider } from "starknet";

export interface VerificationReceipt {
  txHash: string;
  blockNumber: number;
  success: boolean;
}

interface ValidProofRecord {
  proofHash: string;
  publicInputsHash: string;
  finalStateHash?: string;
  nullifier?: string;
  registeredAt: string;
  spentAt?: string;
}

interface ValidProofRegistry {
  proofs: Record<string, ValidProofRecord>;
}

const DEFAULT_RPC =
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL ||
  process.env.STARKNET_RPC ||
  "https://api.cartridge.gg/x/starknet/sepolia";

const EXECUTION_API_KEY = process.env.EXECUTION_API_KEY || process.env.NEXT_PUBLIC_EXECUTION_API_KEY || "";
const SHADOWFLOW_ADDRESS = process.env.NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS || "";
const VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS || "";
const EXECUTOR_ADDRESS = process.env.STARKNET_EXECUTOR_ADDRESS || "";
const EXECUTOR_PRIVATE_KEY = process.env.STARKNET_EXECUTOR_PRIVATE_KEY || "";

const REGISTRY_PATH = path.join(process.cwd(), "proofs", "valid-proof-registry.json");

export function ensureApiKeyIfConfigured(request: Request): void {
  if (!EXECUTION_API_KEY) {
    return;
  }

  const provided = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
  if (provided !== EXECUTION_API_KEY) {
    throw new Error("Unauthorized execution API request");
  }
}

function getSigner(): Account {
  if (!EXECUTOR_ADDRESS || !EXECUTOR_PRIVATE_KEY) {
    throw new Error(
      "Missing STARKNET_EXECUTOR_ADDRESS or STARKNET_EXECUTOR_PRIVATE_KEY for server execution routes.",
    );
  }

  const provider = new RpcProvider({ nodeUrl: DEFAULT_RPC });
  return new Account({
    provider,
    address: EXECUTOR_ADDRESS,
    signer: EXECUTOR_PRIVATE_KEY,
  });
}

async function loadRegistry(): Promise<ValidProofRegistry> {
  try {
    const raw = await readFile(REGISTRY_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ValidProofRegistry;
    return {
      proofs: parsed.proofs ?? {},
    };
  } catch {
    return { proofs: {} };
  }
}

async function saveRegistry(registry: ValidProofRegistry): Promise<void> {
  await mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

export async function registerProofRecord(payload: {
  proofHash: string;
  publicInputsHash: string;
  finalStateHash?: string;
  nullifier?: string;
}): Promise<void> {
  const registry = await loadRegistry();
  registry.proofs[payload.proofHash.toLowerCase()] = {
    proofHash: payload.proofHash,
    publicInputsHash: payload.publicInputsHash,
    finalStateHash: payload.finalStateHash,
    nullifier: payload.nullifier,
    registeredAt: new Date().toISOString(),
  };
  await saveRegistry(registry);
}

export async function getProofRecord(proofHash: string): Promise<ValidProofRecord | undefined> {
  const registry = await loadRegistry();
  return registry.proofs[proofHash.toLowerCase()];
}

export async function markNullifierSpent(nullifier: string): Promise<void> {
  const registry = await loadRegistry();
  const normalized = nullifier.toLowerCase();
  for (const key of Object.keys(registry.proofs)) {
    if (registry.proofs[key].nullifier?.toLowerCase() === normalized) {
      registry.proofs[key].spentAt = new Date().toISOString();
    }
  }
  await saveRegistry(registry);
}

export async function getKnownSpentNullifiers(): Promise<string[]> {
  const registry = await loadRegistry();
  const values = Object.values(registry.proofs);
  return values.filter((item) => Boolean(item.spentAt && item.nullifier)).map((item) => item.nullifier as string);
}

export async function registerValidProofOnChain(
  proofHash: string,
  publicInputsHash: string,
): Promise<VerificationReceipt> {
  if (!VERIFIER_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS.");
  }

  const signer = getSigner();
  let invoke;
  try {
    invoke = await signer.execute({
      contractAddress: VERIFIER_ADDRESS,
      entrypoint: "register_verified_proof",
      calldata: [proofHash, publicInputsHash, "0x1"],
    });
  } catch {
    // Backward-compatible path for already deployed verifier versions.
    invoke = await signer.execute({
      contractAddress: VERIFIER_ADDRESS,
      entrypoint: "set_allowed_proof",
      calldata: [proofHash, "0x1"],
    });
  }

  const receipt = await signer.waitForTransaction(invoke.transaction_hash);
  const blockRaw = (receipt as { block_number?: number }).block_number;

  return {
    txHash: invoke.transaction_hash,
    blockNumber: typeof blockRaw === "number" ? blockRaw : 0,
    success: true,
  };
}

export async function storeCommitmentOnChain(payload: {
  commitment: string;
  nextMerkleRoot?: string;
}): Promise<VerificationReceipt> {
  if (!SHADOWFLOW_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS.");
  }

  const signer = getSigner();
  const provider = new RpcProvider({ nodeUrl: DEFAULT_RPC });

  let nextMerkleRoot = payload.nextMerkleRoot;
  if (!nextMerkleRoot) {
    const result = await provider.callContract({
      contractAddress: SHADOWFLOW_ADDRESS,
      entrypoint: "get_merkle_root",
      calldata: [],
    });
    nextMerkleRoot = result?.[0] ?? "0x0";
  }

  const invoke = await signer.execute({
    contractAddress: SHADOWFLOW_ADDRESS,
    entrypoint: "store_commitment",
    calldata: [payload.commitment, nextMerkleRoot],
  });

  const receipt = await signer.waitForTransaction(invoke.transaction_hash);
  const blockRaw = (receipt as { block_number?: number }).block_number;

  return {
    txHash: invoke.transaction_hash,
    blockNumber: typeof blockRaw === "number" ? blockRaw : 0,
    success: true,
  };
}

export async function verifyAndStoreOnChain(payload: {
  proofHash: string;
  publicInputsHash: string;
  finalStateHash: string;
  nullifier: string;
}): Promise<VerificationReceipt> {
  if (!SHADOWFLOW_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS.");
  }

  const signer = getSigner();
  const invoke = await signer.execute({
    contractAddress: SHADOWFLOW_ADDRESS,
    entrypoint: "verify_and_store",
    calldata: [payload.proofHash, payload.publicInputsHash, payload.finalStateHash, payload.nullifier],
  });

  const receipt = await signer.waitForTransaction(invoke.transaction_hash);
  const blockRaw = (receipt as { block_number?: number }).block_number;

  await markNullifierSpent(payload.nullifier);

  return {
    txHash: invoke.transaction_hash,
    blockNumber: typeof blockRaw === "number" ? blockRaw : 0,
    success: true,
  };
}

export async function readChainState(): Promise<{ merkleRoot: string; spentNullifiers: string[] }> {
  if (!SHADOWFLOW_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS.");
  }

  const provider = new RpcProvider({ nodeUrl: DEFAULT_RPC });
  const merkleRootResult = await provider.callContract({
    contractAddress: SHADOWFLOW_ADDRESS,
    entrypoint: "get_merkle_root",
    calldata: [],
  });

  const spentNullifiers = await getKnownSpentNullifiers();

  return {
    merkleRoot: merkleRootResult?.[0] ?? "0x0",
    spentNullifiers,
  };
}

export async function isNullifierSpentOnChainOrRegistry(nullifier: string): Promise<boolean> {
  if (!SHADOWFLOW_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS.");
  }

  const provider = new RpcProvider({ nodeUrl: DEFAULT_RPC });
  const chainResult = await provider.callContract({
    contractAddress: SHADOWFLOW_ADDRESS,
    entrypoint: "is_nullifier_spent",
    calldata: [nullifier],
  });

  const onChain = BigInt(chainResult?.[0] ?? "0x0") === 1n;
  if (onChain) {
    return true;
  }

  const known = await getKnownSpentNullifiers();
  return known.some((value) => value.toLowerCase() === nullifier.toLowerCase());
}
