import { NextResponse } from "next/server";

import { ensureApiKeyIfConfigured } from "@/lib/server/executionGateway";
import { listMatches } from "@/lib/server/otcStateStore";
import { OtcMatchingService } from "@/lib/server/otcMatchingService";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    ensureApiKeyIfConfigured(request);
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");
    const matchId = searchParams.get("matchId");
    const view = searchParams.get("view") || "all"; // "all", "pending", "matches"

    const matchingService = OtcMatchingService.getInstance();
    
    // If specific matchId requested, return that match's details
    if (matchId) {
      const match = matchingService.getMatch(matchId);
      if (!match) {
        return NextResponse.json(
          { error: "Match not found", matchId },
          { status: 404 }
        );
      }

      return NextResponse.json({
        type: "match_detail",
        matchId: match.matchId,
        status: match.status,
        matchedAt: match.matchedAt,
        intentA: match.intentA,
        intentB: match.intentB,
        partyA: {
          wallet: match.partyA.wallet,
          sendAmount: match.partyA.sendAmount,
          sendChain: match.partyA.sendChain,
          receiveAmount: match.partyA.receiveAmount,
          receiveChain: match.partyA.receiveChain,
          signed: !!matchingService.getIntent(match.intentA)?.signature,
          fundedToEscrow: !!match.partyA.fundedToEscrow,
        },
        partyB: {
          wallet: match.partyB.wallet,
          sendAmount: match.partyB.sendAmount,
          sendChain: match.partyB.sendChain,
          receiveAmount: match.partyB.receiveAmount,
          receiveChain: match.partyB.receiveChain,
          signed: !!matchingService.getIntent(match.intentB)?.signature,
          fundedToEscrow: !!match.partyB.fundedToEscrow,
        },
        transactionHash: match.transactionHash,
      });
    }
    
    if (view === "pending") {
      // Show pending intents (order book)
      const pendingIntents = matchingService.getPendingIntents();
      return NextResponse.json({
        type: "pending_intents",
        orderBook: pendingIntents.map(i => ({
          intentId: i.intentId,
          offer: `Send ${i.sendAmount} ${i.sendChain.toUpperCase()} → Receive ${i.receiveAmount} ${i.receiveChain.toUpperCase()}`,
          createdAt: i.createdAt,
          expiresAt: i.expiresAt,
          sender: walletAddress ? (i.senderWallet === walletAddress ? 'YOU' : i.senderWallet.slice(0, 10) + '...') : i.senderWallet.slice(0, 10) + '...',
        })),
      });
    }

    if (view === "matches") {
      // Show active matches
      const matches = matchingService.getActiveMatches();
      
      // Filter to user's matches if wallet specified
      const userMatches = walletAddress 
        ? matches.filter(m => m.partyA.wallet === walletAddress || m.partyB.wallet === walletAddress)
        : matches;

      return NextResponse.json({
        type: "active_matches",
        matches: userMatches.map(m => ({
          matchId: m.matchId,
          status: m.status,
          createdAt: m.matchedAt,
          yourRole: walletAddress === m.partyA.wallet ? 'Party A' : 'Party B',
          swap: `${m.partyA.sendAmount} ${m.partyA.sendChain.toUpperCase()} ↔ ${m.partyB.sendAmount} ${m.partyB.sendChain.toUpperCase()}`,
          partyA: {
            wallet: m.partyA.wallet.slice(0, 10) + '...',
            offer: `${m.partyA.sendAmount} ${m.partyA.sendChain.toUpperCase()} → ${m.partyA.receiveAmount} ${m.partyA.receiveChain.toUpperCase()}`,
            signed: !!matchingService.getIntent(m.intentA)?.signature,
          },
          partyB: {
            wallet: m.partyB.wallet.slice(0, 10) + '...',
            offer: `${m.partyB.sendAmount} ${m.partyB.sendChain.toUpperCase()} → ${m.partyB.receiveAmount} ${m.partyB.receiveChain.toUpperCase()}`,
            signed: !!matchingService.getIntent(m.intentB)?.signature,
          },
          transactionHash: m.transactionHash,
        })),
      });
    }

    // Default: show all (both pending and matches)
    const allData = {
      type: "all",
      pending: matchingService.getPendingIntents().length,
      active_matches: matchingService.getActiveMatches().length,
      stats: {
        totalIntents: matchingService.getPendingIntents().length,
        totalMatches: matchingService.getActiveMatches().length,
        readyToExecute: matchingService.getActiveMatches().filter(m => m.status === 'both_approved').length,
      }
    };

    return NextResponse.json(allData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const unauthorized = message.includes("Unauthorized");
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 500 });
  }
}
