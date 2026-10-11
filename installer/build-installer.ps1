# Builds installer\Output\ClinicApp-Setup-<version>.exe
#   1. builds the React client
#   2. stages the app, production node_modules and a portable node.exe in installer\stage
#   3. compiles installer\ClinicApp.iss with Inno Setup 6
# Needs: Node.js 20+ x64 (also copied in as the bundled runtime) and Inno Setup 6
#        (winget install JRSoftware.InnoSetup).

param([string]$Version = "1.0.0")

$ErrorActionPreference = "Stop"
$Root  = Split-Path -Parent $PSScriptRoot
$Stage = Join-Path $PSScriptRoot "stage"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# Find the compiler first, so a missing Inno Setup fails before the slow steps
$iscc = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) {
    $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($cmd) { $iscc = $cmd.Source }
}
if (-not $iscc) { throw "Inno Setup 6 not found. Install it with: winget install JRSoftware.InnoSetup" }

$node = (Get-Command node -ErrorAction Stop).Source
Write-Host "Node runtime to bundle: $node ($(& $node --version))"

Step "Building the React client"
Push-Location (Join-Path $Root "client")
try {
    if (-not (Test-Path "node_modules")) {
        npm ci --no-audit --no-fund
        if ($LASTEXITCODE) { throw "client npm ci failed" }
    }
    $env:GENERATE_SOURCEMAP = "false"
    npm run build
    if ($LASTEXITCODE) { throw "client build failed" }
} finally { Pop-Location }

Step "Staging files"
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Stage | Out-Null
foreach ($f in "server.js", "auth.js", "dental.js", "package.json", "package-lock.json", "setup.ps1", "start.bat", "setup-firewall.bat", "README.txt", ".env.example") {
    Copy-Item (Join-Path $Root $f) $Stage
}
New-Item -ItemType Directory -Path (Join-Path $Stage "config") | Out-Null
Copy-Item (Join-Path $Root "config\config.js") (Join-Path $Stage "config")
Copy-Item (Join-Path $Root "models") (Join-Path $Stage "models") -Recurse
New-Item -ItemType Directory -Path (Join-Path $Stage "client") | Out-Null
Copy-Item (Join-Path $Root "client\build") (Join-Path $Stage "client\build") -Recurse

Step "Installing production dependencies"
Push-Location $Stage
try {
    npm ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE) { throw "npm ci failed" }
} finally { Pop-Location }

Step "Bundling portable Node.js"
New-Item -ItemType Directory -Path (Join-Path $Stage "runtime") | Out-Null
Copy-Item $node (Join-Path $Stage "runtime\node.exe")
$license = Join-Path (Split-Path $node) "LICENSE"
if (Test-Path $license) { Copy-Item $license (Join-Path $Stage "runtime\LICENSE") }

Step "Compiling the installer"
& $iscc "/DAppVersion=$Version" (Join-Path $PSScriptRoot "ClinicApp.iss")
if ($LASTEXITCODE) { throw "Inno Setup failed" }

$out = Join-Path $PSScriptRoot "Output\ClinicApp-Setup-$Version.exe"
Write-Host "`nDone: $out ($([math]::Round((Get-Item $out).Length / 1MB, 1)) MB)" -ForegroundColor Green
