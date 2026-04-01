/**
 * OTC Matching Service
 * Stores pending intents and finds peer-to-peer matches
 * 
 * Flow:
 * 1. User A submits BTC→STRK intent (wants to spend 0.0001 BTC, receive STRK)
 * 2. User B submits STRK→BTC intent (wants to spend STRK, receive 0.0001 BTC)
 * 3. Matching engine finds these are complementary
 * 4. Both intents are paired for atomic execution
 * 5. Escrow holds both amounts, both parties sign, swap executes
 */

export interface OtcIntent {
  intentId: string;
  createdAt: number;
  expiresAt: number;
  
  // User info
  senderWallet: string;
  receiverWallet: string;
  
  // Swap details
  sendAmount: string;
  sendChain: 'btc' | 'strk';
  receiveAmount: string;
  receiveChain: 'btc' | 'strk';
  
  // Status
  status: 'pending' | 'matched' | 'executed' | 'cancelled' | 'expired';
  matchedWith?: string; // intentId of matched intent
  
  // Proof & signature
  zkProof?: {
    proofHash: string;
    commitment: string;
    nullifier: string;
    verified: boolean;
  };
  signature?: string;
}

export interface OtcMatch {
  matchId: string;
  intentA: string; // intentId
  intentB: string; // intentId
  matchedAt: number;
  
  // Party info
  partyA: {
    wallet: string;
    sendAmount: string;
    sendChain: 'btc' | 'strk';
    receiveAmount: string;
    receiveChain: 'btc' | 'strk';
    signed?: boolean;
    fundedToEscrow?: boolean;
    escrowTxHash?: string;
  };
  
  partyB: {
    wallet: string;
    sendAmount: string;
    sendChain: 'btc' | 'strk';
    receiveAmount: string;
    receiveChain: 'btc' | 'strk';
    signed?: boolean;
    fundedToEscrow?: boolean;
    escrowTxHash?: string;
  };
  
  status: 'pending' | 'both_approved' | 'escrow_funding' | 'escrow_funded' | 'executing' | 'executed' | 'failed' | 'cancelled';
  escrowContractAddress?: string;
  transactionHash?: string;
}

export class OtcMatchingService {
  private static instance: OtcMatchingService;
  private pendingIntents: Map<string, OtcIntent> = new Map();
  private matches: Map<string, OtcMatch> = new Map();
  private readonly INTENT_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): OtcMatchingService {
    // Use global to persist across hot reloads in development
    const globalAny = global as any;
    if (!globalAny._otcMatchingServiceInstance) {
      console.log('[OTC-SERVICE] Creating new OtcMatchingService instance');
      globalAny._otcMatchingServiceInstance = new OtcMatchingService();
    } else {
      console.log('[OTC-SERVICE] Reusing existing OtcMatchingService instance');
    }
    return globalAny._otcMatchingServiceInstance;
  }

  /**
   * Submit an intent and try to find a match
   */
  public submitIntent(intent: OtcIntent): { match?: OtcMatch; pendingIntentId: string } {
    console.log(`[SUBMIT-START] Received intent:`, JSON.stringify({
      intentId: intent.intentId,
      senderWallet: intent.senderWallet?.slice(0, 10),
      sendAmount: intent.sendAmount,
      sendChain: intent.sendChain,
      receiveAmount: intent.receiveAmount,
      receiveChain: intent.receiveChain,
    }));
    
    // Store the intent
    this.pendingIntents.set(intent.intentId, intent);
    
    const storedIntent = this.pendingIntents.get(intent.intentId);
    console.log(`[SUBMIT-STORE] Intent stored:`, {
      intentId: intent.intentId,
      wasStored: !!storedIntent,
      totalIntents: this.pendingIntents.size,
      allIntentIds: Array.from(this.pendingIntents.keys()).map(id => id.slice(0, 10)),
    });
    
    console.log(`[OTC-Match] Intent submitted: ${intent.intentId} (Total now: ${this.pendingIntents.size})`);
    console.log(`  Send: ${intent.sendAmount} ${intent.sendChain.toUpperCase()}`);
    console.log(`  Receive: ${intent.receiveAmount} ${intent.receiveChain.toUpperCase()}`);
    
    // Verify it was stored
    const stored = this.pendingIntents.get(intent.intentId);
    console.log(`  ✓ Verified stored: ${!!stored}`);

    // Look for a matching intent
    const match = this.findMatch(intent);

    if (match) {
      console.log(`[OTC-Match] ✅ MATCH FOUND! Intent ${intent.intentId} matched with ${match.intentB}`);
      const otcMatch: OtcMatch = {
        matchId: `match_${Date.now().toString(16)}`,
        intentA: match.intentA,
        intentB: match.intentB,
        matchedAt: Date.now(),
        partyA: {
          wallet: match.partyA.wallet,
          sendAmount: match.partyA.sendAmount,
          sendChain: match.partyA.sendChain,
          receiveAmount: match.partyA.receiveAmount,
          receiveChain: match.partyA.receiveChain,
          signed: false,
          fundedToEscrow: false,
        },
        partyB: {
          wallet: match.partyB.wallet,
          sendAmount: match.partyB.sendAmount,
          sendChain: match.partyB.sendChain,
          receiveAmount: match.partyB.receiveAmount,
          receiveChain: match.partyB.receiveChain,
          signed: false,
          fundedToEscrow: false,
        },
        status: 'pending',
      };

      this.matches.set(otcMatch.matchId, otcMatch);

      // Update intent statuses
      const intentA = this.pendingIntents.get(match.intentA);
      const intentB = this.pendingIntents.get(match.intentB);
      if (intentA) {
        intentA.status = 'matched';
        intentA.matchedWith = match.intentB;
      }
      if (intentB) {
        intentB.status = 'matched';
        intentB.matchedWith = match.intentA;
      }

      console.log(`[SUBMIT-MATCHED] Returning with match:`, {
        intentId: intent.intentId.slice(0, 10),
        matchId: otcMatch.matchId,
        totalIntents: this.pendingIntents.size,
      });
      return { match: otcMatch, pendingIntentId: intent.intentId };
    }

    console.log(`[SUBMIT-PENDING] No match found. Intent ${intent.intentId.slice(0, 10)} is pending`);
    console.log(`[SUBMIT-STATE] Current service state:`, {
      totalIntents: this.pendingIntents.size,
      intentIds: Array.from(this.pendingIntents.keys()).map(id => id.slice(0, 10)),
      intentsInfo: Array.from(this.pendingIntents.values()).map(i => ({
        id: i.intentId.slice(0, 10),
        wallet: i.senderWallet.slice(0, 10),
        send: i.sendAmount + ' ' + i.sendChain,
        receive: i.receiveAmount + ' ' + i.receiveChain,
      })),
    });
    return { pendingIntentId: intent.intentId };
  }

  /**
   * Find an intent that matches the given intent
   */
  private findMatch(
    intent: OtcIntent
  ): { intentA: string; intentB: string; partyA: OtcMatch['partyA']; partyB: OtcMatch['partyB'] } | null {
    // Look for an intent where:
    // - Their send chain = our receive chain
    // - Our send chain = their receive chain
    // - Amounts are compatible (within tolerance)
    // - If multiple peers qualify, choose the closest amount match

    const slippageTolerance = 0.05; // 5%
    const relativeDifference = (expected: number, actual: number): number => {
      if (!Number.isFinite(expected) || !Number.isFinite(actual) || expected <= 0) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(actual - expected) / expected;
    };

    let bestMatch: {
      intentA: string;
      intentB: string;
      partyA: OtcMatch['partyA'];
      partyB: OtcMatch['partyB'];
      score: number;
      createdAt: number;
    } | null = null;

    for (const [otherId, other] of this.pendingIntents) {
      if (otherId === intent.intentId) continue; // Don't match with self
      if (other.status !== 'pending') continue; // Only match with pending intents

      // Check if this is a complementary pair
      const isComplementary =
        other.sendChain === intent.receiveChain && 
        other.receiveChain === intent.sendChain;

      if (!isComplementary) continue;

      // Check if amounts are compatible (allow 5% slippage on both sides)
      const otherSendNum = Number(other.sendAmount);
      const otherReceiveNum = Number(other.receiveAmount);
      const intentSendNum = Number(intent.sendAmount);
      const intentReceiveNum = Number(intent.receiveAmount);

      const sendGap = relativeDifference(intentReceiveNum, otherSendNum);
      const receiveGap = relativeDifference(intentSendNum, otherReceiveNum);

      if (sendGap > slippageTolerance || receiveGap > slippageTolerance) continue;

      const candidate = {
        intentA: intent.intentId,
        intentB: otherId,
        partyA: {
          wallet: intent.senderWallet,
          sendAmount: intent.sendAmount,
          sendChain: intent.sendChain,
          receiveAmount: intent.receiveAmount,
          receiveChain: intent.receiveChain,
        },
        partyB: {
          wallet: other.senderWallet,
          sendAmount: other.sendAmount,
          sendChain: other.sendChain,
          receiveAmount: other.receiveAmount,
          receiveChain: other.receiveChain,
        },
        score: (sendGap + receiveGap) / 2,
        createdAt: other.createdAt,
      };

      if (
        !bestMatch ||
        candidate.score < bestMatch.score ||
        (candidate.score === bestMatch.score && candidate.createdAt < bestMatch.createdAt)
      ) {
        bestMatch = candidate;
      }
    }

    if (!bestMatch) {
      return null;
    }

    console.log(`[OTC-Match] Closest peer selected within tolerance:`, {
      intentId: intent.intentId.slice(0, 10),
      matchIntentId: bestMatch.intentB.slice(0, 10),
      score: bestMatch.score.toFixed(4),
    });

    return {
      intentA: bestMatch.intentA,
      intentB: bestMatch.intentB,
      partyA: bestMatch.partyA,
      partyB: bestMatch.partyB,
    };
  }

  /**
   * Get a match by matchId
   */
  public getMatch(matchId: string): OtcMatch | undefined {
    return this.matches.get(matchId);
  }

  /**
   * Get a match by intentId and matchId (for API validation)
   */
  public getMatchByIntentAndId(intentId: string, matchId: string): OtcMatch | undefined {
    const match = this.matches.get(matchId);
    if (!match) return undefined;
    // Verify the intent is part of this match
    if (match.intentA !== intentId && match.intentB !== intentId) {
      return undefined;
    }
    return match;
  }

  /**
   * Get all pending intents
   */
  public getPendingIntents(): OtcIntent[] {
    return Array.from(this.pendingIntents.values())
      .filter(i => i.status === 'pending')
      .filter(i => i.expiresAt > Date.now()); // Remove expired intents
  }

  /**
   * Get all active matches
   */
  public getActiveMatches(): OtcMatch[] {
    return Array.from(this.matches.values())
      .filter(m => m.status !== 'executed' && m.status !== 'failed' && m.status !== 'cancelled');
  }

  /**
   * Mark a match as both parties approved
   */
  public markMatchApproved(matchId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'pending') {
      return false;
    }
    match.status = 'both_approved';
    console.log(`[OTC-Match] Match ${matchId} marked as approved by both parties`);
    return true;
  }

  /**
   * Mark a match as executed
   */
  public markMatchExecuted(matchId: string, transactionHash: string, escrowAddress: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }
    match.status = 'executed';
    match.transactionHash = transactionHash;
    match.escrowContractAddress = escrowAddress;
    console.log(`[OTC-Match] Match ${matchId} executed with tx: ${transactionHash}`);
    return true;
  }

  /**
   * Get intent by ID
   */
  public getIntent(intentId: string): OtcIntent | undefined {
    const intent = this.pendingIntents.get(intentId);
    if (!intent) {
      console.log(`[OTC-Match] getIntent: Intent ${intentId.slice(0, 10)}... NOT FOUND. Total intents: ${this.pendingIntents.size}`);
      if (this.pendingIntents.size > 0) {
        const keys = Array.from(this.pendingIntents.keys()).slice(0, 5);
        console.log(`[OTC-Match] Available intent IDs: ${keys.map(k => k.slice(0, 10) + '...').join(', ')}`);
      }
    } else {
      console.log(`[OTC-Match] getIntent: Intent ${intentId.slice(0, 10)}... FOUND (status: ${intent.status})`);
    }
    return intent;
  }

  /**
   * Update intent signature
   */
  public updateIntentSignature(intentId: string, signature: string): boolean {
    const intent = this.pendingIntents.get(intentId);
    if (!intent) {
      return false;
    }
    intent.signature = signature;
    
    // Find all matches this intent is part of and update party signed status
    for (const match of this.matches.values()) {
      if (match.intentA === intentId) {
        match.partyA.signed = true;
        console.log(`[OTC-Match] Updated match ${match.matchId} - partyA signed`);
      }
      if (match.intentB === intentId) {
        match.partyB.signed = true;
        console.log(`[OTC-Match] Updated match ${match.matchId} - partyB signed`);
      }
    }
    
    return true;
  }

  /**
   * Check if both intents in a match are signed
   */
  public areIntentsApproved(matchId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) return false;

    const intentA = this.pendingIntents.get(match.intentA);
    const intentB = this.pendingIntents.get(match.intentB);

    return !!(intentA?.signature && intentB?.signature);
  }

  /**
   * Try to find and create a match for an existing intent
   * Called during execution step if no prior match was found
   */
  public findAndCreateMatch(intentId: string): OtcMatch | null {
    const intent = this.pendingIntents.get(intentId);
    if (!intent || intent.status !== 'pending') {
      return null;
    }

    // If already matched, return null
    if (intent.matchedWith) {
      return null;
    }

    // Search for a matching intent
    const matchData = this.findMatch(intent);
    if (!matchData) {
      return null;
    }

    // Create the match object
    const otcMatch: OtcMatch = {
      matchId: `match_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 10)}`,
      intentA: matchData.intentA,
      intentB: matchData.intentB,
      matchedAt: Date.now(),
      partyA: matchData.partyA,
      partyB: matchData.partyB,
      status: 'pending',
    };

    this.matches.set(otcMatch.matchId, otcMatch);

    // Update intent statuses
    const intentA = this.pendingIntents.get(matchData.intentA);
    const intentB = this.pendingIntents.get(matchData.intentB);
    if (intentA) {
      intentA.status = 'matched';
      intentA.matchedWith = matchData.intentB;
    }
    if (intentB) {
      intentB.status = 'matched';
      intentB.matchedWith = matchData.intentA;
    }

    console.log(`[OTC-Match] ✅ NEW MATCH FOUND! Intent ${intentId} matched with ${matchData.intentB}`);
    console.log(`[OTC-Match] Match ID: ${otcMatch.matchId}`);

    return otcMatch;
  }

  /**
   * Update match funding status for a party
   */
  public updateMatchFundingStatus(
    intentId: string,
    matchId: string,
    party: 'partyA' | 'partyB',
    fundedToEscrow: boolean,
    escrowTxHash?: string
  ): OtcMatch | null {
    const match = this.getMatchByIntentAndId(intentId, matchId);
    if (!match) {
      console.error(`[OTC-Match] Match not found: ${matchId} with intent ${intentId}`);
      return null;
    }

    const partyData = match[party];
    partyData.fundedToEscrow = fundedToEscrow;
    if (escrowTxHash) {
      partyData.escrowTxHash = escrowTxHash;
    }

    console.log(`[OTC-Match] ${party} funding status updated: fundedToEscrow=${fundedToEscrow}`);

    // Update match status based on funding state
    if (match.partyA.fundedToEscrow && match.partyB.fundedToEscrow) {
      match.status = 'escrow_funded';
      console.log(`[OTC-Match] Both parties funded - status set to escrow_funded`);
    } else if (match.partyA.fundedToEscrow || match.partyB.fundedToEscrow) {
      match.status = 'escrow_funding';
      console.log(`[OTC-Match] One party funded - status set to escrow_funding`);
    }

    return match;
  }

  /**
   * Update match status
   */
  public updateMatchStatus(intentId: string, matchId: string, status: OtcMatch['status']): OtcMatch | null {
    const match = this.getMatchByIntentAndId(intentId, matchId);
    if (!match) {
      console.error(`[OTC-Match] Match not found: ${matchId} with intent ${intentId}`);
      return null;
    }

    match.status = status;
    console.log(`[OTC-Match] Match ${matchId} status updated to: ${status}`);
    return match;
  }

  /**
   * Mark both parties as signed
   */
  public markBothPartiesSigned(intentId: string, matchId: string): OtcMatch | null {
    const match = this.getMatchByIntentAndId(intentId, matchId);
    if (!match) {
      console.error(`[OTC-Match] Match not found: ${matchId} with intent ${intentId}`);
      return null;
    }

    match.partyA.signed = true;
    match.partyB.signed = true;
    match.status = 'both_approved';
    console.log(`[OTC-Match] Both parties marked as signed for match ${matchId}`);
    return match;
  }

  /**
   * Mark a party as signed
   */
  public markPartySigned(
    intentId: string,
    matchId: string,
    party: 'partyA' | 'partyB'
  ): OtcMatch | null {
    const match = this.getMatchByIntentAndId(intentId, matchId);
    if (!match) {
      console.error(`[OTC-Match] Match not found: ${matchId} with intent ${intentId}`);
      return null;
    }

    match[party].signed = true;
    console.log(`[OTC-Match] ${party} marked as signed for match ${matchId}`);
    return match;
  }

  /**
   * DEVELOPMENT ONLY: Clear all intents and matches
   */
  public clearAllIntents(): { clearedIntents: number; clearedMatches: number } {
    const intentCount = this.pendingIntents.size;
    const matchCount = this.matches.size;
    
    this.pendingIntents.clear();
    this.matches.clear();
    
    console.log(`[OTC-CLEAR] 🗑️ Cleared ALL intents (${intentCount}) and matches (${matchCount})`);
    return { clearedIntents: intentCount, clearedMatches: matchCount };
  }

  /**
   * DEVELOPMENT ONLY: Get current state
   */
  public getState(): { 
    totalIntents: number; 
    totalMatches: number; 
    intents: Array<{id: string; wallet: string; send: string; receive: string; status: string}>;
    matches: Array<{id: string; partyAWallet: string; partyBWallet: string; status: string}>;
  } {
    const intents = Array.from(this.pendingIntents.values()).map(i => ({
      id: i.intentId.slice(0, 10) + '...',
      wallet: i.senderWallet.slice(0, 10) + '...',
      send: `${i.sendAmount} ${i.sendChain.toUpperCase()}`,
      receive: `${i.receiveAmount} ${i.receiveChain.toUpperCase()}`,
      status: i.status,
    }));

    const matches = Array.from(this.matches.values()).map(m => ({
      id: m.matchId.slice(0, 10) + '...',
      partyAWallet: m.partyA.wallet.slice(0, 10) + '...',
      partyBWallet: m.partyB.wallet.slice(0, 10) + '...',
      status: m.status,
    }));

    return {
      totalIntents: this.pendingIntents.size,
      totalMatches: this.matches.size,
      intents,
      matches,
    };
  }
}
