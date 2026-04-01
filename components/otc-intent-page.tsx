"use client";

import { FormEvent, useCallback, useMemo, useState, useEffect } from "react";
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, XCircle, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useXverseWallet } from "@/hooks/useXverseWallet";
import { useWalletStore } from "@/store/walletStore";
import { fetchAllBalances } from "@/lib/balanceFetcher";

import type { ExecutionLog, OtcMatchRecord, TradeRecord, ZKProof, TEEAttestation } from "@/types";

interface WalletBalances {
  btcBalance: string;
  strkBalance: string;
}

interface LivePrices {
  btc: number;
  strk: number;
}

interface StrategySummary {
  id: string;
  direction: "buy" | "sell";
  status: "open" | "matched" | "settled";
  commitment: string;
  createdAt: number;
}

interface ChainState {
  merkleRoot: string;
  spentNullifiers: string[];
}

interface DashboardState {
  balances: WalletBalances;
  strategies: StrategySummary[];
  trades: TradeRecord[];
  matches: OtcMatchRecord[];
  logs: ExecutionLog[];
  proof: ZKProof | null;
  attestation: TEEAttestation | null;
  chainState: ChainState;
}

interface IntentFormState {
  direction: "buy" | "sell";
  templateId: "simple" | "split" | "guarded";
  selectedPath: string;
  amount: string;
  priceThreshold: string;
  splitCount: string;
  depositAmount: string;
  depositConfirmed: boolean;
  sendChain: "btc" | "strk";
  receiveChain: "btc" | "strk";
  receiveWalletAddress: string;
}

const defaultState: DashboardState = {
  balances: { btcBalance: "0.0000", strkBalance: "0.00" },
  strategies: [],
  trades: [],
  matches: [],
  logs: [],
  proof: null,
  attestation: null,
  chainState: { merkleRoot: "0x0", spentNullifiers: [] },
};

const defaultIntentState: IntentFormState = {
  direction: "buy",
  templateId: "simple",
  selectedPath: "btc_otc_main",
  // Filled from wallet balances on connect/refresh.
  amount: "",
  // This is the "CRT receive amount" (receiveAmount) the backend validates against oracle.
  priceThreshold: "",
  splitCount: "1",
  depositAmount: "",
  depositConfirmed: true,
  sendChain: "strk",
  receiveChain: "btc",
  receiveWalletAddress: "",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

function shortHex(value: string, start = 10, end = 8): string {
  if (!value || value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function OtcIntentPage() {
  const router = useRouter();
  const {
    wallet,
    isConnecting,
    connectWallet,
    connectXverse,
    connectUnisat,
    error: walletError,
    xverseAvailable,
    unisatAvailable,
  } = useXverseWallet();
  const [walletAddress, setWalletAddress] = useState("");
  const [intent, setIntent] = useState<IntentFormState>(defaultIntentState);
  const [data, setData] = useState<DashboardState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [livePrices, setLivePrices] = useState<LivePrices>({ btc: 0, strk: 0 });
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(false);
  const [priceThresholdManuallyEdited, setPriceThresholdManuallyEdited] = useState(false);
  const [starknetConnecting, setStarknetConnecting] = useState(false);
  const [starknetError, setStarknetError] = useState<string | null>(null);
  
  // Starknet wallet from store
  const {
    connected: starknetConnected,
    connecting: starknetConnectingStore,
    address: starknetAddress,
    setConnecting: setStarknetConnectingStore,
    setConnected: setStarknetConnected,
    setAddress: setStarknetAddress,
    setWalletName,
    setBalances: setStoreBalances,
    btcAddress,
    disconnect: disconnectStarknet,
  } = useWalletStore();

  // Native live Oracle Price polling for accurate Frontend Estimates 
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const btcId = 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
        const strkId = '6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870';
        const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${btcId}&ids[]=${strkId}`);
        const oracle = await res.json();
        const formatPrice = (p: { price: string; expo: number }) => parseFloat(p.price) * Math.pow(10, p.expo);
        setLivePrices({
          btc: formatPrice(oracle.parsed[0].price),
          strk: formatPrice(oracle.parsed[1].price),
        });
      } catch (err) {
        console.warn("Oracle sync failed:", err);
      }
    };
    fetchPrices();
    const timer = setInterval(fetchPrices, 15000);
    return () => clearInterval(timer);
  }, []);

  // Set wallet address from BTC wallet when connected and auto-adjust chain direction
  useEffect(() => {
    if (wallet?.address) {
      setWalletAddress(wallet.address);
      
      // Auto-detect wallet type and swap chain direction
      // Bitcoin wallets should send BTC, receive STRK
      // Starknet wallets should send STRK, receive BTC
      if (wallet.provider === 'xverse' || wallet.provider === 'unisat') {
        // Bitcoin wallet connected - send BTC, receive STRK
        setIntent(prev => ({
          ...prev,
          sendChain: 'btc',
          receiveChain: 'strk',
          // Don't clear receiveWalletAddress - user might have already entered it
        }));
      }
    }
  }, [wallet?.address, wallet?.provider]);
  
  // Auto-fill Receive Wallet Address based on receiveChain
  useEffect(() => {
    let receiveWallet = '';
    
    if (intent.receiveChain === 'strk') {
      // Need Starknet wallet
      if (starknetConnected && starknetAddress) {
        receiveWallet = starknetAddress;
      } else {
        receiveWallet = ''; // Don't auto-fill until connected
      }
    } else if (intent.receiveChain === 'btc') {
      // Need Bitcoin wallet
      if (walletAddress) {
        receiveWallet = walletAddress;
      } else {
        receiveWallet = '';
      }
    }
    
    setIntent(prev => ({
      ...prev,
      receiveWalletAddress: receiveWallet
    }));
  }, [intent.receiveChain, starknetConnected, starknetAddress, walletAddress]);
  
  // Handle Starknet wallet connection
  const handleStarknetConnect = async (walletType: "argentx" | "braavos" | "ready" | "metamask-snap") => {
    try {
      setStarknetConnecting(true);
      setStarknetError(null);
      setWalletName(walletType);
      
      const injectedWallet = (window as any).starknet;
      if (!injectedWallet) {
        throw new Error("No Starknet wallet detected. Install ArgentX or Braavos from their official sites.");
      }
      
      await injectedWallet.enable({ showModal: true });
      
      const selectedAddress = injectedWallet.selectedAddress || injectedWallet.account?.address;
      if (!selectedAddress) {
        throw new Error("Wallet connection failed — no address returned.");
      }
      
      setStarknetAddress(selectedAddress);
      setStarknetConnected(true);
      
      // Fetch balances
      const balances = await fetchAllBalances(selectedAddress, btcAddress ?? undefined);
      setStoreBalances(balances.btc, balances.strk, balances.eth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Starknet connection failed";
      setStarknetError(msg);
      console.error("[OTC] Starknet connect failed:", err);
      disconnectStarknet();
    } finally {
      setStarknetConnecting(false);
    }
  };

  const encodedWallet = useMemo(() => encodeURIComponent(walletAddress.trim()), [walletAddress]);

  const fetchBackendState = useCallback(async () => {
    const wallet = walletAddress.trim();
    if (!wallet) {
      setError("Wallet address is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const btcAddress =
        walletAddress.trim().toLowerCase().startsWith("tb1") ||
        walletAddress.trim().toLowerCase().startsWith("bc1")
          ? walletAddress.trim()
          : wallet || "";
      const starknetAddress = intent.receiveWalletAddress.trim().startsWith("0x")
        ? intent.receiveWalletAddress.trim()
        : "";

      const [
        balances,
        strategies,
        trades,
        matches,
        logs,
        proof,
        attestation,
        chainState,
      ] = await Promise.all([
        requestJson<WalletBalances>(
          `/api/wallet/balances?walletAddress=${encodedWallet}&btcAddress=${encodeURIComponent(
            btcAddress,
          )}&starknetAddress=${encodeURIComponent(starknetAddress)}`,
        ),
        requestJson<StrategySummary[]>(`/api/otc/strategies?walletAddress=${encodedWallet}`),
        requestJson<TradeRecord[]>(`/api/otc/trades?walletAddress=${encodedWallet}`),
        requestJson<OtcMatchRecord[]>(`/api/otc/matches?walletAddress=${encodedWallet}`),
        requestJson<ExecutionLog[]>(`/api/otc/execution-logs?walletAddress=${encodedWallet}`),
        requestJson<ZKProof | null>(`/api/otc/proofs/latest?walletAddress=${encodedWallet}`),
        requestJson<TEEAttestation | null>(`/api/tee/attestations/latest?walletAddress=${encodedWallet}`),
        requestJson<ChainState>("/api/chain/state"),
      ]);

      setData({ balances, strategies, trades, matches, logs, proof, attestation, chainState });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load backend data.");
    } finally {
      setLoading(false);
    }
  }, [walletAddress, encodedWallet, intent.receiveWalletAddress]);

  // When we connect a BTC wallet, immediately fetch balances so the form
  // doesn't rely on any hardcoded default amounts.
  useEffect(() => {
    if (wallet?.connected && walletAddress.trim()) {
      void fetchBackendState();
    }
  }, [wallet?.connected, walletAddress, fetchBackendState]);

  // Auto-fill "send amount" (and deposit) from wallet balances, and compute the
  // corresponding oracle-verified "CRT receive amount" (priceThreshold).
  // User edits override these fields.
  useEffect(() => {
    const sendBalanceStr = intent.sendChain === "btc" ? data.balances.btcBalance : data.balances.strkBalance;
    const sendBalance = Number(sendBalanceStr);
    if (!Number.isFinite(sendBalance) || sendBalance <= 0) return;
    if (amountManuallyEdited) return;

    setIntent((prev) => {
      const formattedAmount = prev.sendChain === "btc" ? sendBalance.toFixed(4) : sendBalance.toFixed(2);
      const depositAmount = formattedAmount;

      let priceThreshold = prev.priceThreshold;
      if (!priceThresholdManuallyEdited && livePrices.btc > 0 && livePrices.strk > 0) {
        if (prev.sendChain === "btc") {
          // BTC -> STRK
          priceThreshold = ((Number(formattedAmount) * livePrices.btc) / livePrices.strk).toFixed(4);
        } else {
          // STRK -> BTC
          priceThreshold = ((Number(formattedAmount) * livePrices.strk) / livePrices.btc).toFixed(8);
        }
      }

      return { ...prev, amount: formattedAmount, depositAmount, priceThreshold };
    });
  }, [
    data.balances.btcBalance,
    data.balances.strkBalance,
    intent.sendChain,
    livePrices.btc,
    livePrices.strk,
    amountManuallyEdited,
    priceThresholdManuallyEdited,
  ]);

  const handleIntentSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      try {
        // Validate wallet connections based on chains
        if (intent.sendChain === 'btc' && !walletAddress) {
          setError("❌ Connect BTC wallet (Xverse or Unisat) to send BTC");
          setSubmitting(false);
          return;
        }
        
        if (intent.sendChain === 'strk' && !starknetAddress) {
          setError("❌ Connect Starknet wallet (ArgentX or Braavos) to send STRK");
          setSubmitting(false);
          return;
        }
        
        if (intent.receiveChain === 'strk' && !starknetAddress) {
          setError("❌ Connect Starknet wallet (ArgentX or Braavos) to receive STRK");
          setSubmitting(false);
          return;
        }
        
        if (intent.receiveChain === 'btc' && !walletAddress) {
          setError("❌ Connect BTC wallet to receive BTC");
          setSubmitting(false);
          return;
        }
        
        if (!intent.receiveWalletAddress) {
          setError(`❌ Receive wallet address is required`);
          setSubmitting(false);
          return;
        }

        const amountNum = Number(intent.amount);
        const priceThresholdNum = Number(intent.priceThreshold);
        const depositAmountNum = Number(intent.depositAmount);

        // Determine the correct sender wallet based on sendChain
        const senderWallet = intent.sendChain === 'btc' ? walletAddress : starknetAddress;

        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          setError("Enter a valid send amount (BTC/STRK) before submitting.");
          return;
        }
        if (!Number.isFinite(depositAmountNum) || depositAmountNum <= 0) {
          setError("Enter a valid deposit amount before submitting.");
          return;
        }

        // ============================================
        // STEP 1: Validate intent & get message to sign
        // ============================================
        setSuccess("Step 1: Validating intent with ZK proof...");
        
        const validateResponse = await requestJson<{ intentId: string; messageToSign: string; zkProof: unknown }>(
          "/api/otc/intents",
          {
            method: "POST",
            body: JSON.stringify({
              walletAddress: senderWallet,
              direction: intent.direction,
              templateId: intent.templateId,
              selectedPath: intent.selectedPath,
              amount: amountNum,
              priceThreshold: priceThresholdNum,
              splitCount: Number(intent.splitCount),
              depositAmount: depositAmountNum,
              depositConfirmed: intent.depositConfirmed,
              sendChain: intent.sendChain,
              receiveChain: intent.receiveChain,
              receiveWalletAddress: intent.receiveWalletAddress,
              step: "validate", // <- STEP 1
            }),
          }
        );

        const { intentId, messageToSign, match, hasMatch } = validateResponse;
        // messageToSign is an object with { message, intentId, sendAmount, receiveAmount, sendChain, receiveChain }
        let messageText = typeof messageToSign === 'string' ? messageToSign : (messageToSign as any)?.message || messageToSign;
        
        // Shorten message for wallet signing (Starknet has character limits)
        // Extract key info: intentId (first 10 chars), amount, chains
        const shortMessage = `OTC:${intentId.slice(0, 10)}`;
        console.log("[OTC-INTENT] Validation passed, signing with intent ID:", shortMessage);
        console.log("[OTC-INTENT] Match info:", { hasMatch, match });

        // ============================================
        // STEP 2: Request wallet signature
        // ============================================
        setSuccess("Step 2: Requesting wallet signature... (Check your wallet!)");
        
        let signature: string;
        let signatureStr: string; // Declare in outer scope
        try {
          // Request signature from appropriate wallet based on sendChain
          if (intent.sendChain === 'btc') {
            // ===== BTC SIGNING WITH XVERSE/UNISAT =====
            // Try multiple methods to access Bitcoin wallet
            let bitcoinProvider = (window as any).unisat || (window as any).xverse;
            
            // If not immediately available, try sats-connect as fallback
            if (!bitcoinProvider) {
              try {
                // Try using sats-connect library (same as useXverseWallet hook)
                const { request: satsRequest } = await import('sats-connect');
                
                console.log("[OTC-INTENT] Using sats-connect to sign message...");
                const response = await satsRequest('signMessage', {
                  address: walletAddress,
                  message: shortMessage,
                });
                
                console.log("[OTC-INTENT] sats-connect response:", response);
                
                // Handle sats-connect response
                const status = (response as any)?.status;
                const sig = (response as any)?.result?.signature || (response as any)?.signature;
                
                if (status === 'success' && sig) {
                  signature = sig;
                  signatureStr = typeof signature === 'string' ? signature : JSON.stringify(signature);
                  console.log("[OTC-INTENT] BTC Signature from sats-connect:", typeof signature);
                  setSuccess("Step 2: ✓ BTC Wallet Signature granted!");
                } else if (!sig && !status) {
                  // Try treating response as signature directly
                  if (typeof response === 'string' && response.length > 10) {
                    signature = response;
                    signatureStr = signature;
                    console.log("[OTC-INTENT] BTC Signature from sats-connect (direct):", typeof signature);
                    setSuccess("Step 2: ✓ BTC Wallet Signature granted!");
                  } else {
                    const msg = typeof response === 'string' ? response : JSON.stringify(response);
                    throw new Error(`sats-connect signing returned invalid response: ${msg}`);
                  }
                } else {
                  const msg = typeof response === 'string' ? response : JSON.stringify(response);
                  throw new Error(`sats-connect signing failed: ${msg}`);
                }
              } catch (satsError) {
                // sats-connect failed, fall back to direct provider access
                const satsMsg = satsError instanceof Error ? satsError.message : String(satsError);
                console.warn("[OTC-INTENT] sats-connect failed:", satsMsg);
                throw new Error(
                  `Bitcoin signing failed: ${satsMsg}\n\n` +
                  "Please ensure:\n" +
                  "1. Xverse or Unisat wallet extension is installed\n" +
                  "2. Wallet is open, unlocked, and visible in your browser toolbar\n" +
                  "3. You have approved the wallet connection\n" +
                  "4. Pop-up wasn't blocked by your browser"
                );
              }
            } else {
              // Bitcoin provider is available, use direct signMessage
              try {
                console.log("[OTC-INTENT] Using direct Bitcoin wallet provider to sign message...");
                signature = await bitcoinProvider.signMessage(shortMessage, "utf8");
                signatureStr = typeof signature === 'string' ? signature : JSON.stringify(signature);
                console.log("[OTC-INTENT] BTC Signature from Xverse/Unisat:", typeof signature);
                setSuccess("Step 2: ✓ BTC Wallet Signature granted!");
              } catch (providerError) {
                const providerMsg = providerError instanceof Error ? providerError.message : String(providerError);
                throw new Error(
                  `Bitcoin wallet signature failed: ${providerMsg}\n\n` +
                  "Please ensure your Bitcoin wallet is open, unlocked, and visible in your browser."
                );
              }
            }
            
          } else {
            // ===== STRK SIGNING WITH STARKNET WALLET =====
            console.log("[OTC-INTENT] Starting Starknet wallet signing...");
            const starknet = (window as any).starknet;
            console.log("[OTC-INTENT] Starknet wallet object:", { hasStarknet: !!starknet, hasAccount: !!starknet?.account, hasSignMessage: !!starknet?.account?.signMessage });
            
            if (!starknet) {
              throw new Error(
                "❌ Starknet wallet not detected in browser.\n\n" +
                "✓ Please install one of these extensions:\n" +
                "  • Argent X: https://chrome.google.com/webstore/detail/argent-x\n" +
                "  • Braavos: https://chrome.google.com/webstore/detail/braavos\n\n" +
                "Then refresh this page and try again."
              );
            }

            if (!starknet.account) {
              console.warn("[OTC-INTENT] Starknet wallet detected but not connected. Triggering connection...");
              try {
                await starknet.enable?.({ showModal: true });
              } catch (enableError) {
                throw new Error("Wallet connection was rejected. Please try again and approve the connection.");
              }
            }

            if (!starknet.account) {
              throw new Error(
                "Starknet wallet not connected. Please click 'Connect Wallet' first."
              );
            }

            // Sign the message with Starknet wallet (using short message to avoid length limits)
            console.log("[OTC-INTENT] Calling starknet.account.signMessage with message:", shortMessage);
            try {
              signature = await starknet.account.signMessage({
                types: {
                  StarkNetDomain: [
                    { name: "name", type: "shortstring" },
                    { name: "version", type: "shortstring" },
                    { name: "chainId", type: "shortstring" },
                  ],
                  Message: [{ name: "message", type: "string" }],
                },
                primaryType: "Message",
                domain: {
                  name: "ShadowFlow OTC",
                  version: "1",
                  chainId: "SN_SEPOLIA",
                },
                message: {
                  message: shortMessage, // Use shortened message (intent ID only)
                },
              });
              console.log("[OTC-INTENT] STRK Signature received:", typeof signature);
            } catch (signError) {
              console.error("[OTC-INTENT] signMessage failed:", signError);
              throw new Error(
                `Wallet signature rejected or failed: ${signError instanceof Error ? signError.message : String(signError)}\n\n` +
                "Please approve the signature request in your wallet popup."
              );
            }

            console.log("[OTC-INTENT] STRK Signature from Starknet:", typeof signature);
            signatureStr = typeof signature === 'string' ? signature : JSON.stringify(signature);
            setSuccess("Step 2: ✓ Starknet Wallet Signature granted!");
          }
        } catch (walletError) {
          const errorMsg = walletError instanceof Error ? walletError.message : String(walletError);
          
          // Check for chain mismatch error
          if (errorMsg.includes("different chainId") || errorMsg.includes("SN_MAIN")) {
            throw new Error(
              "⚠️ WALLET ON WRONG CHAIN!\n\n" +
              "Your Starknet wallet is on MAINNET, but we need SEPOLIA TESTNET.\n\n" +
              "✓ Fix: Open Argent X or Braavos → Settings → Network → Select 'Starknet Sepolia'\n\n" +
              "Then try again."
            );
          }
          
          if (errorMsg.includes("USER_REFUSED")) {
            throw new Error(
              "❌ Signature request denied.\n\n" +
              "You rejected the wallet signature popup.\n\n" +
              "✓ Please approve the signature request in your wallet to continue."
            );
          }
          
          throw new Error(
            `Wallet signature failed: ${errorMsg}\n\n` +
            `Make sure:\n` +
            `1. Your ${intent.sendChain === 'btc' ? 'Bitcoin' : 'Starknet'} wallet (${intent.sendChain === 'btc' ? 'Xverse or Unisat' : 'Argent X or Braavos'}) is installed\n` +
            (intent.sendChain === 'strk' ? `2. Wallet is on SEPOLIA testnet (not mainnet)\n` : ``) +
            `${intent.sendChain === 'strk' ? '3' : '2'}. Wallet is open and unlocked`
          );
        }

        // ============================================
        // STEP 3: Check if match found, if so navigate to swap-matching
        // ============================================
        console.log("[OTC-INTENT] After signing, checking match status:", { hasMatch, match });
        
        if (hasMatch && match) {
          // Match found! Navigate to swap-matching interface
          console.log("[OTC-INTENT] ✅ Match found during validation! Navigating to swap-matching...");
          setSuccess(
            `✅ Match found!\n` +
            `Your intent matched with another user.\n` +
            `Both parties must fund escrow to execute the swap.`
          );
          
          setTimeout(() => {
            const params = new URLSearchParams({
              matchId: match.matchId || `match_${intentId}`,
              intentId: intentId,
              sendAmount: String(intent.amount || ''),
              sendChain: intent.sendChain,
              receiveAmount: String(intent.priceThreshold || ''),
              receiveChain: intent.receiveChain,
              walletAddress: typeof wallet === 'string' ? wallet : wallet?.address || '',
              matchedWith: match.matchedWith || match.intentB || '',
              partyB: match.partyB || '',
            });
            console.log("[OTC-INTENT] Navigating to swap-matching with params:", params.toString());
            router.push(`/swap-matching?${params.toString()}`);
          }, 1000);
        } else {
          // No match yet, navigate to waiting page
          console.log("[OTC-INTENT] No match yet, navigating to waiting page...");
          setSuccess(
            `✓ Intent successfully signed!\n` +
            `Waiting for matching...\n` +
            `Your intent ID: ${intentId.slice(0, 10)}`
          );

          setTimeout(() => {
            const params = new URLSearchParams({
              intentId: intentId,
              sendAmount: String(intent.amount || ''),
              sendChain: intent.sendChain,
              receiveAmount: String(intent.priceThreshold || ''),
              receiveChain: intent.receiveChain,
              walletAddress: typeof wallet === 'string' ? wallet : wallet?.address || '',
            });
            router.push(`/otc-waiting?${params.toString()}`);
          }, 1000);
        }

        await fetchBackendState();
      } catch (submitError) {
        const errorMsg = submitError instanceof Error ? submitError.message : "Intent submission failed.";
        console.error("[OTC-INTENT] Error:", errorMsg);
        setError(errorMsg);
      } finally {
        setSubmitting(false);
      }
    },
    [walletAddress, intent, fetchBackendState, router],
  );

  const handleClearAllIntents = useCallback(async () => {
    setClearing(true);
    setError(null);
    setSuccess(null);

    try {
      await requestJson("/api/otc/intents?scope=all", { method: "DELETE" });
      setSuccess("Previous buyer/seller intents cleared. You can create a new intent now.");
      setData(defaultState);
      setIntent(defaultIntentState);
      setAmountManuallyEdited(false);
      setPriceThresholdManuallyEdited(false);
      if (walletAddress.trim()) {
        await fetchBackendState();
      }
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Failed to clear intents.");
    } finally {
      setClearing(false);
    }
  }, [walletAddress, fetchBackendState]);

  return (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-3xl font-bold">OTC Intent</h1>
          <p className="mt-2 text-sm text-[#555]">Submit buy/sell intents and monitor backend state in one place.</p>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="walletAddress" className="mb-2 block text-sm font-semibold">Wallet Address</label>
              {wallet?.connected ? (
                <div className="w-full rounded-xl border-2 border-green-600 bg-green-50 px-4 py-3 text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-600" />
                    {wallet.address.slice(0, 6)}...{wallet.address.slice(-6)}
                  </span>
                  <span className="text-xs text-green-700">{wallet.provider.toUpperCase()} connected</span>
                </div>
              ) : (
                <input
                  id="walletAddress"
                  value={walletAddress}
                  onChange={(event) => setWalletAddress(event.target.value)}
                  className="w-full rounded-xl border-2 border-black px-4 py-3 text-sm"
                  placeholder="bc1... or tb1... or connect BTC wallet"
                />
              )}
            </div>
            {!wallet?.connected && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={isConnecting || (!xverseAvailable && !unisatAvailable)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#FF8000] px-6 text-sm font-semibold text-white disabled:opacity-60 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="h-4 w-4" />
                  )}
                  Connect BTC Wallet
                </button>

                <button
                  type="button"
                  onClick={connectXverse}
                  disabled={isConnecting || !xverseAvailable}
                  className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-black bg-white px-4 text-sm font-semibold disabled:opacity-60"
                >
                  Xverse
                </button>

                <button
                  type="button"
                  onClick={connectUnisat}
                  disabled={isConnecting || !unisatAvailable}
                  className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-black bg-white px-4 text-sm font-semibold disabled:opacity-60"
                >
                  Unisat
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={fetchBackendState}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-black px-6 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>

            <button
              type="button"
              onClick={handleClearAllIntents}
              disabled={clearing}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-black bg-[#FFECEC] px-6 text-sm font-semibold text-[#8C2323] disabled:opacity-60"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Clear Previous Intents
            </button>
          </div>

          {/* Starknet Wallet Connection Section */}
          <div className="mt-4 rounded-2xl border-2 border-blue-500 bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase text-blue-900">⚡ Starknet Wallet</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!starknetConnected ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleStarknetConnect("argentx")}
                    disabled={starknetConnecting}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {starknetConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    ArgentX
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStarknetConnect("braavos")}
                    disabled={starknetConnecting}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                  >
                    {starknetConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Braavos
                  </button>
                </>
              ) : (
                <div className="w-full rounded-lg border-2 border-green-600 bg-green-50 px-4 py-3 text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-600" />
                    {starknetAddress?.slice(0, 6)}...{starknetAddress?.slice(-6)}
                  </span>
                  <span className="text-xs text-green-700">STARKNET CONNECTED</span>
                </div>
              )}
            </div>
            {starknetError && (
              <div className="mt-2 rounded-lg bg-red-100 p-2 text-xs text-red-700">
                {starknetError}
              </div>
            )}
          </div>

          {walletError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-[#D63B3B] bg-[#FFECEC] px-4 py-3 text-sm text-[#8C2323]">
              <XCircle className="h-4 w-4" />
              {walletError}
            </div>
          )}

          <div className="mt-4 rounded-2xl border-2 border-purple-500 bg-purple-50 p-4">
            <p className="text-xs font-bold uppercase text-purple-900">💡 Two-Wallet System</p>
            <div className="mt-2 space-y-2 text-xs text-purple-800">
              <p>
                <strong>Sender ({intent.sendChain.toUpperCase()}):</strong> {
                  intent.sendChain === 'btc' 
                    ? (walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-10)}` : "Connect BTC wallet")
                    : (starknetAddress ? `${starknetAddress.slice(0, 10)}...${starknetAddress.slice(-10)}` : "Connect Starknet wallet")
                }
              </p>
              <p>
                <strong>Receiver ({intent.receiveChain.toUpperCase()}):</strong> {intent.receiveWalletAddress ? `${intent.receiveWalletAddress.slice(0, 10)}...${intent.receiveWalletAddress.slice(-10)}` : "Will auto-fill"}
              </p>
              <p className="pt-2 text-purple-700">
                You will <strong>send {intent.amount || "?"} {intent.sendChain.toUpperCase()}</strong> and 
                <strong> receive {intent.priceThreshold || "?"} {intent.receiveChain.toUpperCase()}</strong>.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border-2 border-black bg-[#FFF3D9] p-3">
              <p className="text-xs font-semibold uppercase">You Send ({intent.sendChain.toUpperCase()})</p>
              <p className="mt-1 text-xl font-bold">
                {intent.sendChain === 'btc' ? data.balances.btcBalance : data.balances.strkBalance}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-black bg-[#E6F2FF] p-3">
              <p className="text-xs font-semibold uppercase">You Receive ({intent.receiveChain.toUpperCase()})</p>
              <p className="mt-1 text-xl font-bold">
                {intent.receiveChain === 'btc' ? data.balances.btcBalance : data.balances.strkBalance}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-black bg-[#FFE6EB] p-3">
              <p className="text-xs font-semibold uppercase">Merkle Root</p>
              <p className="mt-1 text-sm font-semibold">{shortHex(data.chainState.merkleRoot, 14, 12)}</p>
            </div>
            <div className="rounded-2xl border-2 border-black bg-[#E8FFE8] p-3">
              <p className="text-xs font-semibold uppercase">Spent Nullifiers</p>
              <p className="mt-1 text-xl font-bold">{data.chainState.spentNullifiers.length}</p>
            </div>
          </div>

          {error ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-[#D63B3B] bg-[#FFECEC] px-4 py-3 text-sm text-[#8C2323]">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-[#2F9E44] bg-[#ECFFF0] px-4 py-3 text-sm text-[#1E6B31]">
              <CheckCircle2 className="h-4 w-4" />
              {success}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleIntentSubmit} className="rounded-3xl border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold">Create Intent</h2>
            
            <div className="mt-4 rounded-xl border-2 border-blue-600 bg-blue-50 p-4 text-sm">
              <p className="font-semibold text-blue-900">📋 Signing with Starknet Wallet</p>
              <p className="mt-2 text-blue-800">
                When you click "Submit Intent", you'll be asked to sign with a <strong>Starknet wallet</strong> (Argent X or Braavos).
              </p>
              <p className="mt-2 text-xs text-blue-700">
                ✓ Make sure your Starknet wallet is on <strong>SEPOLIA TESTNET</strong> (not mainnet)
              </p>
            </div>
            
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-semibold">
                Direction
                <select
                  value={intent.direction}
                  onChange={(event) => setIntent((prev) => ({ ...prev, direction: event.target.value as "buy" | "sell" }))}
                  className="mt-1 w-full rounded-xl border-2 border-black px-3 py-2"
                >
                  <option value="buy">buy</option>
                  <option value="sell">sell</option>
                </select>
              </label>

              <label className="text-sm font-semibold">
                Template
                <select
                  value={intent.templateId}
                  onChange={(event) => setIntent((prev) => ({ ...prev, templateId: event.target.value as "simple" | "split" | "guarded" }))}
                  className="mt-1 w-full rounded-xl border-2 border-black px-3 py-2"
                >
                  <option value="simple">simple</option>
                  <option value="split">split</option>
                  <option value="guarded">guarded</option>
                </select>
              </label>

              <label className="text-sm font-semibold">
                Strategy Path
                <input
                  value={intent.selectedPath}
                  onChange={(event) => setIntent((prev) => ({ ...prev, selectedPath: event.target.value }))}
                  className="mt-1 w-full rounded-xl border-2 border-black px-3 py-2"
                />
              </label>

              <div className="rounded-2xl border-3 border-blue-400 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase text-blue-900">Cross-Chain Exchange</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-bold uppercase text-[#666]">
                      You Send
                      <select
                        value={intent.sendChain}
                        onChange={(event) => {
                          const newSend = event.target.value as "btc" | "strk";
                          setAmountManuallyEdited(false);
                          setPriceThresholdManuallyEdited(false);
                          setIntent((prev) => ({
                            ...prev,
                            sendChain: newSend,
                            receiveChain: newSend === prev.receiveChain ? (newSend === "btc" ? "strk" : "btc") : prev.receiveChain,
                          }));
                        }}
                        className="mt-1 w-full rounded-lg border-2 border-black bg-white px-2 py-1 text-sm font-bold"
                      >
                        <option value="btc">🔵 Bitcoin (BTC)</option>
                        <option value="strk">⚡ Starknet (STRK)</option>
                      </select>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-[#666]">
                      You Receive
                      <select
                        value={intent.receiveChain}
                        onChange={(event) => {
                          const newReceive = event.target.value as "btc" | "strk";
                          setAmountManuallyEdited(false);
                          setPriceThresholdManuallyEdited(false);
                          setIntent((prev) => ({
                            ...prev,
                            receiveChain: newReceive,
                            sendChain: newReceive === prev.sendChain ? (newReceive === "btc" ? "strk" : "btc") : prev.sendChain,
                          }));
                        }}
                        className="mt-1 w-full rounded-lg border-2 border-black bg-white px-2 py-1 text-sm font-bold"
                      >
                        <option value="btc">🔵 Bitcoin (BTC)</option>
                        <option value="strk">⚡ Starknet (STRK)</option>
                      </select>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-[#666]">
                      Receive Wallet
                      <input
                        type="text"
                        value={intent.receiveWalletAddress}
                        onChange={(event) => setIntent((prev) => ({ ...prev, receiveWalletAddress: event.target.value }))}
                        placeholder={intent.receiveChain === "btc" ? "bc1q..." : "0x..."}
                        className="mt-1 w-full rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-mono"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border-3 border-green-400 bg-green-50 p-4">
                <p className="text-xs font-bold uppercase text-green-900">Amount & Price</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase text-[#666]">
                      How much {intent.sendChain === "btc" ? "🔵 BTC" : "⚡ STRK"} will you send?
                      <div className="mt-1 flex items-center gap-2 rounded-lg border-2 border-black bg-white">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={intent.amount}
                          onChange={(event) => {
                            const val = event.target.value;
                            setAmountManuallyEdited(true);
                            setPriceThresholdManuallyEdited(false);
                            setIntent((prev) => {
                              const updated = { ...prev, amount: val, depositAmount: val };
                              if (livePrices.btc > 0 && livePrices.strk > 0) {
                                const num = parseFloat(val) || 0;
                                if (prev.sendChain === "btc") {
                                  updated.priceThreshold = ((num * livePrices.btc) / livePrices.strk).toFixed(4);
                                } else {
                                  updated.priceThreshold = ((num * livePrices.strk) / livePrices.btc).toFixed(8);
                                }
                              }
                              return updated;
                            });
                          }}
                          className="flex-1 border-0 bg-transparent px-3 py-2 text-sm font-bold outline-none"
                        />
                        <span className="px-2 text-xs font-bold uppercase">{intent.sendChain}</span>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-[#666]">
                      How much {intent.receiveChain === "btc" ? "🔵 BTC" : "⚡ STRK"} do you want?
                      <div className="mt-1 flex items-center gap-2 rounded-lg border-2 border-black bg-white">
                        <input
                          type="number"
                          min="0"
                          step={intent.receiveChain === "btc" ? "0.0001" : "0.01"}
                          value={intent.priceThreshold}
                          onChange={(event) => {
                            setPriceThresholdManuallyEdited(true);
                            setIntent((prev) => ({ ...prev, priceThreshold: event.target.value }));
                          }}
                          className="flex-1 border-0 bg-transparent px-3 py-2 text-sm font-bold outline-none"
                        />
                        <span className="px-2 text-xs font-bold uppercase">{intent.receiveChain}</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Split Count
                  <input
                    type="number"
                    min="1"
                    value={intent.splitCount}
                    onChange={(event) => setIntent((prev) => ({ ...prev, splitCount: event.target.value }))}
                    className="mt-1 w-full rounded-xl border-2 border-black px-3 py-2"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Deposit Amount
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={intent.depositAmount}
                    onChange={(event) => setIntent((prev) => ({ ...prev, depositAmount: event.target.value }))}
                    className="mt-1 w-full rounded-xl border-2 border-black px-3 py-2"
                  />
                </label>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={intent.depositConfirmed}
                  onChange={(event) => setIntent((prev) => ({ ...prev, depositConfirmed: event.target.checked }))}
                  className="h-4 w-4"
                />
                Deposit Confirmed
              </label>

              <button
                type="submit"
                disabled={submitting || !intent.receiveWalletAddress.trim()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#FF4A60] px-6 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Submit Intent
              </button>
            </div>
          </form>

          <div className="rounded-3xl border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold">Latest Proof & TEE</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl border-2 border-black p-3">
                <p className="text-xs font-semibold uppercase">Proof Hash</p>
                <p className="mt-1 break-all font-semibold">{data.proof ? shortHex(data.proof.proofHash, 16, 12) : "No proof yet"}</p>
                <p className="mt-1 text-xs text-[#666]">Verified: {data.proof?.verified ? "yes" : "no"}</p>
              </div>

              <div className="rounded-xl border-2 border-black p-3">
                <p className="text-xs font-semibold uppercase">TEE</p>
                <p className="mt-1 font-semibold">
                  {data.attestation ? `${data.attestation.enclaveType} / ${data.attestation.valid ? "valid" : "invalid"}` : "No attestation yet"}
                </p>
                <p className="mt-1 break-all text-xs text-[#666]">
                  {data.attestation ? shortHex(data.attestation.measurementHash, 16, 12) : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
