import { Provider, RpcProvider } from "starknet";

const DEFAULT_RPC =
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL ||
  "https://api.cartridge.gg/x/starknet/sepolia";

const VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS || "";
const SHADOWFLOW_ADDRESS = process.env.NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS || "";

export interface VerificationReceipt {
  txHash: string;
  blockNumber: number;
  success: boolean;
}

export interface ProofVerificationResult {
  proofHash: string;
  publicInputsHash: string;
  isValid: boolean;
  timestamp: number;
}

interface ChainStateResponse {
  merkleRoot: string;
  spentNullifiers: string[];
}

export class ShadowFlowStarknetClient {
  provider: Provider;
  private executionApiUrl?: string;
  private realExecutionEnabled: boolean;
  private verifierAddress: string;
  private shadowflowAddress: string;

  constructor(rpcUrl = DEFAULT_RPC) {
    this.provider = new RpcProvider({ nodeUrl: rpcUrl });
    this.executionApiUrl = process.env.NEXT_PUBLIC_EXECUTION_API_URL;
    this.realExecutionEnabled = process.env.NEXT_PUBLIC_ENABLE_REAL_EXECUTION === "true";
    this.verifierAddress = VERIFIER_ADDRESS;
    this.shadowflowAddress = SHADOWFLOW_ADDRESS;
  }

  /**
   * Verify a proof directly against the on-chain GaragaVerifier contract
   */
  async verifyProofOnChain(
    proofHash: string,
    publicInputsHash: string
  ): Promise<ProofVerificationResult> {
    if (!this.verifierAddress) {
      throw new Error(
        "GaragaVerifier contract address not configured. Set NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS."
      );
    }

    try {
      const result = await this.provider.callContract({
        contractAddress: this.verifierAddress,
        entrypoint: "verify",
        calldata: [proofHash, publicInputsHash],
      });

      const flag = result?.[0] ?? "0x0";
      const isValid = BigInt(flag) === 1n;

      return {
        proofHash,
        publicInputsHash,
        isValid,
        timestamp: Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`On-chain proof verification failed: ${message}`);
    }
  }

  /**
   * Query the ShadowFlow contract for a user's commitment
   */
  async getCommitment(userAddress: string): Promise<string> {
    if (!this.shadowflowAddress) {
      throw new Error(
        "ShadowFlow contract address not configured. Set NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS."
      );
    }

    try {
      const result = await this.provider.callContract({
        contractAddress: this.shadowflowAddress,
        entrypoint: "get_commitment",
        calldata: [userAddress],
      });

      return result?.[0] ?? "0x0";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to fetch commitment: ${message}`);
    }
  }

  /**
   * Query the current Merkle root from ShadowFlow contract
   */
  async getMerkleRoot(): Promise<string> {
    if (!this.shadowflowAddress) {
      throw new Error(
        "ShadowFlow contract address not configured. Set NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS."
      );
    }

    try {
      const result = await this.provider.callContract({
        contractAddress: this.shadowflowAddress,
        entrypoint: "get_merkle_root",
        calldata: [],
      });

      return result?.[0] ?? "0x0";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to fetch Merkle root: ${message}`);
    }
  }

  /**
   * Check if a nullifier has been spent in the ShadowFlow contract
   */
  async isNullifierSpent(nullifier: string): Promise<boolean> {
    if (!this.shadowflowAddress) {
      throw new Error(
        "ShadowFlow contract address not configured. Set NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS."
      );
    }

    try {
      const result = await this.provider.callContract({
        contractAddress: this.shadowflowAddress,
        entrypoint: "is_nullifier_spent",
        calldata: [nullifier],
      });

      const flag = result?.[0] ?? "0x0";
      return BigInt(flag) === 1n;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to check nullifier status: ${message}`);
    }
  }

  async storeCommitment(commitment: string): Promise<VerificationReceipt> {
    if (!this.realExecutionEnabled) {
      throw new Error(
        "Real execution is disabled. Set NEXT_PUBLIC_ENABLE_REAL_EXECUTION=true and configure NEXT_PUBLIC_EXECUTION_API_URL."
      );
    }

    if (!this.executionApiUrl) {
      throw new Error("Missing NEXT_PUBLIC_EXECUTION_API_URL for real commitment storage.");
    }

    const response = await fetch(`${this.executionApiUrl}/commitment/store`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commitment }),
    });

    if (!response.ok) {
      throw new Error(`Commitment store failed: ${response.status}`);
    }

    const data = (await response.json()) as VerificationReceipt;
    return data;
  }

  async verifyAndStore(proofHash: string, finalStateHash: string): Promise<VerificationReceipt> {
    if (!this.realExecutionEnabled) {
      throw new Error(
        "Real execution is disabled. Set NEXT_PUBLIC_ENABLE_REAL_EXECUTION=true and configure NEXT_PUBLIC_EXECUTION_API_URL."
      );
    }

    if (!this.executionApiUrl) {
      throw new Error("Missing NEXT_PUBLIC_EXECUTION_API_URL for on-chain verification.");
    }

    const response = await fetch(`${this.executionApiUrl}/proof/verify-and-store`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proofHash, finalStateHash }),
    });

    if (!response.ok) {
      throw new Error(`Proof verify/store failed: ${response.status}`);
    }

    const data = (await response.json()) as VerificationReceipt;
    return data;
  }

  async checkNullifierSpent(nullifier: string): Promise<boolean> {
    if (!this.realExecutionEnabled) {
      throw new Error("Real execution is disabled. Enable NEXT_PUBLIC_ENABLE_REAL_EXECUTION=true.");
    }

    if (!this.executionApiUrl) {
      throw new Error("Missing NEXT_PUBLIC_EXECUTION_API_URL for nullifier checks.");
    }

    const response = await fetch(
      `${this.executionApiUrl}/nullifier/spent?nullifier=${encodeURIComponent(nullifier)}`,
      { method: "GET", headers: { "Content-Type": "application/json" } },
    );

    if (!response.ok) {
      throw new Error(`Nullifier status failed: ${response.status}`);
    }

    const data = (await response.json()) as { spent: boolean };
    return data.spent;
  }

  async syncChainState(): Promise<ChainStateResponse> {
    if (!this.realExecutionEnabled) {
      throw new Error("Real execution is disabled. Enable NEXT_PUBLIC_ENABLE_REAL_EXECUTION=true.");
    }

    if (!this.executionApiUrl) {
      throw new Error("Missing NEXT_PUBLIC_EXECUTION_API_URL for chain state sync.");
    }

    const response = await fetch(`${this.executionApiUrl}/chain/state`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Chain state sync failed: ${response.status}`);
    }

    return (await response.json()) as ChainStateResponse;
  }
}

export const starknetClient = new ShadowFlowStarknetClient();
