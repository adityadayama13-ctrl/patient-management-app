# Clinic Patient Management App - Full Setup Script
# Run as Administrator via setup.bat

$ErrorActionPreference = "Stop"
$AppDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$PgPass  = "Clinic@2024"
$PgPort  = "5432"
$PgDb    = "clinic_db"
$PgUser  = "postgres"
$PgVer   = "16"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "`n[ERROR] $msg" -ForegroundColor Red }

# ── Helpers ──────────────────────────────────────────────────────────────────

function Find-Command($cmd) {
    return (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
}

function Get-PsqlPath {
    # Try PATH first
    $p = Get-Command psql -ErrorAction SilentlyContinue
    if ($p) { return $p.Source }
    # Search common install locations
    $dirs = @(
        "C:\Program Files\PostgreSQL\$PgVer\bin",
        "C:\Program Files\PostgreSQL\15\bin",
        "C:\Program Files\PostgreSQL\14\bin",
        "C:\Program Files\PostgreSQL\13\bin"
    )
    foreach ($d in $dirs) {
        $psql = Join-Path $d "psql.exe"
        if (Test-Path $psql) { return $psql }
    }
    return $null
}

function Psql-Run($sql, [string]$psqlPath = "") {
    if (-not $psqlPath) { $psqlPath = Get-PsqlPath }
    $env:PGPASSWORD = $PgPass
    $result = & $psqlPath -U $PgUser -h localhost -p $PgPort -c $sql 2>&1
    return $result
}

# ── Step 1: Node.js ──────────────────────────────────────────────────────────

Write-Step "Checking Node.js..."

if (Find-Command "node") {
    $nodeVer = (node --version)
    Write-OK "Node.js already installed: $nodeVer"
} else {
    Write-Host "    Node.js not found. Downloading and installing..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v20.15.0/node-v20.15.0-x64.msi"
    $nodeMsi = "$env:TEMP\node_installer.msi"
    Write-Host "    Downloading Node.js (~30 MB)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
    Write-Host "    Installing Node.js (silent)..." -ForegroundColor Gray
    Start-Process msiexec -ArgumentList "/i `"$nodeMsi`" /qn /norestart" -Wait
    Remove-Item $nodeMsi -Force -ErrorAction SilentlyContinue
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Find-Command "node") {
        Write-OK "Node.js installed: $(node --version)"
    } else {
        Write-Err "Node.js installation failed. Please install manually from https://nodejs.org"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ── Step 2: PostgreSQL ────────────────────────────────────────────────────────

Write-Step "Checking PostgreSQL..."

$psqlPath = Get-PsqlPath

if ($psqlPath) {
    Write-OK "PostgreSQL already installed: $psqlPath"
} else {
    Write-Host "    PostgreSQL not found. Downloading and installing..." -ForegroundColor Yellow
    $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64.exe"
    $pgExe = "$env:TEMP\pg_installer.exe"
    Write-Host "    Downloading PostgreSQL (~300 MB) - this may take a few minutes..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $pgUrl -OutFile $pgExe -UseBasicParsing
    Write-Host "    Installing PostgreSQL (silent)..." -ForegroundColor Gray
    $pgArgs = "--mode unattended --superpassword `"$PgPass`" --servicename postgresql-$PgVer --serverport $PgPort --prefix `"C:\PostgreSQL`" --datadir `"C:\PostgreSQL\data`""
    Start-Process $pgExe -ArgumentList $pgArgs -Wait
    Remove-Item $pgExe -Force -ErrorAction SilentlyContinue
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\PostgreSQL\bin"
    $psqlPath = Get-PsqlPath
    if ($psqlPath) {
        Write-OK "PostgreSQL installed."
    } else {
        Write-Err "PostgreSQL installation failed. Please install manually from https://www.postgresql.org"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ── Step 3: Ensure PostgreSQL service is running ──────────────────────────────

Write-Step "Starting PostgreSQL service..."

$svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($svc) {
    if ($svc.Status -ne "Running") {
        Start-Service $svc.Name
        Start-Sleep 3
    }
    Write-OK "PostgreSQL service running ($($svc.Name))"
} else {
    Write-Warn "No PostgreSQL service found - assuming it's running on port $PgPort."
}

# ── Step 4: Create database ───────────────────────────────────────────────────

Write-Step "Setting up database '$PgDb'..."

$env:PGPASSWORD = $PgPass
$checkDb = & $psqlPath -U $PgUser -h localhost -p $PgPort -tAc "SELECT 1 FROM pg_database WHERE datname='$PgDb'" 2>&1
if ($checkDb -match "1") {
    Write-OK "Database '$PgDb' already exists."
} else {
    $createDb = & $psqlPath -U $PgUser -h localhost -p $PgPort -c "CREATE DATABASE $PgDb;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Database '$PgDb' created."
    } else {
        Write-Warn "Could not create database (it may already exist): $createDb"
    }
}

# ── Step 5: Write .env ────────────────────────────────────────────────────────

Write-Step "Writing configuration..."

$envPath = Join-Path $AppDir ".env"
if (-not (Test-Path $envPath)) {
    @"
DB_HOST=localhost
DB_PORT=$PgPort
DB_NAME=$PgDb
DB_USER=$PgUser
DB_PASSWORD=$PgPass
PORT=5000
"@ | Set-Content $envPath -Encoding utf8
    Write-OK ".env file created with default settings."
} else {
    Write-OK ".env file already exists - keeping existing settings."
}

# ── Step 6: npm install (server) ─────────────────────────────────────────────

Write-Step "Installing server dependencies..."
Set-Location $AppDir
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    # Refresh PATH after Node install
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install (server) failed."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-OK "Server dependencies installed."

# ── Step 7: npm install (client) ─────────────────────────────────────────────

Write-Step "Installing React client dependencies..."
$ClientDir = Join-Path $AppDir "client"
Set-Location $ClientDir
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install (client) failed."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-OK "Client dependencies installed."

# ── Step 8: Build React app ───────────────────────────────────────────────────

Write-Step "Building React app for production (this may take a minute)..."
Set-Location $ClientDir
$env:CI = "false"   # Prevent warnings being treated as errors
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Err "React build failed."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-OK "React app built successfully."

Set-Location $AppDir

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Default database password: $PgPass" -ForegroundColor White
Write-Host "  You can change it in the .env file." -ForegroundColor Gray
Write-Host ""
Write-Host "  Run start.bat to launch the app." -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close"
