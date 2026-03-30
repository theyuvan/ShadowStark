# 🚀 ShadowFlow Contract Deployment Guide

## Prerequisites Installation

### Step 1: Install Scarb (Cairo Package Manager)

Scarb is required to compile Cairo contracts.

**Windows (PowerShell as Admin):**
```powershell
# Install Scarb via asdf (recommended) or direct install
# Option A: Using asdf (if installed)
asdf install scarb latest

# Option B: Direct download from GitHub
# https://github.com/software-mansion/scarb/releases
# Download for Windows, add to PATH
```

**Verify Installation:**
```powershell
scarb --version
# Expected: scarb 2.x.x
```

### Step 2: Install sncast (Starknet Contract CLI)

sncast is used to declare and deploy contracts on Starknet.

**Windows (PowerShell as Admin):**
```powershell
# Install via cargo (Rust package manager)
cargo install sncast --locked

# Or download binary from:
# https://github.com/foundry-rs/starknet-foundry/releases
```

**Verify Installation:**
```powershell
sncast --version
# Expected: sncast 0.x.x
```

### Step 3: Setup Starknet Account

Create a Starknet account for contract deployment.

```powershell
# Create new account (if needed)
sncast account create --name "shadowflow-deployer" --network sepolia

# Or use existing account
# ~/.starknet_accounts/shadowflow-deployer.json
```

### Step 4: Set Environment Variables

```powershell
# Set these in PowerShell or .env file
$env:STARKNET_RPC_URL = "https://api.cartridge.gg/x/starknet/sepolia"
$env:ADMIN_ADDRESS = "0x..." # Your Starknet account address
$env:ADMIN_PRIVATE_KEY = "0x..." # Optional if using account file
```

## Deployment Process

### Option 1: Automated Deployment (PowerShell)

```powershell
# Run the automated deployment script
pwsh deploy-contracts.ps1 -AdminAddress "0x..." -StarknetRpc "https://api.cartridge.gg/x/starknet/sepolia"
```

### Option 2: Manual Deployment (Step-by-Step)

**1. Compile Contracts:**
```powershell
cd contracts
scarb build
cd ..
```

**2. Declare Contracts:**
```powershell
# Declare GaragaVerifier
sncast declare --contract-name garaga_verifier --account shadowflow-deployer --network sepolia

# Declare ShadowFlow
sncast declare --contract-name shadowflow --account shadowflow-deployer --network sepolia

# Declare Escrow
sncast declare --contract-name escrow --account shadowflow-deployer --network sepolia

# Declare LiquidityPool
sncast declare --contract-name liquidity_pool --account shadowflow-deployer --network sepolia

# Declare BuyStrk
sncast declare --contract-name buy_strk --account shadowflow-deployer --network sepolia

# Declare SellStrk
sncast declare --contract-name sell_strk --account shadowflow-deployer --network sepolia
```

**3. Deploy Contracts:**
```powershell
# Deploy GaragaVerifier (no constructor args)
sncast deploy \
  --class-hash <GARAGA_VERIFIER_CLASS_HASH> \
  --account shadowflow-deployer \
  --network sepolia

# Deploy ShadowFlow with verifier address as constructor arg
sncast deploy \
  --class-hash <SHADOWFLOW_CLASS_HASH> \
  --constructor-calldata <VERIFIER_ADDRESS> \
  --account shadowflow-deployer \
  --network sepolia

# Deploy Escrow with admin + verifier as constructor args
sncast deploy \
  --class-hash <ESCROW_CLASS_HASH> \
  --constructor-calldata $env:ADMIN_ADDRESS <VERIFIER_ADDRESS> \
  --account shadowflow-deployer \
  --network sepolia

# Deploy Liquidity Pool with admin + fee as constructor args
sncast deploy \
  --class-hash <LIQUIDITY_POOL_CLASS_HASH> \
  --constructor-calldata $env:ADMIN_ADDRESS 25 \
  --account shadowflow-deployer \
  --network sepolia

# Deploy Buy STRK with rates and addresses
sncast deploy \
  --class-hash <BUY_STRK_CLASS_HASH> \
  --constructor-calldata $env:ADMIN_ADDRESS 50000000000 1000000000000 <STRK_TOKEN_ADDRESS> <ESCROW_ADDRESS> \
  --account shadowflow-deployer \
  --network sepolia

# Deploy Sell STRK with rates and addresses
sncast deploy \
  --class-hash <SELL_STRK_CLASS_HASH> \
  --constructor-calldata $env:ADMIN_ADDRESS 20000 1000000000000 <STRK_TOKEN_ADDRESS> <ESCROW_ADDRESS> \
  --account shadowflow-deployer \
  --network sepolia
```

## Post-Deployment

### 1. Save Addresses

Create `.env.local` with deployed contract addresses:

```env
# Starknet Contracts
VERIFIER_CONTRACT_ADDRESS=0x...
SHADOWFLOW_CONTRACT_ADDRESS=0x...
ESCROW_CONTRACT_ADDRESS=0x...
LIQUIDITY_POOL_ADDRESS=0x...
BUY_STRK_CONTRACT_ADDRESS=0x...
SELL_STRK_CONTRACT_ADDRESS=0x...

# Configuration
STARKNET_RPC_URL=https://api.cartridge.gg/x/starknet/sepolia
ADMIN_ADDRESS=0x...
```

### 2. Initialize Allowlist

```powershell
# Add admin to escrow allowlist
sncast invoke \
  --contract-address <ESCROW_ADDRESS> \
  --function-name add_wallet_to_allowlist \
  --calldata $env:ADMIN_ADDRESS \
  --account shadowflow-deployer \
  --network sepolia

# Verify allowlist
sncast call \
  --contract-address <ESCROW_ADDRESS> \
  --function-name is_wallet_allowed \
  --calldata $env:ADMIN_ADDRESS
```

### 3. Test Deployments

```powershell
# Check GaragaVerifier
sncast call \
  --contract-address <VERIFIER_ADDRESS> \
  --function-name get_btc_rate \
  --network sepolia

# Check Escrow
sncast call \
  --contract-address <ESCROW_ADDRESS> \
  --function-name get_escrow_contract \
  --network sepolia

# Check Liquidity Pool
sncast call \
  --contract-address <LIQUIDITY_POOL_ADDRESS> \
  --function-name get_escrow_contract \
  --network sepolia
```

## Troubleshooting

### sncast/scarb not found
- Ensure installation is in PATH
- Restart PowerShell after installation
- Check versions: `sncast --version` and `scarb --version`

### RPC Connection Error
- Verify `STARKNET_RPC_URL` is correct
- Test RPC: `curl https://api.cartridge.gg/x/starknet/sepolia`
- Try alternative RPC: https://starknet-sepolia.public.blastapi.io

### Insufficient Account Balance
- Deploy to testnet first
- Request testnet ETH from faucet
- Verify account has sufficient balance

### Constructor Arguments Mismatch
- Check contract ABI in `contracts/src/`
- Verify calldata order matches constructor signature
- Use hex encoding for addresses

## Testing Without Deployment

If deployment tools aren't available, you can still test the API routes:

```powershell
# Start dev server
npm run dev

# In another terminal, run API tests
pwsh test-api-routes.ps1
```

The API routes will work with mock contract addresses for development/testing.

## Next Steps

1. ✅ Install Scarb and sncast
2. ✅ Setup Starknet account
3. ✅ Run deployment script
4. ✅ Update `.env.local` with addresses
5. ✅ Run API tests: `pwsh test-api-routes.ps1`
6. ✅ Start dev server: `npm run dev`
