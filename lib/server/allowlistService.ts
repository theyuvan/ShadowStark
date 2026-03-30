/**
 * Allowlist Service
 * Strict whitelist validation - NO FALLBACKS
 * Only whitelisted wallets, contracts, and tokens are allowed
 */

export interface AllowlistEntry {
  address: string;
  type: 'wallet' | 'contract' | 'token';
  chain: 'btc' | 'strk';
  name: string;
  verified: boolean;
  addedAt: number;
}

export interface AllowlistValidationResult {
  allowed: boolean;
  address: string;
  type: 'wallet' | 'contract' | 'token';
  chain: 'btc' | 'strk';
  reason?: string; // Reason for rejection
}

export class AllowlistService {
  private static instance: AllowlistService;

  // Whitelist storage - in production, load from database
  private allowedWallets: Map<string, AllowlistEntry> = new Map();
  private allowedContracts: Map<string, AllowlistEntry> = new Map();
  private allowedTokens: Map<string, AllowlistEntry> = new Map();

  // Blacklist for compromised wallets
  private blacklistedWallets: Set<string> = new Set();

  private constructor() {
    this.initializeDefaultAllowlist();
  }

  public static getInstance(): AllowlistService {
    if (!AllowlistService.instance) {
      AllowlistService.instance = new AllowlistService();
    }
    return AllowlistService.instance;
  }

  /**
   * Initialize default allowlist with known safe addresses
   * In production, load from secure database
   */
  private initializeDefaultAllowlist(): void {
    // Allowed BTC addresses (mainnet + testnet)
    this.addWalletToAllowlist('bc1q8wpgvtpfwgkrfm0r5dz5c8fk0z8fk0z8fk0z8f', 'btc', 'Demo BTC Wallet');
    this.addWalletToAllowlist('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 'btc', 'Testnet BTC Wallet');
    
    // Allowed Starknet addresses
    this.addWalletToAllowlist('0x123456789abcdef123456789abcdef1234567890abcdef1234567890abcdef', 'strk', 'Demo STRK Wallet');
    this.addWalletToAllowlist('0x0000000000000000000000000000000000000000000000000000000000000001', 'strk', 'Starknet Genesis Account');

    // Allowed contracts
    this.addContractToAllowlist('0x0', 'strk', 'Starknet Verifier Contract');
    this.addContractToAllowlist('0x1', 'strk', 'Starknet Bridge Contract');

    // Allowed tokens
    this.addTokenToAllowlist('0xbtc_mainnet', 'btc', 'Bitcoin Native');
    this.addTokenToAllowlist('0xstrk_mainnet', 'strk', 'Starknet Native STRK');

    console.log('✅ Allowlist initialized with safe addresses');
  }

  /**
   * Validate wallet address against allowlist
   * STRICT: Returns false if not found - NO FALLBACKS
   */
  public validateWallet(address: string, chain: 'btc' | 'strk'): AllowlistValidationResult {
    const normalizedAddress = address.toLowerCase().trim();

    // Check blacklist first
    if (this.blacklistedWallets.has(normalizedAddress)) {
      return {
        allowed: false,
        address,
        type: 'wallet',
        chain,
        reason: 'Wallet is blacklisted due to security concerns',
      };
    }

    // Check allowlist
    const key = `${chain}:${normalizedAddress}`;
    if (this.allowedWallets.has(key)) {
      const entry = this.allowedWallets.get(key)!;
      if (!entry.verified) {
        return {
          allowed: false,
          address,
          type: 'wallet',
          chain,
          reason: 'Wallet is whitelisted but not yet verified',
        };
      }
      return {
        allowed: true,
        address,
        type: 'wallet',
        chain,
      };
    }

    // NOT in allowlist - strict rejection
    return {
      allowed: false,
      address,
      type: 'wallet',
      chain,
      reason: `${chain.toUpperCase()} wallet not in allowlist. Contact support to request access.`,
    };
  }

  /**
   * Validate smart contract address against allowlist
   * STRICT: Only verified contracts are allowed
   */
  public validateContract(address: string, chain: 'btc' | 'strk'): AllowlistValidationResult {
    const normalizedAddress = address.toLowerCase().trim();
    const key = `${chain}:${normalizedAddress}`;

    if (this.allowedContracts.has(key)) {
      const entry = this.allowedContracts.get(key)!;
      if (!entry.verified) {
        return {
          allowed: false,
          address,
          type: 'contract',
          chain,
          reason: 'Contract is registered but not verified',
        };
      }
      return {
        allowed: true,
        address,
        type: 'contract',
        chain,
      };
    }

    return {
      allowed: false,
      address,
      type: 'contract',
      chain,
      reason: 'Contract not authorized. Only verified contracts allowed.',
    };
  }

  /**
   * Validate token against allowlist
   * STRICT: Only whitelisted tokens can be swapped
   */
  public validateToken(tokenId: string, chain: 'btc' | 'strk'): AllowlistValidationResult {
    const normalizedId = tokenId.toLowerCase().trim();
    const key = `${chain}:${normalizedId}`;

    if (this.allowedTokens.has(key)) {
      const entry = this.allowedTokens.get(key)!;
      if (!entry.verified) {
        return {
          allowed: false,
          address: tokenId,
          type: 'token',
          chain,
          reason: 'Token is cached but not verified',
        };
      }
      return {
        allowed: true,
        address: tokenId,
        type: 'token',
        chain,
      };
    }

    return {
      allowed: false,
      address: tokenId,
      type: 'token',
      chain,
      reason: 'Token not supported. Only BTC and STRK allowed.',
    };
  }

  /**
   * Add wallet to allowlist
   */
  public addWalletToAllowlist(address: string, chain: 'btc' | 'strk', name: string, verified: boolean = true): void {
    const key = `${chain}:${address.toLowerCase()}`;
    this.allowedWallets.set(key, {
      address,
      type: 'wallet',
      chain,
      name,
      verified,
      addedAt: Date.now(),
    });
    console.log(`✅ Added wallet to allowlist: ${name} (${address})`);
  }

  /**
   * Add contract to allowlist
   */
  public addContractToAllowlist(address: string, chain: 'btc' | 'strk', name: string, verified: boolean = true): void {
    const key = `${chain}:${address.toLowerCase()}`;
    this.allowedContracts.set(key, {
      address,
      type: 'contract',
      chain,
      name,
      verified,
      addedAt: Date.now(),
    });
    console.log(`✅ Added contract to allowlist: ${name} (${address})`);
  }

  /**
   * Add token to allowlist
   */
  public addTokenToAllowlist(tokenId: string, chain: 'btc' | 'strk', name: string, verified: boolean = true): void {
    const key = `${chain}:${tokenId.toLowerCase()}`;
    this.allowedTokens.set(key, {
      address: tokenId,
      type: 'token',
      chain,
      name,
      verified,
      addedAt: Date.now(),
    });
    console.log(`✅ Added token to allowlist: ${name}`);
  }

  /**
   * Blacklist a wallet (security measure)
   * Use when wallet is compromised
   */
  public blacklistWallet(address: string, reason: string): void {
    this.blacklistedWallets.add(address.toLowerCase());
    console.log(`⚠️  Blacklisted wallet: ${address} - Reason: ${reason}`);
  }

  /**
   * Remove wallet from blacklist
   * Use when security issue is resolved
   */
  public removeFromBlacklist(address: string): void {
    this.blacklistedWallets.delete(address.toLowerCase());
    console.log(`✅ Removed wallet from blacklist: ${address}`);
  }

  /**
   * Get all allowed wallets
   */
  public getAllowedWallets(chain?: 'btc' | 'strk'): AllowlistEntry[] {
    const wallets = Array.from(this.allowedWallets.values());
    if (chain) {
      return wallets.filter((w) => w.chain === chain);
    }
    return wallets;
  }

  /**
   * Get all allowed contracts
   */
  public getAllowedContracts(chain?: 'btc' | 'strk'): AllowlistEntry[] {
    const contracts = Array.from(this.allowedContracts.values());
    if (chain) {
      return contracts.filter((c) => c.chain === chain);
    }
    return contracts;
  }

  /**
   * Get all allowed tokens
   */
  public getAllowedTokens(chain?: 'btc' | 'strk'): AllowlistEntry[] {
    const tokens = Array.from(this.allowedTokens.values());
    if (chain) {
      return tokens.filter((t) => t.chain === chain);
    }
    return tokens;
  }

  /**
   * Verify address ownership (in production, use signed message)
   * Returns true only if address is in allowlist AND verified
   */
  public isAddressVerifiedAndAllowed(address: string, chain: 'btc' | 'strk'): boolean {
    const result = this.validateWallet(address, chain);
    return result.allowed;
  }
}
