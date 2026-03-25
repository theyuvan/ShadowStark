param(
  [string]$ProjectPath = "contracts",
  [string]$Profile = "sepolia",
  [string]$ScarbPath = $env:SCARB_PATH,
  [string]$SncastPath = $env:SNCAST_PATH
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

  $userHome = [Environment]::GetFolderPath("UserProfile")
  $candidates = @(
    (Join-Path $userHome ".cargo\\bin\\$name.exe"),
    (Join-Path $userHome ".local\\bin\\$name.exe"),
    (Join-Path $userHome "scoop\\shims\\$name.exe"),
    (Join-Path $userHome "AppData\\Local\\Programs\\$name\\$name.exe")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  throw "Missing required command '$name'. Add it to PATH, or set $($name.ToUpper())_PATH (for example SCARB_PATH/SNCAST_PATH)."
}

function Ensure-CommandPath([string]$name, [string]$pathValue) {
  if (-not (Test-Path $pathValue)) {
    throw "Resolved path for '$name' does not exist: $pathValue"
  }

  return $pathValue
}

function Extract-HexValue([string]$text, [string]$label) {
  $regex = [regex]"$label\s*[:=]\s*(0x[0-9a-fA-F]+)"
  $match = $regex.Match($text)
  if (-not $match.Success) {
    throw "Could not parse '$label' from command output.`nOutput:`n$text"
  }
  return $match.Groups[1].Value
}

$scarbCmd = Ensure-CommandPath "scarb" (Resolve-CommandPath "scarb" $ScarbPath)
$sncastCmd = Ensure-CommandPath "sncast" (Resolve-CommandPath "sncast" $SncastPath)

Write-Host "Using scarb:  $scarbCmd"
Write-Host "Using sncast: $sncastCmd"

Push-Location $ProjectPath
try {
  if (-not (Test-Path "Scarb.toml")) {
    throw "No Scarb.toml found in '$ProjectPath'. Initialize a Starknet package first."
  }

  Write-Host "[1/5] Building Cairo contracts..."
  & $scarbCmd build | Out-Host

  Write-Host "[2/5] Declaring GaragaVerifier..."
  $declareVerifierOutput = & $sncastCmd --profile $Profile declare --contract-name GaragaVerifier | Out-String
  $verifierClassHash = Extract-HexValue $declareVerifierOutput "class_hash"

  Write-Host "[3/5] Deploying GaragaVerifier..."
  $deployVerifierOutput = & $sncastCmd --profile $Profile deploy --class-hash $verifierClassHash | Out-String
  $garagaAddress = Extract-HexValue $deployVerifierOutput "contract_address"

  Write-Host "[4/5] Declaring ShadowFlow..."
  $declareShadowOutput = & $sncastCmd --profile $Profile declare --contract-name ShadowFlow | Out-String
  $shadowClassHash = Extract-HexValue $declareShadowOutput "class_hash"

  Write-Host "[5/5] Deploying ShadowFlow..."
  $initialRoot = "0x0"
  $deployShadowOutput = & $sncastCmd --profile $Profile deploy --class-hash $shadowClassHash --constructor-calldata $garagaAddress $initialRoot | Out-String
  $shadowAddress = Extract-HexValue $deployShadowOutput "contract_address"

  $result = [ordered]@{
    network = $Profile
    garagaVerifierAddress = $garagaAddress
    shadowFlowAddress = $shadowAddress
    declaredClassHashes = [ordered]@{
      garagaVerifier = $verifierClassHash
      shadowFlow = $shadowClassHash
    }
    deployedAt = [DateTime]::UtcNow.ToString("o")
  }

  New-Item -ItemType Directory -Path "deployment" -Force | Out-Null
  $json = $result | ConvertTo-Json -Depth 8
  Set-Content -Path "deployment/deployed-addresses.json" -Value $json -Encoding utf8

  Write-Host "Deployment complete."
  Write-Host "GaragaVerifier: $garagaAddress"
  Write-Host "ShadowFlow:    $shadowAddress"
  Write-Host "Saved:         $ProjectPath/deployment/deployed-addresses.json"
}
finally {
  Pop-Location
}
