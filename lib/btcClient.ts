/**
 * BTC Testnet4 Client — via Mempool.space public API
 * No API key required. CORS-friendly from browser.
 * Falls back to multiple external sources if primary fails.
 *
 * Base URL: https://mempool.space/testnet4/api
 */

// Ensure BASE_URL is always a valid string
const BASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_BTC_RPC_URL || "https://mempool.space/testnet4/api";
  // Validate it starts with https:// or http://
  if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
    // Ensure no trailing slash
    return url.replace(/\/$/, "");
  }
  return "https://mempool.space/testnet4/api";
})();

console.log(`[btcClient] BASE_URL initialized: ${BASE_URL}`);

const EXPLORER_URL =
  (process.env.NEXT_PUBLIC_BTC_EXPLORER_URL ?? "https://mempool.space/testnet4").replace(/\/$/, "");

// Fallback sources for BTC balance queries
const FALLBACK_SOURCES = [
  "https://mempool.space/testnet4/api",
  "https://blockstream.info/testnet4/api",
];


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
  // Validate path
  if (!path || typeof path !== "string") {
    throw new Error(`[btcClient] Invalid API path: ${path}`);
  }
  if (!path.startsWith("/")) {
    throw new Error(`[btcClient] API path must start with /: ${path}`);
  }

  // Check BASE_URL is valid
  if (!BASE_URL || !BASE_URL.startsWith("http")) {
    throw new Error(`[btcClient] Invalid BASE_URL: ${BASE_URL}`);
  }

  const url = `${BASE_URL}${path}`;
  
  // Validate final URL
  try {
    new URL(url);
  } catch (err) {
    console.error(`[btcClient] Invalid URL constructed: ${url}`);
    console.error(`[btcClient] Details - BASE_URL=${BASE_URL}, path=${path}`);
    throw new Error(`Invalid URL: ${url}`);
  }

  try {
    console.log(`[btcClient] Fetching ${url}...`);
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": "ShadowFlow BTC OTC Client",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.error(`[btcClient] HTTP ${res.status} at ${url}`);
      console.error(`[btcClient] Response: ${text.slice(0, 200)}`);
      throw new Error(`BTC API error ${res.status}: ${text}`);
    }

    // /tx broadcast returns plain text txid
    const contentType = res.headers.get("content-type") ?? "";
    const result = contentType.includes("application/json")
      ? await res.json()
      : await res.text();
    
    console.log(`[btcClient] ✅ Successfully fetched from ${url}`);
    return result as T;
  } catch (err) {
    console.error(`[btcClient] Failed to fetch ${url}:`, err);
    throw err;
  }
}

/**
 * Try fetching from multiple external sources
 * Useful when primary API is down
 */
async function apiFetchWithFallback<T>(path: string, init?: RequestInit, sources?: string[]): Promise<T> {
  const sourcesToTry = sources || [BASE_URL, ...FALLBACK_SOURCES.filter(s => s !== BASE_URL)];
  const errors: string[] = [];

  console.log(`[btcClient] Trying fallback sources for ${path}:`, sourcesToTry);

  for (let idx = 0; idx < sourcesToTry.length; idx++) {
    const source = sourcesToTry[idx];
    try {
      if (!source || typeof source !== "string" || !source.startsWith("http")) {
        errors.push(`Source ${idx}: Invalid URL format - ${source}`);
        console.warn(`[btcClient] Skipping invalid source ${idx}: ${source}`);
        continue;
      }

      const url = `${source}${path}`;
      console.log(`[btcClient] Trying source ${idx + 1}/${sourcesToTry.length}: ${url}`);
      
      const res = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          "User-Agent": "ShadowFlow BTC OTC Client",
          ...init?.headers,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        errors.push(`Source ${idx}: HTTP ${res.status}`);
        console.warn(`[btcClient] Source ${idx} returned ${res.status}`);
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      const result = contentType.includes("application/json")
        ? await res.json()
        : await res.text();
        
      console.log(`[btcClient] ✅ Successfully fetched from source ${idx}: ${source}`);
      return result as T;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Source ${idx}: ${errMsg}`);
      console.warn(`[btcClient] Source ${idx} failed: ${errMsg}`);
      continue;
    }
  }

  // All sources failed
  const errorMsg = `[btcClient] Failed to fetch ${path} from all ${sourcesToTry.length} sources:\n${errors.map((e, i) => `  ${i}: ${e}`).join("\n")}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

class BtcClient {
  /**
   * Fetch confirmed + unconfirmed balance for a Bitcoin address.
   * Works with any testnet4 address format (Legacy P2PKH, P2SH, Bech32 P2WPKH, Bech32m P2TR).
   * Falls back to external sources if primary API fails.
   */
  async getBalance(address: string): Promise<BtcBalance> {
    // Validate address
    if (!address || typeof address !== "string" || address.trim() === "") {
      console.error(`[btcClient] Invalid address provided: ${address}`);
      throw new Error("Invalid Bitcoin address");
    }

    const trimmedAddr = address.trim();
    console.log(`[btcClient] Fetching balance for address: ${trimmedAddr.slice(0, 20)}...`);

    let stats: BtcAddressStats;
    
    try {
      // Try primary source first
      stats = await apiFetch<BtcAddressStats>(`/address/${trimmedAddr}`);
      console.log(`[btcClient] ✅ Got balance from primary source`);
    } catch (primaryErr) {
      console.warn(`[btcClient] Primary source failed: ${primaryErr}`);
      console.log(`[btcClient] Trying fallback sources...`);
      
      // Fall back to trying multiple sources
      try {
        stats = await apiFetchWithFallback<BtcAddressStats>(`/address/${trimmedAddr}`);
      } catch (fallbackErr) {
        console.error(`[btcClient] All sources failed to get balance: ${fallbackErr}`);
        // Return default zero balance if all sources fail
        return {
          confirmed: 0,
          unconfirmed: 0,
          totalBtc: "0.00000000",
        };
      }
    }

    // Validate response structure
    if (!stats || !stats.chain_stats || !stats.mempool_stats) {
      console.error(`[btcClient] Invalid response structure from API:`, stats);
      return {
        confirmed: 0,
        unconfirmed: 0,
        totalBtc: "0.00000000",
      };
    }

    const confirmedFunded = stats.chain_stats.funded_txo_sum ?? 0;
    const confirmedSpent = stats.chain_stats.spent_txo_sum ?? 0;
    const confirmed = Math.max(0, confirmedFunded - confirmedSpent);

    const mempoolFunded = stats.mempool_stats.funded_txo_sum ?? 0;
    const mempoolSpent = stats.mempool_stats.spent_txo_sum ?? 0;
    const unconfirmed = Math.max(0, mempoolFunded - mempoolSpent);

    const totalBtc = satsToBtc(confirmed + unconfirmed);
    console.log(`[btcClient] Balance for ${trimmedAddr.slice(0, 20)}...: confirmed=${confirmed}, unconfirmed=${unconfirmed}, total=${totalBtc}`);

    return {
      confirmed,
      unconfirmed,
      totalBtc,
    };
  }

  /**
   * Fetch UTXOs for a Bitcoin address.
   * Used for PSBT (Partially Signed Bitcoin Transaction) construction.
   * Falls back to external sources if primary fails.
   */
  async getUtxos(address: string): Promise<BtcUtxo[]> {
    try {
      return await apiFetch<BtcUtxo[]>(`/address/${address}/utxo`);
    } catch (err) {
      console.warn(`[btcClient] Primary source failed for UTXOs, trying fallback:`, err);
      try {
        return await apiFetchWithFallback<BtcUtxo[]>(`/address/${address}/utxo`);
      } catch (fallbackErr) {
        console.error(`[btcClient] All sources failed for UTXO fetch:`, fallbackErr);
        return [];
      }
    }
  }

  /**
   * Fetch recent transaction IDs for an address.
   * Falls back to external sources if primary fails.
   */
  async getTxHistory(address: string): Promise<string[]> {
    try {
      const txs = await apiFetch<Array<{ txid: string }>>(`/address/${address}/txs`);
      return txs.map((tx) => tx.txid);
    } catch (err) {
      console.warn(`[btcClient] Primary source failed for TX history, trying fallback:`, err);
      try {
        const txs = await apiFetchWithFallback<Array<{ txid: string }>>(`/address/${address}/txs`);
        return txs.map((tx) => tx.txid);
      } catch (fallbackErr) {
        console.error(`[btcClient] All sources failed for TX history:`, fallbackErr);
        return [];
      }
    }
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
