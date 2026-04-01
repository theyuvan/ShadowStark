"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, ArrowRight, AlertCircle } from "lucide-react";

interface MatchDetails {
  matchId: string;
  partyA: {
    wallet: string;
    sendAmount: string;
    sendChain: "btc" | "strk";
    receiveAmount: string;
    receiveChain: "btc" | "strk";
    signed: boolean;
    fundedToEscrow: boolean;
  };
  partyB: {
    wallet: string;
    sendAmount: string;
    sendChain: "btc" | "strk";
    receiveAmount: string;
    receiveChain: "btc" | "strk";
    signed: boolean;
    fundedToEscrow: boolean;
  };
  status: "pending" | "both_approved" | "escrow_funding" | "escrow_funded" | "executing" | "executed";
  escrowAddress?: string;
  transactionHash?: string;
}

interface SwapMatchingInterfaceProps {
  intentId: string;
  matchId: string;
  walletAddress: string;
  sendChain: "btc" | "strk";
  receiveChain: "btc" | "strk";
  initialIntent: {
    direction: "buy" | "sell";
    amount: string;
    priceThreshold: string;
  };
}

export function SwapMatchingInterface({
  intentId,
  matchId,
  walletAddress,
  sendChain,
  receiveChain,
  initialIntent,
}: SwapMatchingInterfaceProps) {
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [fundingToEscrow, setFundingToEscrow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<"waiting" | "signed" | "escrow_funding" | "escrow_funded" | "executing" | "executed">(
    "waiting"
  );
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [showTransactionHashScreen, setShowTransactionHashScreen] = useState(false);
  const [hashCountdown, setHashCountdown] = useState<number | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // Fetch match details from API
  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const response = await fetch(
          `/api/otc/matches?matchId=${matchId}&walletAddress=${encodeURIComponent(walletAddress)}`
        );
        const data = await response.json();

        // Handle new API response format (type: "match_detail")
        let m: MatchDetails | null = null;
        
        if (data.type === "match_detail") {
          m = data as MatchDetails;
        } else if (data.matches && data.matches.length > 0) {
          m = data.matches[0];
        }

        if (m) {
          setMatch(m);

          // Determine current step based on match status
          if (m.status === "executed") {
            setStep("executed");
          } else if (m.status === "executing") {
            setStep("executing");
          } else if (m.status === "escrow_funded") {
            setStep("escrow_funded");
          } else if (m.partyA.signed && m.partyB.signed) {
            setStep("escrow_funding");
          } else if (m.partyA.signed || m.partyB.signed) {
            setStep("signed");
          }
        } else {
          setError("Match not found");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch match";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    if (matchId && walletAddress) {
      fetchMatch();
      // Poll for updates every 2 seconds
      const interval = setInterval(fetchMatch, 2000);
      return () => clearInterval(interval);
    }
  }, [matchId, walletAddress]);

  // Sequential display: Hash → Success → Redirect
  useEffect(() => {
    if (match && match.status === "executed") {
      // Phase 1: Show transaction hash for 10 seconds
      setShowTransactionHashScreen(true);
      let hashCountdownValue = 10;
      setHashCountdown(hashCountdownValue);

      const hashInterval = setInterval(() => {
        hashCountdownValue -= 1;
        setHashCountdown(hashCountdownValue);

        if (hashCountdownValue <= 0) {
          clearInterval(hashInterval);
          // Phase 2: Show success screen
          setShowTransactionHashScreen(false);
          setShowSuccessScreen(true);

          let successCountdownValue = 10;
          setRedirectCountdown(successCountdownValue);

          const successInterval = setInterval(() => {
            successCountdownValue -= 1;
            setRedirectCountdown(successCountdownValue);

            if (successCountdownValue <= 0) {
              clearInterval(successInterval);
              // Phase 3: Redirect to OTC intent page
              router.push(`/otc-intent?matchId=${matchId}`);
            }
          }, 1000);

          return () => clearInterval(successInterval);
        }
      }, 1000);

      return () => clearInterval(hashInterval);
    }
  }, [match?.status, matchId, router]);

  const isPartyA = walletAddress === match?.partyA.wallet;
  const currentParty = isPartyA ? match?.partyA : match?.partyB;
  const otherParty = isPartyA ? match?.partyB : match?.partyA;

  const handleSignMatch = async () => {
    if (!match || !currentParty) return;

    setSigning(true);
    setError(null);
    setSuccess(null);

    try {
      // Request signature from appropriate wallet based on sendChain
      let signature: string;
      
      if (currentParty.sendChain === "btc") {
        // ===== BTC SIGNING WITH XVERSE/UNISAT =====
        let bitcoinProvider = (window as any).unisat || (window as any).xverse;
        
        if (!bitcoinProvider) {
          // Try sats-connect as fallback
          try {
            const { request: satsRequest } = await import('sats-connect');
            
            console.log("[SWAP-MATCH] Using sats-connect for BTC signature...");
            const messageToSign = `MATCH:${matchId.slice(0, 10)}`;
            const responseRaw = await satsRequest('signMessage', {
              address: walletAddress,
              message: messageToSign,
            });
            const response: any = responseRaw;
            
            console.log("[SWAP-MATCH] sats-connect response:", response);
            
            const status = (response as any)?.status;
            const sig = (response as any)?.result?.signature || (response as any)?.signature;
            
            if (status === 'success' && sig) {
              signature = sig;
              console.log("[SWAP-MATCH] BTC signature from sats-connect:", typeof signature);
            } else if (!sig && !status) {
              // Try treating response as signature directly
              const directSig = String(response ?? "");
              if (directSig.length > 10 && !directSig.startsWith("{")) {
                signature = directSig;
                console.log("[SWAP-MATCH] BTC signature from sats-connect (direct):", typeof signature);
              } else {
                const msg = JSON.stringify(response);
                throw new Error(`sats-connect signing returned invalid response: ${msg}`);
              }
            } else {
              const msg = JSON.stringify(response);
              throw new Error(`sats-connect signing failed: ${msg}`);
            }
          } catch (satsError) {
            const satsMsg = satsError instanceof Error ? satsError.message : String(satsError);
            console.error("[SWAP-MATCH] sats-connect error:", satsMsg);
            throw new Error(
              `Bitcoin signing failed: ${satsMsg}\n\nPlease ensure Xverse or Unisat is installed, unlocked, and visible.`
            );
          }
        } else {
          // Use direct provider
          console.log("[SWAP-MATCH] Using direct Bitcoin wallet provider for signature...");
          const messageToSign = `MATCH:${matchId.slice(0, 10)}`;
          try {
            signature = await bitcoinProvider.signMessage(messageToSign, "utf8");
            console.log("[SWAP-MATCH] BTC signature from Xverse/Unisat:", typeof signature);
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
        const starknet = (window as any).starknet;
        if (!starknet || !starknet.account) {
          throw new Error("Starknet wallet not connected. Please open Argent X or Braavos.");
        }

        const shortMessage = `MATCH:${matchId.slice(0, 10)}`;
        console.log("[SWAP-MATCH] Using Starknet wallet for signature...");
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
            message: shortMessage,
          },
        });
        
        console.log("[SWAP-MATCH] STRK signature from Starknet:", typeof signature);
      }

      const signatureStr = typeof signature === "string" ? signature : JSON.stringify(signature);

      // Submit signature to backend
      const response = await fetch("/api/otc/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId,
          signature: signatureStr,
          walletAddress,
          sendChain: currentParty.sendChain,
          step: "execute",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit signature");
      }

      setSuccess(`✓ Your ${currentParty.sendChain.toUpperCase()} wallet signature recorded!`);
      setStep("signed");

      // Refetch match status
      setTimeout(async () => {
        const res = await fetch(
          `/api/otc/matches?matchId=${matchId}&walletAddress=${encodeURIComponent(walletAddress)}`
        );
        const data = await res.json();
        if (data.matches && data.matches.length > 0) {
          setMatch(data.matches[0]);
        }
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sign match";
      setError(msg);
      console.error("[SWAP-MATCH] Signing error:", err);
    } finally {
      setSigning(false);
    }
  };

  const handleFundToEscrow = async () => {
    if (!match || !currentParty) return;

    setFundingToEscrow(true);
    setError(null);
    setSuccess(null);

    try {
      // Get signature from wallet based on chain type
      let signature = "";

      if (currentParty.sendChain === "btc") {
        // ===== BTC SIGNING WITH XVERSE/UNISAT =====
        let bitcoinProvider = (window as any).unisat || (window as any).xverse;
        
        if (!bitcoinProvider) {
          // Try sats-connect as fallback
          try {
            const { request: satsRequest } = await import('sats-connect');
            
            console.log("[ESCROW-FUND] Using sats-connect for BTC signature...");
            const messageToSign = `ESCROW:${matchId}:btc`;
            const responseRaw = await satsRequest('signMessage', {
              address: walletAddress,
              message: messageToSign,
            });
            const response: any = responseRaw;
            
            console.log("[ESCROW-FUND] sats-connect response:", response);
            
            const status = (response as any)?.status;
            const sig = (response as any)?.result?.signature || (response as any)?.signature;
            
            if (status === 'success' && sig) {
              signature = sig;
              console.log("[ESCROW-FUND] BTC signature from sats-connect:", typeof signature);
            } else if (!sig && !status) {
              // Try treating response as signature directly
              const directSig = String(response ?? "");
              if (directSig.length > 10 && !directSig.startsWith("{")) {
                signature = directSig;
                console.log("[ESCROW-FUND] BTC signature from sats-connect (direct):", typeof signature);
              } else {
                const msg = JSON.stringify(response);
                throw new Error(`sats-connect signing returned invalid response: ${msg}`);
              }
            } else {
              const msg = JSON.stringify(response);
              throw new Error(`sats-connect signing failed: ${msg}`);
            }
          } catch (satsError) {
            const satsMsg = satsError instanceof Error ? satsError.message : String(satsError);
            console.error("[ESCROW-FUND] sats-connect error:", satsMsg);
            throw new Error(
              `Bitcoin signing failed: ${satsMsg}\n\nPlease ensure Xverse or Unisat is installed, unlocked, and visible.`
            );
          }
        } else {
          // Use direct provider
          console.log("[ESCROW-FUND] Using direct Bitcoin wallet provider for signature...");
          const messageToSign = `ESCROW:${matchId}:btc`;
          try {
            signature = await bitcoinProvider.signMessage(messageToSign, "utf8");
            console.log("[ESCROW-FUND] BTC signature from Xverse/Unisat:", typeof signature);
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
        const starknet = (window as any).starknet;
        if (!starknet || !starknet.account) {
          throw new Error("Starknet wallet not connected. Please open Argent X or Braavos.");
        }

        const messageToSign = `ESCROW:${matchId}:strk`;
        console.log("[ESCROW-FUND] Using Starknet wallet for signature...");
        const messageHash = await starknet.account.signMessage({
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
            name: "ShadowFlow OTC Escrow",
            version: "1",
            chainId: "SN_SEPOLIA",
          },
          message: {
            message: messageToSign,
          },
        });

        signature = typeof messageHash === "string" ? messageHash : JSON.stringify(messageHash);
        console.log("[ESCROW-FUND] STRK signature from Starknet:", typeof signature);
      }

      // Call escrow funding endpoint
      const fundResponse = await fetch("/api/otc/escrow/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId,
          matchId,
          walletAddress: currentParty.wallet,
          signature,
          fundAmount: currentParty.sendAmount,
          sendChain: currentParty.sendChain,
        }),
      });

      if (!fundResponse.ok) {
        const errorData = await fundResponse.json();
        throw new Error(errorData.error || "Failed to fund escrow");
      }

      const fundData = await fundResponse.json();

      if (!fundData.success) {
        throw new Error(fundData.error || "Failed to fund escrow");
      }

      const fundingTxHash = fundData.fundingTxHash || fundData.escrowTxHash || fundData.transactionHash || "";
      const swapExecuted = Boolean(fundData.swapExecuted || fundData.executed || fundData.matchStatus === "executed");
      const swapInProgress = Boolean(
        fundData.swapInProgress ||
          fundData.matchStatus === "executing" ||
          (!swapExecuted && fundData.fundingComplete)
      );

      setSuccess(
        `✓ Your funds (${currentParty.sendAmount} ${currentParty.sendChain.toUpperCase()}) sent to escrow!\n` +
        (fundingTxHash ? `Escrow TX: ${fundingTxHash.slice(0, 16)}...\n` : "") +
        (swapExecuted
          ? "Atomic swap executed successfully."
          : swapInProgress
            ? "Atomic swap executing..."
            : "Waiting for other party to fund...")
      );

      // Check if swap auto-executed
      if (swapExecuted) {
        setStep("executed");
      } else if (swapInProgress) {
        setStep("executing");
      } else {
        setStep("escrow_funding");
      }

      // Refetch match status
      setTimeout(async () => {
        const res = await fetch(
          `/api/otc/matches?matchId=${matchId}&walletAddress=${encodeURIComponent(walletAddress)}`
        );
        const data = await res.json();
        if (data.type === "match_detail") {
          setMatch(data);
        } else if (data.matches && data.matches.length > 0) {
          setMatch(data.matches[0]);
        }
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fund escrow";
      setError(msg);
      console.error("[ESCROW-FUND] Error:", err);
    } finally {
      setFundingToEscrow(false);
    }
  };

  if (loading) {
    return (
      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-lg font-semibold">Loading match details...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!match) {
    return (
      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-center text-red-600">{error || "Match not found"}</p>
        </div>
      </section>
    );
  }

  const bothSigned = match.partyA.signed && match.partyB.signed;
  const bothFunded = match.partyA.fundedToEscrow && match.partyB.fundedToEscrow;

  return (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        {/* Status Banner for Executing/Executed States */}
        {(match?.status === "executing" || match?.status === "executed") && (
          <div className={`mb-6 rounded-xl border-2 px-6 py-4 ${
            match.status === "executed"
              ? "border-green-400 bg-gradient-to-r from-green-100 to-green-50"
              : "border-blue-400 bg-gradient-to-r from-blue-100 to-blue-50 animate-pulse"
          }`}>
            <div className="flex items-center gap-3">
              {match.status === "executing" ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              <div>
                <p className={`font-bold text-lg ${
                  match.status === "executed"
                    ? "text-green-900"
                    : "text-blue-900"
                }`}>
                  {match.status === "executed"
                    ? "✅ Atomic Swap Successfully Completed!"
                    : "⏳ Processing Atomic Swap..."}
                </p>
                <p className={`text-sm ${
                  match.status === "executed"
                    ? "text-green-800"
                    : "text-blue-800"
                }`}>
                  {match.status === "executed"
                    ? "Your tokens have been exchanged and confirmed on-chain."
                    : "Both escrows are funded. The atomic swap is executing..."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          {/* Status Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Peer-to-Peer Atomic Swap</h1>
            <p className="text-sm text-gray-600">Match ID: {matchId.slice(0, 16)}...</p>
          </div>

          {/* Progress Timeline */}
          <div className="mb-8 space-y-4">
            {/* Step 1: Signatures */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${
                    bothSigned ? "bg-green-600" : "bg-blue-600"
                  }`}
                >
                  1
                </div>
                <div className={`h-12 w-0.5 ${bothSigned ? "bg-green-600" : "bg-gray-300"}`} />
              </div>
              <div className="pb-6">
                <p className={`font-semibold ${bothSigned ? "text-green-900" : "text-blue-900"}`}>
                  {bothSigned ? "✓ Both Signed" : "⏳ Waiting for Signatures"}
                </p>
                <p className="text-sm text-gray-600">Both parties authorize the swap</p>
              </div>
            </div>

            {/* Step 2: Escrow Funding */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${
                    bothFunded ? "bg-green-600" : bothSigned ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  2
                </div>
                <div
                  className={`h-12 w-0.5 ${
                    bothFunded ? "bg-green-600" : bothSigned ? "bg-blue-300" : "bg-gray-300"
                  }`}
                />
              </div>
              <div className="pb-6">
                <p
                  className={`font-semibold ${
                    bothFunded ? "text-green-900" : bothSigned ? "text-blue-900" : "text-gray-600"
                  }`}
                >
                  {bothFunded ? "✓ Funds in Escrow" : bothSigned ? "⏳ Funding Escrow" : "○ Funding Escrow"}
                </p>
                <p className="text-sm text-gray-600">Both amounts locked in escrow contract</p>
              </div>
            </div>

            {/* Step 3: Execute Swap */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${
                    match.status === "executed"
                      ? "bg-green-600"
                      : bothFunded
                        ? "bg-blue-600"
                        : "bg-gray-300"
                  }`}
                >
                  3
                </div>
              </div>
              <div>
                <p
                  className={`font-semibold ${
                    match.status === "executed"
                      ? "text-green-900"
                      : bothFunded
                        ? "text-blue-900"
                        : "text-gray-600"
                  }`}
                >
                  {match.status === "executed"
                    ? "✓ Swap Executed"
                    : bothFunded
                      ? "⏳ Executing Swap"
                      : "○ Execute Swap"}
                </p>
                <p className="text-sm text-gray-600">Atomic exchange of funds</p>
              </div>
            </div>
          </div>

          {/* Match Details */}
          <div className="mb-8 rounded-2xl border-2 border-black bg-gray-50 p-6">
            <p className="mb-4 text-xs font-semibold uppercase text-gray-700">Swap Terms</p>

            {/* Party A */}
            <div className="mb-6">
              <p className="mb-2 text-xs font-semibold text-gray-600">
                {isPartyA ? "🔵 YOUR OFFER" : "🟡 PARTY A"}
              </p>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold">{match.partyA.sendAmount}</p>
                  <p className="text-xs text-gray-600">{match.partyA.sendChain.toUpperCase()}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-400" />
                <div className="text-center">
                  <p className="text-2xl font-bold">{match.partyA.receiveAmount}</p>
                  <p className="text-xs text-gray-600">{match.partyA.receiveChain.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-600">
                  {match.partyA.wallet.slice(0, 10)}...{match.partyA.wallet.slice(-8)}
                </p>
                <span className="ml-auto text-xs">
                  {match.partyA.signed ? (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="h-4 w-4" /> Signed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-orange-700">
                      <Clock className="h-4 w-4" /> Waiting...
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="border-t-2 border-black" />

            {/* Party B */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold text-gray-600">
                {!isPartyA ? "🔵 YOUR OFFER" : "🟡 PARTY B"}
              </p>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold">{match.partyB.sendAmount}</p>
                  <p className="text-xs text-gray-600">{match.partyB.sendChain.toUpperCase()}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-400" />
                <div className="text-center">
                  <p className="text-2xl font-bold">{match.partyB.receiveAmount}</p>
                  <p className="text-xs text-gray-600">{match.partyB.receiveChain.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-600">
                  {match.partyB.wallet.slice(0, 10)}...{match.partyB.wallet.slice(-8)}
                </p>
                <span className="ml-auto text-xs">
                  {match.partyB.signed ? (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="h-4 w-4" /> Signed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-orange-700">
                      <Clock className="h-4 w-4" /> Waiting...
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-100 p-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <div>{success}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {showTransactionHashScreen ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-blue-100 px-6 py-8 text-center border-4 border-blue-500 animate-pulse">
                  <p className="text-sm font-bold text-blue-900 mb-4">Processing Transaction...</p>
                  <div className="bg-white rounded-lg p-6 mb-4 font-mono text-xs">
                    <p className="text-gray-600 mb-2">Transaction Hash:</p>
                    <p className="text-blue-700 font-bold break-all">{match?.transactionHash || 'Generating...'}</p>
                  </div>
                  <p className="text-lg font-bold text-blue-900">
                    {hashCountdown}s
                  </p>
                  <p className="text-xs text-blue-800 mt-2">Confirming on-chain...</p>
                </div>
              </div>
            ) : match.status === "executed" ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-gradient-to-r from-green-100 to-green-50 px-6 py-6 text-center border-2 border-green-400">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-bold text-lg text-green-900">Atomic Swap Completed Successfully!</p>
                  <p className="text-sm text-green-800 mt-2 mb-4">Your tokens have been exchanged and confirmed on-chain.</p>
                  
                  {/* Transaction Details */}
                  <div className="mt-4 bg-white rounded-lg p-4 text-left space-y-3">
                    <div className="border-b border-green-200 pb-3">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Transaction Hash</p>
                      <p className="text-xs text-gray-700 font-mono mt-1 break-all">{match.transactionHash || 'Processing...'}</p>
                    </div>
                    
                    <div className="border-b border-green-200 pb-3">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">You Sent</p>
                      <p className="text-sm font-bold text-gray-900 mt-1">{currentParty?.sendAmount} {currentParty?.sendChain.toUpperCase()}</p>
                    </div>
                    
                    <div className="border-b border-green-200 pb-3">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">You Received</p>
                      <p className="text-sm font-bold text-gray-900 mt-1">{currentParty?.receiveAmount} {currentParty?.receiveChain.toUpperCase()}</p>
                    </div>
                    
                    {otherParty && (
                      <div>
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Other Party</p>
                        <p className="text-xs text-gray-600 mt-1 break-all">{otherParty.wallet}</p>
                        <p className="text-xs text-gray-600 mt-1">Sent: {otherParty.sendAmount} {otherParty.sendChain.toUpperCase()}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <p className="text-xs text-blue-900">
                    <span className="font-semibold">✨ What's Next?</span><br />
                    Your tokens are now in your wallet. You can close this window or create another swap.
                  </p>
                </div>
              </div>
            ) : bothFunded ? (
              <div className="space-y-4">
                {/* Success Screen with Details */}
                <div className="rounded-xl bg-gradient-to-r from-green-100 to-green-50 px-6 py-8 text-center border-3 border-green-500">
                  <div className="text-4xl mb-3 animate-bounce">✅</div>
                  <p className="font-bold text-2xl text-green-900 mb-1">Atomic Swap Successful!</p>
                  <p className="text-green-800 mb-6">Both parties have funded the escrow contract</p>
                  
                  {/* Transaction Details Box */}
                  <div className="bg-white rounded-xl p-6 text-left space-y-4 mb-6 border-2 border-green-200">
                    <div className="border-b border-green-200 pb-4">
                      <p className="text-xs font-bold text-green-700 uppercase tracking-widest">Transaction Hash</p>
                      <p className="text-sm text-gray-800 font-mono mt-2 break-all bg-gray-50 p-3 rounded">
                        {match.transactionHash || `0x${Array(62).fill('0').join('')}`}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-r border-green-200 pr-4">
                        <p className="text-xs font-bold text-green-700 uppercase tracking-widest">You Sent</p>
                        <p className="text-lg font-bold text-gray-900 mt-2">{currentParty?.sendAmount}</p>
                        <p className="text-sm text-green-700">{currentParty?.sendChain.toUpperCase()}</p>
                      </div>
                      
                      <div className="pl-4">
                        <p className="text-xs font-bold text-green-700 uppercase tracking-widest">You Received</p>
                        <p className="text-lg font-bold text-gray-900 mt-2">{currentParty?.receiveAmount}</p>
                        <p className="text-sm text-green-700">{currentParty?.receiveChain.toUpperCase()}</p>
                      </div>
                    </div>
                    
                    {otherParty && (
                      <div className="border-t border-green-200 pt-4 mt-4">
                        <p className="text-xs font-bold text-green-700 uppercase tracking-widest">Counterparty</p>
                        <p className="text-xs text-gray-600 mt-2 break-all">{otherParty.wallet}</p>
                        <p className="text-sm text-gray-700 mt-3">
                          Sent <span className="font-bold">{otherParty.sendAmount} {otherParty.sendChain.toUpperCase()}</span> to escrow
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Redirect Info */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-300">
                    <p className="text-sm text-green-900">
                      <span className="font-semibold">🎉 Returning to Order Book</span>
                      {redirectCountdown !== null && (
                        <span className="block mt-2 text-green-700">
                          in <span className="font-bold text-lg">{redirectCountdown}</span> seconds
                        </span>
                      )}
                    </p>
                  </div>
                  
                  {/* Back Button */}
                  <button
                    onClick={() => router.push(`/otc-intent?matchId=${matchId}`)}
                    className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                  >
                    Return to OTC Trading
                  </button>
                </div>
              </div>
            ) : currentParty?.fundedToEscrow && !bothFunded ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-100 px-6 py-6 text-center border-2 border-green-400">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="font-bold text-lg text-green-900">Your Escrow Funded Successfully!</p>
                  <p className="text-sm text-green-800 mt-2">
                    You've locked {currentParty?.sendAmount} {currentParty?.sendChain.toUpperCase()} in escrow
                  </p>
                </div>
                
                <div className="rounded-lg bg-yellow-50 border-2 border-yellow-300 p-4">
                  <p className="text-sm text-yellow-900">
                    <span className="font-semibold">⏳ Waiting for counter-party</span><br />
                    {otherParty?.wallet.slice(0, 10)}... needs to fund their {otherParty?.sendAmount} {otherParty?.sendChain.toUpperCase()} escrow to proceed.
                  </p>
                </div>
              </div>
            ) : bothSigned && !currentParty?.fundedToEscrow ? (
              <button
                onClick={handleFundToEscrow}
                disabled={fundingToEscrow}
                className="w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {fundingToEscrow ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Funding Escrow...
                  </span>
                ) : (
                  `✓ Fund Escrow with ${currentParty?.sendAmount} ${currentParty?.sendChain.toUpperCase()}`
                )}
              </button>
            ) : !currentParty?.signed ? (
              <button
                onClick={handleSignMatch}
                disabled={signing}
                className="w-full rounded-xl bg-blue-600 px-6 py-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {signing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing...
                  </span>
                ) : (
                  "✓ Sign This Match"
                )}
              </button>
            ) : (
              <div className="rounded-xl bg-green-100 px-6 py-4 text-center">
                <p className="font-semibold text-green-900">✓ You've Signed!</p>
                <p className="text-xs text-green-800 mt-1">
                  Waiting for {otherParty?.wallet.slice(0, 10)}... to sign
                </p>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 rounded-lg bg-blue-50 p-4">
            <p className="text-xs text-blue-900">
              <span className="font-semibold">💡 Flow:</span> Sign → Both sign → Fund escrow → Both fund → Atomic
              swap executes
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
