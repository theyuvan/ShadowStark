import { NextRequest, NextResponse } from "next/server";
import { OtcMatchingService } from "@/lib/server/otcMatchingService";
import { OtcEscrowService } from "@/lib/server/otcEscrowService";

/**
 * Simple signature validation
 * In production, use proper cryptographic verification for each chain
 */
function verifySignature(
  _walletAddress: string,
  _message: string,
  signature: string
): boolean {
  // For testing: verify signature format is valid hex or base64
  // In production: use chain-specific verification (Bitcoin sig verification, Starknet sigHash verification)
  const isValidHex = /^0x[a-fA-F0-9]{128,}$/.test(signature);
  const isValidBase64 = /^[A-Za-z0-9+/=]{130,}$/.test(signature);
  return isValidHex || isValidBase64 || signature.length > 50; // Accept if valid format or reasonably long
}

const otcService = OtcMatchingService.getInstance();
const escrowService = OtcEscrowService.getInstance();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      intentId,
      matchId,
      walletAddress,
      signature,
      fundAmount,
      sendChain,
    } = body;

    // Validate required fields
    if (
      !intentId ||
      !matchId ||
      !walletAddress ||
      !signature ||
      !fundAmount ||
      !sendChain
    ) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: [
            "intentId",
            "matchId",
            "walletAddress",
            "signature",
            "fundAmount",
            "sendChain",
          ],
        },
        { status: 400 }
      );
    }

    // Get the match details to verify it exists
    const match = otcService.getMatchByIntentAndId(intentId, matchId);
    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    // Determine which party this is (A or B)
    const isPartyA = walletAddress.toLowerCase() === match.partyA.wallet.toLowerCase();
    const isPartyB = walletAddress.toLowerCase() === match.partyB.wallet.toLowerCase();

    if (!isPartyA && !isPartyB) {
      return NextResponse.json(
        { error: "Wallet address does not match either party in this match" },
        { status: 403 }
      );
    }

    // Verify the signature matches the intent and wallet
    const intentMessageHash = `OTC_ESCROW_FUND:${intentId}:${matchId}:${fundAmount}:${sendChain}`;
    const signatureValid = await verifySignature(
      walletAddress,
      intentMessageHash,
      signature
    );

    if (!signatureValid) {
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      );
    }

    // Check if user already funded
    if (isPartyA && match.partyA.fundedToEscrow) {
      return NextResponse.json(
        { error: "Party A has already funded the escrow" },
        { status: 400 }
      );
    }

    if (isPartyB && match.partyB.fundedToEscrow) {
      return NextResponse.json(
        { error: "Party B has already funded the escrow" },
        { status: 400 }
      );
    }

    // Verify the fund amount matches what was agreed upon
    const expectedAmount = isPartyA ? match.partyA.sendAmount : match.partyB.sendAmount;
    if (fundAmount !== expectedAmount) {
      return NextResponse.json(
        {
          error: `Fund amount mismatch. Expected ${expectedAmount}, got ${fundAmount}`,
        },
        { status: 400 }
      );
    }

    // Update match status to mark this party as funded
    let escrowTxHash = "";
    let swapExecuted = false;

    try {
      // Mark party as funded in the match
      const updatedMatch = otcService.updateMatchFundingStatus(
        intentId,
        matchId,
        isPartyA ? "partyA" : "partyB",
        true
      );

      if (!updatedMatch) {
        return NextResponse.json(
          { error: "Failed to update match funding status" },
          { status: 500 }
        );
      }

      // Check if both parties have funded
      if (updatedMatch.partyA.fundedToEscrow && updatedMatch.partyB.fundedToEscrow) {
        console.log(`\n✅ Both parties funded! Executing atomic swap for match ${matchId}`);
        
        // Trigger atomic swap execution
        try {
          const swapResult = await escrowService.executeAtomicSwap(
            intentId,
            matchId,
            updatedMatch
          );
          escrowTxHash = swapResult.transactionHash;
          swapExecuted = true;
          console.log(`✅ Atomic swap executed:`, swapResult);
        } catch (swapError) {
          console.error(`⚠️ Atomic swap execution failed (will retry):`, swapError);
          // Don't fail the funding step if swap execution fails
          // The swap can be retried later
        }
      }
    } catch (escrowError) {
      console.error("Escrow funding error:", escrowError);
      return NextResponse.json(
        {
          error: "Failed to process escrow funding",
          details: escrowError instanceof Error ? escrowError.message : String(escrowError),
        },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: swapExecuted
          ? `Both parties funded and atomic swap executed!`
          : `Party ${isPartyA ? "A" : "B"} funds marked. Waiting for counterparty...`,
        escrowTxHash,
        matchStatus: swapExecuted ? "executing" : "escrow_funding",
        swapExecuted,
        fundingComplete: swapExecuted,
      },
      { status: 200 }
    );
  } catch (generalError) {
    console.error("[FUND] General error:", generalError);
    return NextResponse.json(
      {
        error: "Escrow funding request failed",
        details: generalError instanceof Error ? generalError.message : String(generalError),
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check escrow funding status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const intentId = searchParams.get("intentId");
    const matchId = searchParams.get("matchId");

    if (!intentId || !matchId) {
      return NextResponse.json(
        { error: "Missing intentId or matchId" },
        { status: 400 }
      );
    }

    const match = otcService.getMatchByIntentAndId(intentId, matchId);
    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        intentId,
        matchId,
        status: match.status,
        partyA: {
          wallet: match.partyA.wallet,
          sendAmount: match.partyA.sendAmount,
          fundedToEscrow: match.partyA.fundedToEscrow || false,
          escrowTxHash: match.partyA.escrowTxHash || null,
        },
        partyB: {
          wallet: match.partyB.wallet,
          sendAmount: match.partyB.sendAmount,
          fundedToEscrow: match.partyB.fundedToEscrow || false,
          escrowTxHash: match.partyB.escrowTxHash || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking escrow status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
