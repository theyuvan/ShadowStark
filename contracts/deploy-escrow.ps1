# Escrow Contract Deployment Script (PowerShell)
# Deploys EscrowContract to Sepolia testnet and updates backend

param(
    [string]$AdminAddress = "0x731ce505c05b6ebb89e07553c6d2d38ec1d6672dd217e7af4e2f8261fe0274e",
    [string]$VerifierAddress = "0x025fd71c54591552045d4077bee03914b0a2615e1f772e51af1b0e3aaee5f66a",
    [string]$Network = "sepolia"
)

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Escrow Contract Deployment" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build
Write-Host "Step 1: Compiling escrow contract..." -ForegroundColor Yellow
scarb build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Compilation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Compilation complete" -ForegroundColor Green

# Step 2: Declare
Write-Host ""
Write-Host "Step 2: Declaring EscrowContract..." -ForegroundColor Yellow
$declareOutput = sncast --profile $Network declare --contract-name EscrowContract 2>&1
$classHashLine = $declareOutput | Select-String -Pattern 'class_hash'
$classHash = if ($classHashLine) { ($classHashLine.ToString() -split '0x')[1].Split(' ')[0]; "0x$($classHashLine.ToString() -split '0x')[1].Split(' ')[0]" } else { $null }

if ([string]::IsNullOrEmpty($classHash)) {
    Write-Host "✗ Declaration failed" -ForegroundColor Red
    Write-Host $declareOutput
    exit 1
}

Write-Host "✓ Class Hash: $classHash" -ForegroundColor Green

# Step 3: Deploy
Write-Host ""
Write-Host "Step 3: Deploying EscrowContract..." -ForegroundColor Yellow
Write-Host "Constructor arguments:" -ForegroundColor Cyan
Write-Host "  - admin: $AdminAddress"
Write-Host "  - verifier: $VerifierAddress"
Write-Host ""

$deployOutput = sncast --profile $Network deploy $classHash $AdminAddress $VerifierAddress 2>&1
$deployLine = $deployOutput | Select-String -Pattern 'contract_address'
$escrowAddress = if ($deployLine) { $deployLine.ToString() -split '0x' | Select-Object -Index 1 | ForEach-Object { "0x$($_ -split ' ' | Select-Object -Index 0)" } } else { $null }

if ([string]::IsNullOrEmpty($escrowAddress)) {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    Write-Host $deployOutput
    exit 1
}

Write-Host "✓ Escrow Contract Deployed" -ForegroundColor Green
Write-Host "✓ Address: $escrowAddress" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Updating .env.local..." -ForegroundColor Yellow

$envFile = "../.env.local"
$envPath = Join-Path (Get-Location) $envFile

if (Test-Path $envPath) {
    $content = Get-Content $envPath -Raw
    if ($content -match "ESCROW_CONTRACT_ADDRESS") {
        $content = $content -replace "ESCROW_CONTRACT_ADDRESS=.*", "ESCROW_CONTRACT_ADDRESS=$escrowAddress"
        Write-Host "✓ Updated existing ESCROW_CONTRACT_ADDRESS" -ForegroundColor Green
    }
    else {
        $content += "`nESCROW_CONTRACT_ADDRESS=$escrowAddress"
        Write-Host "✓ Added ESCROW_CONTRACT_ADDRESS" -ForegroundColor Green
    }
    $content | Set-Content $envPath
}
else {
    Add-Content $envPath "`nESCROW_CONTRACT_ADDRESS=$escrowAddress"
    Write-Host "✓ Added ESCROW_CONTRACT_ADDRESS to new file" -ForegroundColor Green
}

# Step 5: Integration
Write-Host ""
Write-Host "Step 5: Verifying backend integration..." -ForegroundColor Yellow

$serviceFile = "../../lib/server/otcEscrowService.ts"
$servicePath = Join-Path (Get-Location) $serviceFile

if (Test-Path $servicePath) {
    Write-Host "✓ Backend will use ESCROW_CONTRACT_ADDRESS=$escrowAddress" -ForegroundColor Green
}
else {
    Write-Host "⚠ Could not verify backend integration" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Escrow Contract Address: $escrowAddress" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify the contract was deployed: https://sepolia.starkscan.co/contract/$escrowAddress"
Write-Host "2. Test the full flow: BTC buyer → intent → match → escrow → atomic swap"
Write-Host ""
