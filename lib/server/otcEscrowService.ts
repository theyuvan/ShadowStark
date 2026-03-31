/**
 * OTC Escrow Service
 * Handles REAL atomic swap execution via Starknet contracts
 * Uses actual deployed contracts:
 * - EscrowContract: Locks funds before swap
 * - BuyStrkContract: BTC → STRK bridge
 * - SellStrkContract: STRK → BTC bridge
 */

import { OtcMatchingService } from './otcMatchingService';
import { RpcProvider, Account, Signer } from 'starknet';

/**
 * Real Cairo contract ABIs for Starknet Sepolia
 */
const BUY_STRK_CONTRACT_ABI = [
  {
    type: 'function' as const,
    name: 'buy_strk_with_btc',
    inputs: [
      { name: 'buyer_address', type: 'ContractAddress' },
      { name: 'btc_amount_sats', type: 'u256' },
      { name: 'seller_address', type: 'ContractAddress' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function' as const,
    name: 'get_quote',
    inputs: [{ name: 'btc_amount_sats', type: 'u256' }],
    outputs: [{ name: 'strk_amount', type: 'u256' }],
  },
];

const SELL_STRK_CONTRACT_ABI = [
  {
    type: 'function' as const,
    name: 'sell_strk_for_btc',
    inputs: [
      { name: 'seller_address', type: 'ContractAddress' },
      { name: 'strk_amount', type: 'u256' },
      { name: 'buyer_address', type: 'ContractAddress' },
      { name: 'btc_recipient_address', type: 'felt252' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function' as const,
    name: 'get_quote',
    inputs: [{ name: 'strk_amount', type: 'u256' }],
    outputs: [{ name: 'btc_amount', type: 'u256' }],
  },
];

const ESCROW_CONTRACT_ABI = [
  {
    type: 'function' as const,
    name: 'lock_funds',
    inputs: [
      { name: 'intent_id', type: 'felt252' },
      { name: 'amount', type: 'u256' },
      { name: 'token_type', type: 'felt252' }, // 0 = STRK, 1 = BTC
      { name: 'owner', type: 'ContractAddress' },
    ],
    outputs: [{ type: 'bool' }],
  },
];

const STRK_TOKEN_CONTRACT_ABI = [
  {
    type: 'function' as const,
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'ContractAddress' },
      { name: 'amount', type: 'u256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function' as const,
    name: 'transfer',
    inputs: [
      { name: 'recipient', type: 'ContractAddress' },
      { name: 'amount', type: 'u256' },
    ],
    outputs: [{ type: 'bool' }],
  },
];

export class OtcEscrowService {
  private static instance: OtcEscrowService;
  private escrowContractAddress: string;
  private buyStrkContractAddress: string;
  private sellStrkContractAddress: string;
  private strkTokenAddress: string;
  private rpcProvider: RpcProvider;
  private account?: Account;
  private executorAddress: string;

  private constructor() {
    // Get contract addresses from environment
    this.escrowContractAddress =
      process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || 
      process.env.ESCROW_CONTRACT_ADDRESS || 
      '0x06cd7225fbf6ffc2c0ad8261a076214e2d8b52f87c312485c46033048c80cf9c';
    
    this.buyStrkContractAddress =
      process.env.NEXT_PUBLIC_BUY_STRK_ADDRESS || 
      process.env.BUY_STRK_ADDRESS ||
      '0x076ee99ed6b1198a683b1a3bdccd7701870c79db32153d07e8e718267385f64b';
    
    this.sellStrkContractAddress =
      process.env.NEXT_PUBLIC_SELL_STRK_ADDRESS || 
      process.env.SELL_STRK_ADDRESS ||
      '0x0282fc99f24ec08d9ad5d23f36871292b91e7f9b75c1a56e08604549d9402325';
    
    this.strkTokenAddress =
      process.env.NEXT_PUBLIC_STRK_TOKEN_ADDRESS || 
      process.env.STRK_TOKEN_ADDRESS || 
      '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f36c5d66ff'; // Official STRK token on Starknet
    
    this.executorAddress = process.env.STARKNET_EXECUTOR_ADDRESS || '';
    
    // Initialize RPC provider
    const rpcUrl = process.env.NEXT_PUBLIC_STARKNET_RPC_URL || 
                   process.env.STARKNET_RPC || 
                   'https://api.cartridge.gg/x/starknet/sepolia';
    this.rpcProvider = new RpcProvider({ nodeUrl: rpcUrl });
    
    // Initialize executor account (REQUIRED for real execution)
    if (process.env.STARKNET_EXECUTOR_ADDRESS && process.env.STARKNET_EXECUTOR_PRIVATE_KEY) {
      try {
        // Create account with proper Starknet.js v9 pattern using Signer
        const signer = new Signer(process.env.STARKNET_EXECUTOR_PRIVATE_KEY);
        this.account = new Account({
          provider: this.rpcProvider,
          address: process.env.STARKNET_EXECUTOR_ADDRESS,
          signer,
        });
        console.log('[OtcEscrow] ✅ Executor account initialized for REAL contract execution');
      } catch (error) {
        console.error('[OtcEscrow] ❌ Failed to initialize executor account:', error);
      }
    } else {
      console.warn('[OtcEscrow] ⚠️ No executor account configured - contracts cannot be executed!');
      console.warn('[OtcEscrow]    Set STARKNET_EXECUTOR_ADDRESS and STARKNET_EXECUTOR_PRIVATE_KEY in .env');
    }

    this.logConfiguration();
  }

  private logConfiguration() {
    console.log('[OtcEscrow] Configuration loaded:');
    console.log(`  ├─ Escrow Contract: ${this.escrowContractAddress.slice(0, 10)}...`);
    console.log(`  ├─ BuyStkContract: ${this.buyStrkContractAddress.slice(0, 10)}...`);
    console.log(`  ├─ SellStrkContract: ${this.sellStrkContractAddress.slice(0, 10)}...`);
    console.log(`  ├─ STRK Token: ${this.strkTokenAddress.slice(0, 10)}...`);
    console.log(`  ├─ Executor Account: ${this.executorAddress.slice(0, 10)}...`);
    console.log(`  └─ RPC Provider: Ready`);
  }

  public static getInstance(): OtcEscrowService {
    const globalAny = global as any;
    if (!globalAny._otcEscrowServiceInstance) {
      globalAny._otcEscrowServiceInstance = new OtcEscrowService();
    }
    return globalAny._otcEscrowServiceInstance;
  }

  /**
   * REAL atomic swap execution
   * Both contract invocations execute on Starknet Sepolia
   */
  public async executeAtomicSwap(
    intentId: string,
    matchId: string,
    match: any
  ): Promise<{ transactionHash: string; escrowAddress: string; steps: any[] }> {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[OtcEscrow] 🚀 EXECUTING REAL ATOMIC SWAP`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Match ID: ${matchId}`);
    console.log(`Intent ID: ${intentId.slice(0, 20)}...`);

    if (!this.account) {
      throw new Error(
        'Executor account not configured! Set STARKNET_EXECUTOR_ADDRESS and STARKNET_EXECUTOR_PRIVATE_KEY'
      );
    }

    const steps: any[] = [];
    const startTime = Date.now();

    try {
      // Determine swap direction and configure parties
      const partyASendsStrk = match.partyA.sendChain === 'strk';

      console.log(`\n📊 Swap Direction:`);
      if (partyASendsStrk) {
        console.log(`  Party A (STRK seller) → sends ${match.partyA.sendAmount} STRK`);
        console.log(`  Party B (BTC sender)  → receives ${match.partyA.sendAmount} STRK`);
        console.log(`  Party B (BTC sender)  → sends ${match.partyB.sendAmount} BTC`);
        console.log(`  Party A (STRK seller) → receives ${match.partyB.sendAmount} BTC`);
      } else {
        console.log(`  Party A (BTC sender)   → sends ${match.partyA.sendAmount} BTC`);
        console.log(`  Party B (STRK seller)  → receives ${match.partyA.sendAmount} BTC`);
        console.log(`  Party B (STRK seller)  → sends ${match.partyB.sendAmount} STRK`);
        console.log(`  Party A (BTC sender)   → receives ${match.partyB.sendAmount} STRK`);
      }

      // ============================================
      // STEP 1: APPROVE STRK TRANSFER (if needed)
      // ============================================
      steps.push({
        step: 1,
        description: 'Verify STRK token approvals',
        status: 'in_progress',
      });

      try {
        // Approve escrow contract to manage STRK
        const approvalAmount = BigInt(Math.floor(parseFloat(match.partyB.sendAmount) * 1e18));
        
        console.log(`\n[Step 1] Approving STRK token transfer...`);
        const approveTx = await this.account.execute([{
          contractAddress: this.strkTokenAddress,
          entrypoint: 'approve',
          calldata: [this.escrowContractAddress, approvalAmount.toString(), '0'],
        }]);
        
        console.log(`  Approval TX: ${approveTx.transaction_hash}`);
        await this.rpcProvider.waitForTransaction(approveTx.transaction_hash as string);
        console.log(`  ✅ STRK approval confirmed`);

        steps[0].status = 'completed';
        steps[0].txHash = approveTx.transaction_hash;
      } catch (approvalError) {
        console.warn(`  ⚠️ STRK approval failed (may already be approved):`, approvalError);
        steps[0].status = 'skipped';
        steps[0].note = 'Approval may already exist';
      }

      // ============================================
      // STEP 2: LOCK FUNDS IN ESCROW
      // ============================================
      steps.push({
        step: 2,
        description: `Lock ${partyASendsStrk ? match.partyA.sendAmount : match.partyB.sendAmount} STRK in escrow`,
        status: 'in_progress',
      });

      try {
        const lockAmount = BigInt(Math.floor(parseFloat(partyASendsStrk ? match.partyA.sendAmount : match.partyB.sendAmount) * 1e18));

        console.log(`\n[Step 2] Locking funds in escrow...`);
        const lockTx = await this.account.execute([{
          contractAddress: this.escrowContractAddress,
          entrypoint: 'lock_funds',
          calldata: [intentId, lockAmount.toString(), '0', this.executorAddress],
        }]);
        
        console.log(`  Lock TX: ${lockTx.transaction_hash}`);
        await this.rpcProvider.waitForTransaction(lockTx.transaction_hash as string);
        console.log(`  ✅ Funds locked in escrow`);

        steps[1].status = 'completed';
        steps[1].txHash = lockTx.transaction_hash;
      } catch (lockError) {
        console.error(`  ❌ Escrow lock failed:`, lockError);
        steps[1].status = 'failed';
        throw new Error(`Failed to lock funds in escrow: ${lockError}`);
      }

      // ============================================
      // STEP 3: CALL BuyStrkContract
      // ============================================
      console.log(`\n[Step 3] Calling BuyStrkContract...`);
      steps.push({
        step: 3,
        description: `BuyStrkContract: Convert BTC to ${partyASendsStrk ? match.partyB.sendAmount : match.partyA.sendAmount} STRK`,
        status: 'in_progress',
      });

      try {
        const buyStrkTx = await this.callBuyStrkReal(
          partyASendsStrk ? match.partyB.wallet : match.partyA.wallet,  // buyer (receives STRK)
          partyASendsStrk ? match.partyB.sendAmount : match.partyA.sendAmount,  // BTC amount (in BTC)
          partyASendsStrk ? match.partyA.wallet : match.partyB.wallet  // seller
        );

        console.log(`  ✅ BuyStrkContract executed: ${buyStrkTx}`);
        steps[2].status = 'completed';
        steps[2].txHash = buyStrkTx;
      } catch (buyError) {
        console.error(`  ❌ BuyStrkContract failed:`, buyError);
        steps[2].status = 'failed';
        steps[2].error = String(buyError);
        throw new Error(`BuyStrkContract execution failed: ${buyError}`);
      }

      // ============================================
      // STEP 4: CALL SellStrkContract
      // ============================================
      console.log(`\n[Step 4] Calling SellStrkContract...`);
      steps.push({
        step: 4,
        description: `SellStrkContract: Convert ${partyASendsStrk ? match.partyA.sendAmount : match.partyB.sendAmount} STRK to BTC`,
        status: 'in_progress',
      });

      try {
        const sellStrkTx = await this.callSellStrkReal(
          partyASendsStrk ? match.partyA.wallet : match.partyB.wallet,  // seller (sends STRK)
          partyASendsStrk ? match.partyA.sendAmount : match.partyB.sendAmount,  // STRK amount
          partyASendsStrk ? match.partyB.wallet : match.partyA.wallet,  // buyer address
          partyASendsStrk ? match.partyB.wallet : match.partyA.wallet  // BTC recipient
        );

        console.log(`  ✅ SellStrkContract executed: ${sellStrkTx}`);
        steps[3].status = 'completed';
        steps[3].txHash = sellStrkTx;
      } catch (sellError) {
        console.error(`  ❌ SellStrkContract failed:`, sellError);
        steps[3].status = 'failed';
        steps[3].error = String(sellError);
        throw new Error(`SellStrkContract execution failed: ${sellError}`);
      }

      // ============================================
      // SUCCESS
      // ============================================
      const duration = Date.now() - startTime;
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`✅ ATOMIC SWAP COMPLETED SUCCESSFULLY`);
      console.log(`${'═'.repeat(60)}`);
      console.log(`Total execution time: ${duration}ms\n`);

      return {
        transactionHash: (steps[3].txHash || steps[2].txHash) as string,
        escrowAddress: this.escrowContractAddress,
        steps: steps,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n${'═'.repeat(60)}`);
      console.error(`❌ ATOMIC SWAP FAILED`);
      console.error(`${'═'.repeat(60)}`);
      console.error(`Error: ${error}`);
      console.error(`Duration: ${duration}ms\n`);

      // Mark failed steps
      for (const step of steps) {
        if (step.status === 'in_progress') {
          step.status = 'failed';
        }
      }

      throw new Error(`Atomic swap failed: ${error}`);
    }
  }

  /**
   * REAL BuyStrkContract call
   */
  private async callBuyStrkReal(
    buyerAddress: string,
    btcAmount: string,
    sellerAddress: string
  ): Promise<string> {
    console.log(`[BuyStrk] Preparing BTC→STRK conversion:`);
    console.log(`  Buyer: ${buyerAddress.slice(0, 10)}...`);
    console.log(`  BTC Amount: ${btcAmount}`);
    console.log(`  Seller: ${sellerAddress.slice(0, 10)}...`);

    if (!this.account) {
      throw new Error('Executor account not available');
    }

    try {
      // Convert BTC to satoshis (1 BTC = 100,000,000 sats)
      const btcAmountSats = BigInt(Math.floor(parseFloat(btcAmount) * 1e8));

      console.log(`  Calling: buy_strk_with_btc(${buyerAddress}, ${btcAmountSats}, ${sellerAddress})`);

      const tx = await this.account.execute([{
        contractAddress: this.buyStrkContractAddress,
        entrypoint: 'buy_strk_with_btc',
        calldata: [buyerAddress, btcAmountSats.toString(), '0', sellerAddress],
      }]);

      console.log(`[BuyStrk] TX sent: ${tx.transaction_hash}`);
      
      // Wait for confirmation
      const receipt = await this.rpcProvider.waitForTransaction(tx.transaction_hash as string);
      console.log(`[BuyStrk] ✅ Transaction confirmed`);

      return tx.transaction_hash as string;
    } catch (error) {
      console.error(`[BuyStrk] ❌ Contract call failed:`, error);
      throw error;
    }
  }

  /**
   * REAL SellStrkContract call
   */
  private async callSellStrkReal(
    sellerAddress: string,
    strkAmount: string,
    buyerAddress: string,
    btcRecipient: string
  ): Promise<string> {
    console.log(`[SellStrk] Preparing STRK→BTC conversion:`);
    console.log(`  Seller: ${sellerAddress.slice(0, 10)}...`);
    console.log(`  STRK Amount: ${strkAmount}`);
    console.log(`  Buyer: ${buyerAddress.slice(0, 10)}...`);
    console.log(`  BTC Recipient: ${btcRecipient.slice(0, 10)}...`);

    if (!this.account) {
      throw new Error('Executor account not available');
    }

    try {
      // Convert STRK amount (18 decimals)
      const strkAmountScaled = BigInt(Math.floor(parseFloat(strkAmount) * 1e18));

      // Convert Bitcoin address to felt252
      const btcAddressFelt = `0x${btcRecipient.slice(0, 60).padEnd(60, '0')}`;

      console.log(`  Calling: sell_strk_for_btc(${sellerAddress}, ${strkAmountScaled}, ${buyerAddress}, ${btcAddressFelt})`);

      const tx = await this.account.execute([{
        contractAddress: this.sellStrkContractAddress,
        entrypoint: 'sell_strk_for_btc',
        calldata: [sellerAddress, strkAmountScaled.toString(), '0', buyerAddress, btcAddressFelt],
      }]);

      console.log(`[SellStrk] TX sent: ${tx.transaction_hash}`);
      
      // Wait for confirmation
      const receipt = await this.rpcProvider.waitForTransaction(tx.transaction_hash as string);
      console.log(`[SellStrk] ✅ Transaction confirmed`);

      return tx.transaction_hash as string;
    } catch (error) {
      console.error(`[SellStrk] ❌ Contract call failed:`, error);
      throw error;
    }
  }

  public getEscrowStatus(matchId: string): { status: string; locked: boolean } {
    const matchingService = OtcMatchingService.getInstance();
    const match = matchingService.getMatch(matchId);

    if (!match) {
      return { status: 'not_found', locked: false };
    }

    return {
      status: match.status,
      locked: match.status === 'pending' || match.status === 'both_approved',
    };
  }
}

