# Complete Escrow Deployment & Integration Guide

## Prerequisites
Make sure you have:
- Scarb installed
- sncast installed
- Starknet wallet funded on Sepolia testnet

## Step-by-Step Commands

### OPTION 1: PowerShell on Windows (RECOMMENDED)

```powershell
# Navigate to contracts directory
cd contracts

# Run the automated deployment & integration script
.\deploy-escrow.ps1 `
  -AdminAddress "0x731ce505c05b6ebb89e07553c6d2d38ec1d6672dd217e7af4e2f8261fe0274e" `
  -VerifierAddress "0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a" `
  -Network "sepolia"
```

### OPTION 2: Manual Step-by-Step (Any OS)

#### Step 1: Build the contract
```bash
cd contracts
scarb build
```

#### Step 2: Declare the contract class
```bash
sncast --profile sepolia declare --contract-name EscrowContract
```
**Save the output class_hash** (looks like `0x...`)

#### Step 3: Deploy with constructor arguments
```bash
sncast --profile sepolia deploy <CLASS_HASH> \
  0x731ce505c05b6ebb89e07553c6d2d38ec1d6672dd217e7af4e2f8261fe0274e \
  0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a
```

**Save the output contract_address** (looks like `contract_address: 0x...`)

#### Step 4: Update .env.local
Add this line to `.env.local`:
```
ESCROW_CONTRACT_ADDRESS=0x<YOUR_DEPLOYED_ADDRESS>
```

#### Step 5: Verify it's integrated
The backend will automatically pick up the address from `.env.local` when the next request comes in.

---

## What Gets Deployed

The EscrowContract includes:
- ✅ Wallet allowlist management (admin-only)
- ✅ Token allowlist management (admin-only)
- ✅ Escrow deposit creation with ZK proof hash
- ✅ Escrow locking with proof verification
- ✅ Escrow release (admin-only)
- ✅ Escrow refund (if settlement fails)

---

## After Deployment

### 1. Verify on Starkscan
```
https://sepolia.starkscan.co/contract/<YOUR_ESCROW_ADDRESS>
```

### 2. Test the E2E flow
```
BTC Buyer → Create Intent → Matched with STRK Seller
  → Both Approve Match → Escrow Funding → Atomic Swap via TEE
```

### 3. Debug if needed
Check backend logs:
```
ESCROW_CONTRACT_ADDRESS detected: 0x...
Calling create_escrow_deposit()
Calling lock_escrow_with_proof()
Calling release_escrow()
```

---

## Constructor Arguments Explained

| Arg | Value | Purpose |
|-----|-------|---------|
| `admin` | `0x731ce505...` | Admin wallet - can add wallets/tokens to allowlists |
| `verifier` | `0x025fd71c...` | ShadowFlow contract - used to verify ZK proofs before releasing funds |

---

## Quick Reference - Environment Variables

**After deployment, your .env.local should have:**
```
ESCROW_CONTRACT_ADDRESS=0x<NEW_ADDRESS>
NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS=0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a
NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS=0x065071fc0289ffc7ce91dc4e4c65cd7216a9bc311e475b18758a30268fdb1801
```

---

## Troubleshooting

**Error: "Contract not found"**
- Make sure you copied the full contract address (with 0x prefix)
- Check Starkscan to confirm deployment succeeded

**Error: "Class hash not found"**
- Run `scarb build` again to compile
- Make sure you're on the correct Starknet network (sepolia)

**Backend not picking up new address**
- Restart dev server: `npm run dev`
- Check `.env.local` was updated correctly

