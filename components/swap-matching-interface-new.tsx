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

  // Fetch match details from API
  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const response = await fetch(
          `/api/otc/matches?matchId=${matchId}&walletAddress=${encodeURIComponent(walletAddress)}`
        );
        const data = await response.json();

        if (data.matches && data.matches.length > 0) {
          const m = data.matches[0];
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
            const response = await satsRequest('signMessage', {
              address: walletAddress,
              message: messageToSign,
            });
            
            const status = (response as { status?: string }).status;
            if (status === 'success' && (response as any).result?.signature) {
              signature = (response as any).result.signature;
              console.log("[SWAP-MATCH] BTC signature from sats-connect:", typeof signature);
            } else {
              throw new Error("sats-connect signing failed");
            }
          } catch (satsError) {
            throw new Error(
              "Bitcoin wallet not connected. Please ensure Xverse or Unisat is installed, unlocked, and visible in your browser toolbar."
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
            const messageToSign = `OTC_ESCROW_FUND:${intentId}:${matchId}:${currentParty.sendAmount}:btc`;
            const response = await satsRequest('signMessage', {
              address: walletAddress,
              message: messageToSign,
            });
            
            const status = (response as { status?: string }).status;
            if (status === 'success' && (response as any).result?.signature) {
              signature = (response as any).result.signature;
              console.log("[ESCROW-FUND] BTC signature from sats-connect:", typeof signature);
            } else {
              throw new Error("sats-connect signing failed");
            }
          } catch (satsError) {
            throw new Error(
              "Bitcoin wallet not connected. Please ensure Xverse or Unisat is installed, unlocked, and visible in your browser toolbar."
            );
          }
        } else {
          // Use direct provider
          console.log("[ESCROW-FUND] Using direct Bitcoin wallet provider for signature...");
          const messageToSign = `OTC_ESCROW_FUND:${intentId}:${matchId}:${currentParty.sendAmount}:btc`;
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

        const messageToSign = `OTC_ESCROW_FUND:${intentId}:${matchId}:${currentParty.sendAmount}:strk`;
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

      setSuccess(
        `✓ Your funds (${currentParty.sendAmount} ${currentParty.sendChain.toUpperCase()}) sent to escrow!\n` +
        `Escrow TX: ${fundData.fundingTxHash.slice(0, 16)}...\n` +
        (fundData.swapInProgress
          ? "Atomic swap executing..."
          : "Waiting for other party to fund...")
      );

      // Check if swap auto-executed
      if (fundData.swapInProgress) {
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
        if (data.matches && data.matches.length > 0) {
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
            {match.status === "executed" ? (
              <div className="rounded-xl bg-green-100 px-6 py-4 text-center">
                <p className="font-bold text-green-900">✓ Swap Executed Successfully!</p>
                <p className="text-xs text-green-800 mt-1">
                  Transaction: {match.transactionHash?.slice(0, 16)}...
                </p>
              </div>
            ) : bothFunded ? (
              <div className="rounded-xl bg-blue-100 px-6 py-4 text-center animate-pulse">
                <p className="font-bold text-blue-900">⏳ Executing Atomic Swap...</p>
                <p className="text-xs text-blue-800 mt-1">Both funds in escrow, processing exchange</p>
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
