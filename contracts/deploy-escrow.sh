#!/bin/bash

# Escrow Contract Deployment Script
# Deploys EscrowContract to Sepolia testnet and updates backend

set -e

echo "=========================================="
echo "Escrow Contract Deployment"
echo "=========================================="

NETWORK="sepolia"
VERIFIER_ADDRESS="0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a"
ADMIN_ADDRESS="0x731ce505c05b6ebb89e07553c6d2d38ec1d6672dd217e7af4e2f8261fe0274e"

echo ""
echo "Step 1: Compiling escrow contract..."
scarb build
echo "✓ Compilation complete"

echo ""
echo "Step 2: Declaring EscrowContract..."
DECLARE_OUTPUT=$(sncast --profile sepolia declare --contract-name EscrowContract 2>&1)
CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP '(?<=class_hash: )[^ ]*' | head -1)
echo "✓ Class Hash: $CLASS_HASH"

echo ""
echo "Step 3: Deploying EscrowContract..."
echo "Constructor arguments:"
echo "  - admin: $ADMIN_ADDRESS"
echo "  - verifier: $VERIFIER_ADDRESS"
echo ""

DEPLOY_OUTPUT=$(sncast --profile sepolia deploy $CLASS_HASH $ADMIN_ADDRESS $VERIFIER_ADDRESS 2>&1)
ESCROW_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '(?<=contract_address: 0x)[0-9a-f]*' | head -1)

if [ -z "$ESCROW_ADDRESS" ]; then
    ESCROW_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '0x[0-9a-f]{60,}' | head -1)
fi

echo "✓ Escrow Contract Deployed"
echo "✓ Address: 0x$ESCROW_ADDRESS"

echo ""
echo "Step 4: Updating .env.local..."
ENV_FILE="../.env.local"

if grep -q "ESCROW_CONTRACT_ADDRESS" "$ENV_FILE"; then
    sed -i "s/ESCROW_CONTRACT_ADDRESS=.*/ESCROW_CONTRACT_ADDRESS=0x$ESCROW_ADDRESS/" "$ENV_FILE"
    echo "✓ Updated existing ESCROW_CONTRACT_ADDRESS"
else
    echo "ESCROW_CONTRACT_ADDRESS=0x$ESCROW_ADDRESS" >> "$ENV_FILE"
    echo "✓ Added ESCROW_CONTRACT_ADDRESS"
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "Escrow Contract Address: 0x$ESCROW_ADDRESS"
echo ""
echo "Next: Run the backend integration script"
echo ""
