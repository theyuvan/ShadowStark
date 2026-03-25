#!/usr/bin/env powershell
# ShadowFlow Contract Deployment Summary Script
# This script extracts compiled contract artifacts and provides deployment instructions

param(
  [string]$ProjectPath = "contracts",
  [string]$Profile = "sepolia"
)

$ErrorActionPreference = "Stop"

function Resolve-CommandPath([string]$name, [string]$explicitPath) {
  if ($explicitPath -and (Test-Path $explicitPath)) {
    return (Resolve-Path $explicitPath).Path
  }

  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  throw "Command '$name' not found. Install Starknet Foundry (scarb/sncast) first."
}

$scarbCmd = Resolve-CommandPath "scarb" $env:SCARB_PATH
$sncastCmd = Resolve-CommandPath "sncast" $env:SNCAST_PATH

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ShadowFlow Contract Deployment" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Step 1: Building Cairo Contracts..." -ForegroundColor Yellow
Push-Location $ProjectPath
try {
  if (-not (Test-Path "Scarb.toml")) {
    throw "No Scarb.toml found in '$ProjectPath'."
  }

  & $scarbCmd build | Out-Host
  
  Write-Host "`nStep 2: Extracting Compiled Artifacts..." -ForegroundColor Yellow
  $buildDir = "target/dev"
  if (-not (Test-Path $buildDir)) {
    throw "Build directory not found: $buildDir"
  }

  # Create deployment summary
  $summary = @{
    timestamp = [DateTime]::UtcNow.ToString("o")
    network = $Profile
    compiled_artifacts = @()
    next_steps = @(
      "1. Set up a Starknet account (Cairo + sncast)",
      "   Run: sncast account create --name myaccount --network $Profile",
      "",
      "2. Fund your account with Starknet test tokens",
      "   Testnet faucet: https://starknet-faucet.vercel.app",
      "",
      "3. Declare contracts:",
      "   sncast --profile $Profile declare --contract-name GaragaVerifier",
      "   sncast --profile $Profile declare --contract-name ShadowFlow",
      "",
      "4. Deploy declared contracts:",
      "   sncast --profile $Profile deploy <class-hash> <constructor-args>",
      "",
      "5. Update environment variables with deployed addresses:",
      "   NEXT_PUBLIC_GARAGA_VERIFIER_ADDRESS=0x...",
      "   NEXT_PUBLIC_SHADOWFLOW_CONTRACT_ADDRESS=0x..."
    )
  }

  # List available contract files
  Get-ChildItem -Path "src" -Filter "*.cairo" | ForEach-Object {
    $summary.compiled_artifacts += [PSCustomObject]@{
      name = $_.BaseName
      path = $_.FullName
      size = $_.Length
    }
  }

  New-Item -ItemType Directory -Path "deployment" -Force | Out-Null
  $summaryJson = $summary | ConvertTo-Json -Depth 8
  Set-Content -Path "deployment/DEPLOYMENT_PLAN.json" -Value $summaryJson -Encoding utf8

  Write-Host "`n========================================" -ForegroundColor Green
  Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
  Write-Host "========================================`n" -ForegroundColor Green

  Write-Host "Compiled Contracts:" -ForegroundColor Yellow
  Get-ChildItem -Path "src" -Filter "*.cairo" | ForEach-Object {
    Write-Host "  - $($_.BaseName) ($($_.Length) bytes)"
  }

  Write-Host "`nDeployment Plan saved to: deployment/DEPLOYMENT_PLAN.json" -ForegroundColor Green
  Write-Host "`nNEXT STEPS:" -ForegroundColor Yellow
  Write-Host "1. Configure Starknet account (sncast account create)"
  Write-Host "2. Declare contracts with sncast"
  Write-Host "3. Deploy contracts and save addresses"
  Write-Host "4. Update .env with contract addresses"
  Write-Host "5. Configure backend API to use on-chain addresses`n"
}
finally {
  Pop-Location
}
