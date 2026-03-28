import type { ExecutionLog, OtcLifecycleStatus, OtcMatchRecord, TEEAttestation, TradeRecord, ZKProof } from "@/types";

export interface TradeIntentPayload {
  walletAddress: string;
  direction: "buy" | "sell";
  templateId: "simple" | "split" | "guarded";
  priceThreshold: number;
  amount: number;
  splitCount: number;
  selectedPath: string;
  depositConfirmed: boolean;
  depositAmount: number;
  walletAuth?: {
    nonce: string;
    signature: string;
    signedAt: number;
  };
}

export interface StrategySummary {
  id: string;
  direction: "buy" | "sell";
  status: OtcLifecycleStatus;
  commitment: string;
  createdAt: number;
}

interface WalletBalances {
  btcBalance: string;
  strkBalance: string;
}

const EXECUTION_API_URL = process.env.NEXT_PUBLIC_EXECUTION_API_URL;
const EXECUTION_API_KEY = process.env.NEXT_PUBLIC_EXECUTION_API_KEY;
const REAL_MODE = process.env.NEXT_PUBLIC_ENABLE_REAL_EXECUTION === "true";

const headers = (): Record<string, string> => {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (EXECUTION_API_KEY) {
    base["x-api-key"] = EXECUTION_API_KEY;
  }
  return base;
};

const ensureConfigured = () => {
  if (!REAL_MODE) {
    throw new Error("Real execution is disabled. Set NEXT_PUBLIC_ENABLE_REAL_EXECUTION=true.");
  }
  if (!EXECUTION_API_URL) {
    throw new Error("Missing NEXT_PUBLIC_EXECUTION_API_URL.");
  }
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  ensureConfigured();

  const response = await fetch(`${EXECUTION_API_URL}${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Execution API error (${response.status}): ${message || "unknown"}`);
  }

  return (await response.json()) as T;
}

export const otcClient = {
  isConfigured(): boolean {
    return Boolean(REAL_MODE && EXECUTION_API_URL);
  },

  submitIntent(payload: TradeIntentPayload): Promise<{
    trade: TradeRecord;
    strategy: StrategySummary;
    proof?: ZKProof;
  }> {
    return request("/otc/intents", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listStrategies(walletAddress: string): Promise<StrategySummary[]> {
    return request(`/otc/strategies?walletAddress=${encodeURIComponent(walletAddress)}`);
  },

  listTrades(walletAddress: string): Promise<TradeRecord[]> {
    return request(`/otc/trades?walletAddress=${encodeURIComponent(walletAddress)}`);
  },

  listExecutionLogs(walletAddress: string): Promise<ExecutionLog[]> {
    return request(`/otc/execution-logs?walletAddress=${encodeURIComponent(walletAddress)}`);
  },

  listMatches(walletAddress: string): Promise<OtcMatchRecord[]> {
    return request(`/otc/matches?walletAddress=${encodeURIComponent(walletAddress)}`);
  },

  getLatestProof(walletAddress: string): Promise<ZKProof | null> {
    return request(`/otc/proofs/latest?walletAddress=${encodeURIComponent(walletAddress)}`);
  },

  getLatestAttestation(walletAddress: string): Promise<TEEAttestation | null> {
    return request(`/tee/attestations/latest?walletAddress=${encodeURIComponent(walletAddress)}`);
  },

  getWalletBalances(walletAddress: string): Promise<WalletBalances> {
    return request(`/wallet/balances?walletAddress=${encodeURIComponent(walletAddress)}`);
  },
};
