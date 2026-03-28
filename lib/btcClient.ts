/**
 * BTC Testnet4 Client — via Mempool.space public API
 * No API key required. CORS-friendly from browser.
 *
 * Base URL: https://mempool.space/testnet4/api
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_BTC_RPC_URL ?? "https://mempool.space/testnet4/api";

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_BTC_EXPLORER_URL ?? "https://mempool.space/testnet4";

export interface BtcUtxo {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  value: number; // sats
}

export interface BtcBalance {
  confirmed: number;   // sats
  unconfirmed: number; // sats
  totalBtc: string;    // formatted "X.XXXXXXXX BTC"
}

export interface BtcAddressStats {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

function satsToBtc(sats: number): string {
  return (sats / 1e8).toFixed(8);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`BTC API error ${res.status} at ${url}: ${text}`);
  }

  // /tx broadcast returns plain text txid
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as T;
}

class BtcClient {
  /**
   * Fetch confirmed + unconfirmed balance for a Bitcoin address.
   * Works with any testnet4 address format (Legacy P2PKH, P2SH, Bech32 P2WPKH, Bech32m P2TR).
   */
  async getBalance(address: string): Promise<BtcBalance> {
    const stats = await apiFetch<BtcAddressStats>(`/address/${address}`);

    const confirmedFunded = stats.chain_stats.funded_txo_sum;
    const confirmedSpent = stats.chain_stats.spent_txo_sum;
    const confirmed = confirmedFunded - confirmedSpent;

    const mempoolFunded = stats.mempool_stats.funded_txo_sum;
    const mempoolSpent = stats.mempool_stats.spent_txo_sum;
    const unconfirmed = mempoolFunded - mempoolSpent;

    return {
      confirmed,
      unconfirmed,
      totalBtc: satsToBtc(Math.max(0, confirmed + unconfirmed)),
    };
  }

  /**
   * Fetch UTXOs for a Bitcoin address.
   * Used for PSBT (Partially Signed Bitcoin Transaction) construction.
   */
  async getUtxos(address: string): Promise<BtcUtxo[]> {
    return apiFetch<BtcUtxo[]>(`/address/${address}/utxo`);
  }

  /**
   * Fetch recent transaction IDs for an address.
   */
  async getTxHistory(address: string): Promise<string[]> {
    const txs = await apiFetch<Array<{ txid: string }>>(`/address/${address}/txs`);
    return txs.map((tx) => tx.txid);
  }

  /**
   * Broadcast a raw Bitcoin transaction (hex-encoded) to testnet4.
   * Returns the txid on success.
   */
  async broadcastTx(rawHex: string): Promise<string> {
    const txid = await apiFetch<string>("/tx", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: rawHex,
    });
    return txid.trim();
  }

  /**
   * Get the Mempool.space explorer URL for a transaction.
   */
  getTxExplorerUrl(txid: string): string {
    return `${EXPLORER_URL}/tx/${txid}`;
  }

  /**
   * Get the Mempool.space explorer URL for a Bitcoin address.
   */
  getAddressExplorerUrl(address: string): string {
    return `${EXPLORER_URL}/address/${address}`;
  }

  /**
   * Estimate fee rate (sat/vB) from Mempool.space fee estimates.
   * Returns { fastest, halfHour, hour } in sat/vB.
   */
  async getFeeEstimates(): Promise<Record<string, number>> {
    return apiFetch<Record<string, number>>("/v1/fees/recommended");
  }
}

export const btcClient = new BtcClient();
