"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/navigation";
import { SwapMatchingInterface } from "@/components/swap-matching-interface-new";

interface SwapMatchingPageProps {
  searchParams: {
    intentId?: string;
    matchId?: string;
    wallet?: string;
    direction?: "buy" | "sell";
    amount?: string;
    price?: string;
    sendChain?: "btc" | "strk";
    receiveChain?: "btc" | "strk";
  };
}

export default function SwapMatchingPage({ searchParams }: SwapMatchingPageProps) {
  const intentId = searchParams.intentId || "";
  const matchId = searchParams.matchId || "";
  const direction = (searchParams.direction || "buy") as "buy" | "sell";
  const amount = searchParams.amount || "0";
  const price = searchParams.price || "0";
  const sendChain = (searchParams.sendChain || "btc") as "btc" | "strk";
  const receiveChain = (searchParams.receiveChain || "strk") as "btc" | "strk";

  // State to track the actually connected wallet
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    // Detect the actual connected wallet based on sendChain
    const detectConnectedWallet = async () => {
      try {
        if (sendChain === "strk") {
          // Get Starknet wallet address
          const starknetWindow = (window as any).starknet;
          if (starknetWindow && starknetWindow.selectedAddress) {
            setConnectedWallet(starknetWindow.selectedAddress);
            console.log("[SWAP-MATCHING] Detected Starknet wallet:", starknetWindow.selectedAddress);
            return; // Success - don't fall back
          } else {
            setWalletError("Starknet wallet not detected. Please connect your Starknet wallet.");
          }
        } else if (sendChain === "btc") {
          // Get Bitcoin wallet address - support multiple providers
          let bitcoinProvider = null;
          let providerName = "";
          
          // Try Unisat first
          if ((window as any).unisat) {
            bitcoinProvider = (window as any).unisat;
            providerName = "Unisat";
            console.log("[SWAP-MATCHING] Found Unisat provider");
          }
          // Try Xverse (check multiple possible locations)
          else if ((window as any).xverse) {
            bitcoinProvider = (window as any).xverse;
            providerName = "Xverse";
            console.log("[SWAP-MATCHING] Found Xverse provider at window.xverse");
          }
          // Try XverseProviders (newer Xverse API)
          else if ((window as any).XverseProviders && (window as any).XverseProviders.BitcoinProvider) {
            // XverseProviders.BitcoinProvider is already an instance, use directly
            bitcoinProvider = (window as any).XverseProviders.BitcoinProvider;
            providerName = "Xverse (via XverseProviders)";
            console.log("[SWAP-MATCHING] Found XverseProviders.BitcoinProvider");
          }
          // Try BitcoinProvider directly
          else if ((window as any).BitcoinProvider) {
            bitcoinProvider = (window as any).BitcoinProvider;
            providerName = "BitcoinProvider";
            console.log("[SWAP-MATCHING] Found BitcoinProvider");
          }

          if (bitcoinProvider) {
            try {
              let accounts: string[] | null = null;
              
              // Helper to run with timeout
              const withTimeout = (promise: Promise<any>, timeoutMs: number) => {
                return Promise.race([
                  promise,
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
                  ),
                ]);
              };

              // For Xverse, try to connect first if available
              if (providerName.includes("Xverse") && typeof bitcoinProvider.connect === 'function') {
                try {
                  console.log(`[SWAP-MATCHING] Attempting ${providerName}.connect()...`);
                  await withTimeout(bitcoinProvider.connect(), 5000);
                  console.log(`[SWAP-MATCHING] ${providerName}.connect() succeeded`);
                } catch (connectErr) {
                  console.warn(`[SWAP-MATCHING] ${providerName}.connect() failed or timed out:`, connectErr);
                  // Continue anyway - maybe already connected
                }
              }

              // Try different methods to get accounts with timeout
              if (typeof bitcoinProvider.getAccounts === 'function') {
                console.log(`[SWAP-MATCHING] Calling ${providerName}.getAccounts() with 5s timeout...`);
                accounts = await withTimeout(bitcoinProvider.getAccounts(), 5000);
                console.log(`[SWAP-MATCHING] ${providerName}.getAccounts() returned:`, accounts);
              } else if (typeof bitcoinProvider.request === 'function') {
                // Some providers use request() method
                console.log(`[SWAP-MATCHING] Calling ${providerName}.request(getAccounts) with 5s timeout...`);
                accounts = await withTimeout(bitcoinProvider.request({ method: 'getAccounts' }), 5000);
                console.log(`[SWAP-MATCHING] ${providerName}.request returned:`, accounts);
              } else {
                console.warn(`[SWAP-MATCHING] ${providerName} has no getAccounts() or request() method`);
                console.log("[SWAP-MATCHING] Available methods:", Object.getOwnPropertyNames(bitcoinProvider));
              }

              if (accounts && Array.isArray(accounts) && accounts.length > 0) {
                setConnectedWallet(accounts[0]);
                console.log(`[SWAP-MATCHING] ✅ Successfully detected ${providerName} wallet:`, accounts[0]);
                setWalletError(null);
                return; // Success - don't fall back
              } else {
                console.warn(`[SWAP-MATCHING] No accounts returned from ${providerName}`);
                // Fall through to use URL wallet as fallback
              }
            } catch (providerError) {
              console.error(`[SWAP-MATCHING] Error calling ${providerName}:`, providerError);
              // Fall through to use URL wallet as fallback instead of showing error
            }
          } else {
            console.warn("[SWAP-MATCHING] No Bitcoin wallet provider found - will use URL wallet");
          }
        }
      } catch (err) {
        console.error("[SWAP-MATCHING] Wallet detection error:", err);
        // Fall through to use URL wallet as fallback
      }

      // Fallback: use URL wallet parameter
      if (searchParams.wallet) {
        console.log("[SWAP-MATCHING] Using wallet from URL parameter:", searchParams.wallet);
        setConnectedWallet(searchParams.wallet);
        setWalletError(null);
      } else {
        // No wallet detected and no URL fallback
        setWalletError("No wallet detected. Please ensure a Bitcoin or Starknet wallet is connected.");
      }
    };

    detectConnectedWallet();
    // NOTE: Removed focus event listener to prevent infinite retry loop when wallet detection fails
  }, [sendChain, searchParams.wallet]);

  // Use the URL wallet as fallback if no connected wallet found (for development)
  const walletAddress = connectedWallet || searchParams.wallet || "0x...";

  if (!intentId || !matchId) {
    return (
      <main className="flex flex-col min-h-screen bg-white p-6">
        <Navigation />
        <div className="mt-8 max-w-2xl">
          <h1 className="text-xl font-bold">Missing match details</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Intent ID and Match ID are required for the swap matching interface.
          </p>
        </div>
      </main>
    );
  }

  if (walletError) {
    return (
      <main className="flex flex-col min-h-screen bg-white p-6">
        <Navigation />
        <div className="mt-8 max-w-2xl">
          <h1 className="text-xl font-bold">Wallet Connection Error</h1>
          <p className="mt-2 text-sm text-red-600">{walletError}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Please connect your {sendChain === "strk" ? "Starknet" : "Bitcoin"} wallet and refresh this page.
          </p>
        </div>
      </main>
    );
  }

  if (!connectedWallet) {
    return (
      <main className="flex flex-col min-h-screen bg-white p-6">
        <Navigation />
        <div className="mt-8 max-w-2xl">
          <h1 className="text-xl font-bold">Connecting Wallet...</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Detecting your {sendChain === "strk" ? "Starknet" : "Bitcoin"} wallet...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-white">
      <Navigation />
      <div className="flex-1">
        <SwapMatchingInterface
          intentId={intentId}
          matchId={matchId}
          walletAddress={walletAddress}
          initialIntent={{
            direction,
            amount,
            priceThreshold: price,
          }}
          sendChain={sendChain}
          receiveChain={receiveChain}
        />
      </div>
    </main>
  );
}
