/**
 * Balance Fetcher — reads real balances from chain.
 *
 * STRK and ETH are fetched by calling balanceOf() on their ERC20 contracts
 * directly against the Starknet Sepolia RPC (same one in .env.local).
 *
 * BTC balance is fetched from the Mempool.space testnet4 public API.
 */

import { RpcProvider, Contract } from "starknet";
import { btcClient } from "@/lib/btcClient";

// ── Starknet token addresses (Sepolia) ────────────────────────────────────────
const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const ETH_ADDRESS =
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

const STARKNET_RPC =
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL ??
  "https://api.cartridge.gg/x/starknet/sepolia";

// ── Minimal ERC20 ABI (only balanceOf needed) ─────────────────────────────────
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
] as const;

// ── helpers ───────────────────────────────────────────────────────────────────

function getProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: STARKNET_RPC });
}

/**
 * Reads an ERC20 balanceOf result and formats it as a human-readable string.
 * Starknet u256 is returned as { low: bigint, high: bigint }.
 */
function formatU256(raw: { low: bigint; high: bigint } | bigint, decimals: number): string {
  let value: bigint;
  if (typeof raw === "bigint") {
    value = raw;
  } else {
    value = (raw.high << 128n) | raw.low;
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 4);
  return `${whole}.${fractionStr}`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch STRK balance for a Starknet address directly from chain.
 * Returns formatted string e.g. "12.3400"
 */
export async function fetchStrkBalance(address: string): Promise<string> {
  try {
    const provider = getProvider();
    const contract = new Contract(ERC20_ABI as unknown as Parameters<typeof Contract>[0], STRK_ADDRESS, provider);
    // Use callData directly to avoid ABI generic issues
    const result = await provider.callContract({
      contractAddress: STRK_ADDRESS,
      entrypoint: "balanceOf",
      calldata: [address],
    });
    // result is [low_felt, high_felt]
    const low = BigInt(result[0] ?? "0");
    const high = BigInt(result[1] ?? "0");
    return formatU256({ low, high }, 18);
  } catch (err) {
    console.warn("[balanceFetcher] STRK balance fetch failed:", err);
    return "0.0000";
  }
}

/**
 * Fetch ETH balance for a Starknet address directly from chain.
 * Returns formatted string e.g. "0.0012"
 */
export async function fetchEthBalance(address: string): Promise<string> {
  try {
    const result = await getProvider().callContract({
      contractAddress: ETH_ADDRESS,
      entrypoint: "balanceOf",
      calldata: [address],
    });
    const low = BigInt(result[0] ?? "0");
    const high = BigInt(result[1] ?? "0");
    return formatU256({ low, high }, 18);
  } catch (err) {
    console.warn("[balanceFetcher] ETH balance fetch failed:", err);
    return "0.0000";
  }
}

/**
 * Fetch BTC balance for a Bitcoin testnet4 address via Mempool.space API.
 * Returns formatted string e.g. "0.00200000"
 */
export async function fetchBtcTestnetBalance(btcAddress: string): Promise<string> {
  try {
    if (!btcAddress || btcAddress.trim() === "") {
      return "0.00000000";
    }
    const bal = await btcClient.getBalance(btcAddress);
    return bal.totalBtc;
  } catch (err) {
    console.warn("[balanceFetcher] BTC balance fetch failed:", err);
    return "0.00000000";
  }
}

/**
 * Fetch all balances at once. Returns { strk, eth, btc }.
 */
export async function fetchAllBalances(starknetAddress: string, btcAddress?: string) {
  const [strk, eth, btc] = await Promise.allSettled([
    fetchStrkBalance(starknetAddress),
    fetchEthBalance(starknetAddress),
    btcAddress ? fetchBtcTestnetBalance(btcAddress) : Promise.resolve("0.00000000"),
  ]);

  return {
    strk: strk.status === "fulfilled" ? strk.value : "0.0000",
    eth: eth.status === "fulfilled" ? eth.value : "0.0000",
    btc: btc.status === "fulfilled" ? btc.value : "0.00000000",
  };
}
