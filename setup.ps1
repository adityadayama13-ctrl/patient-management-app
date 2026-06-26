# Clinic Patient Management App - Setup Script
# Run as Administrator via setup.bat
# Node.js and node_modules are pre-bundled in this package.
# This script only sets up PostgreSQL and the database.

$AppDir        = Split-Path -Parent $MyInvocation.MyCommand.Path
$PgPort        = "5432"
$PgDb          = "clinic_db"
$PgUser        = "postgres"
$DefaultPgPass = "Clinic@2024"
$PgVer         = "16"   # version to install if PostgreSQL is missing

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "`n[ERROR] $msg`n" -ForegroundColor Red }

# ── Helpers ──────────────────────────────────────────────────────────────────

function Get-PsqlPath {
    $p = Get-Command psql -ErrorAction SilentlyContinue
    if ($p) { return $p.Source }
    $versions = @(17, 16, 15, 14, 13, 12)
    $drives   = @("C:", "D:")
    foreach ($drv in $drives) {
        foreach ($v in $versions) {
            foreach ($base in @("$drv\Program Files\PostgreSQL\$v\bin", "$drv\PostgreSQL\$v\bin")) {
                $psql = Join-Path $base "psql.exe"
                if (Test-Path $psql) { return $psql }
            }
        }
    }
    return $null
}

function Test-PgConnection($psqlPath, $password) {
    $env:PGPASSWORD = $password
    & $psqlPath -U $PgUser -h localhost -p $PgPort -tAc "SELECT 1" 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Invoke-Psql($psqlPath, $password, $sql) {
    $env:PGPASSWORD = $password
    $out = & $psqlPath -U $PgUser -h localhost -p $PgPort -tAc $sql 2>&1
    return @{ Output = $out; OK = ($LASTEXITCODE -eq 0) }
}

# ── Step 1: Bundled Node.js check ────────────────────────────────────────────

Write-Step "Checking bundled Node.js..."

$nodeExe = Join-Path $AppDir "runtime\node.exe"
if (Test-Path $nodeExe) {
    $nodeVer = & $nodeExe --version
    Write-OK "Bundled Node.js ready: $nodeVer"
} else {
    Write-Warn "Bundled Node.js not found at runtime\node.exe"
    Write-Host "    Checking system Node.js..." -ForegroundColor Gray
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-OK "System Node.js found: $(node --version)"
    } else {
        Write-Err "Node.js not found. Please re-extract the full app zip or install from https://nodejs.org"
        Read-Host "Press Enter to exit"; exit 1
    }
}

# ── Step 2: PostgreSQL ────────────────────────────────────────────────────────

Write-Step "Checking PostgreSQL..."

$psqlPath   = Get-PsqlPath
$pgInstalled = ($psqlPath -ne $null)
$PgPass     = $DefaultPgPass

if ($pgInstalled) {
    Write-OK "PostgreSQL found: $psqlPath"
} else {
    Write-Host "    PostgreSQL not found. Downloading installer (~300 MB)..." -ForegroundColor Yellow
    Write-Host "    This may take several minutes..." -ForegroundColor Gray
    $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-$PgVer.3-1-windows-x64.exe"
    $pgExe = "$env:TEMP\pg_installer.exe"
    try {
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgExe -UseBasicParsing
        $pgArgs = "--mode unattended --superpassword `"$PgPass`" --servicename postgresql-$PgVer --serverport $PgPort --prefix `"C:\PostgreSQL`" --datadir `"C:\PostgreSQL\data`""
        Start-Process $pgExe -ArgumentList $pgArgs -Wait
        Remove-Item $pgExe -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Err "Failed to download/install PostgreSQL: $_"
        Write-Host "  Please install from https://www.postgresql.org then re-run setup." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"; exit 1
    }
    $env:Path += ";C:\PostgreSQL\bin"
    $psqlPath = Get-PsqlPath
    if ($psqlPath) {
        Write-OK "PostgreSQL installed."
    } else {
        Write-Err "PostgreSQL installed but psql.exe not found. Please restart and re-run setup."
        Read-Host "Press Enter to exit"; exit 1
    }
}

# ── Step 3: Start PostgreSQL service ─────────────────────────────────────────

Write-Step "Checking PostgreSQL service..."

$svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($svc) {
    if ($svc.Status -ne "Running") {
        try { Start-Service $svc.Name; Start-Sleep 3 } catch {}
    }
    $svc.Refresh()
    if ($svc.Status -eq "Running") {
        Write-OK "Service running: $($svc.Name)"
    } else {
        Write-Warn "Could not start service. Attempting to continue..."
    }
} else {
    Write-Warn "No Windows service found — assuming PostgreSQL is running on port $PgPort."
}

# ── Step 4: Verify connection ─────────────────────────────────────────────────

Write-Step "Connecting to PostgreSQL..."

$skipDb  = $false
$connected = Test-PgConnection $psqlPath $PgPass

if (-not $connected -and $pgInstalled) {
    Write-Host ""
    Write-Warn "Cannot connect with default password."
    Write-Host "    Your PostgreSQL has a different password for the 'postgres' user." -ForegroundColor Yellow
    Write-Host "    Enter it below (or press Enter to skip DB setup):" -ForegroundColor Cyan
    Write-Host ""
    $securePwd = Read-Host "    postgres password" -AsSecureString
    $PgPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd))

    if ($PgPass -eq "") {
        Write-Warn "Skipping database setup."
        Write-Host "    Manually create database '$PgDb' in PostgreSQL and update the .env file." -ForegroundColor Gray
        $skipDb = $true
    } else {
        $connected = Test-PgConnection $psqlPath $PgPass
        if ($connected) {
            Write-OK "Connected."
        } else {
            Write-Warn "Still cannot connect. Skipping database setup."
            $skipDb = $true
        }
    }
} elseif ($connected) {
    Write-OK "Connected."
} else {
    Write-Warn "Cannot connect. Skipping database setup."
    $skipDb = $true
}

# ── Step 5: Create database ───────────────────────────────────────────────────

Write-Step "Setting up database '$PgDb'..."

if ($skipDb) {
    Write-Warn "Skipped. Configure the database manually then run start.bat."
} else {
    $check = Invoke-Psql $psqlPath $PgPass "SELECT 1 FROM pg_database WHERE datname='$PgDb'"
    if ($check.Output -match "1") {
        Write-OK "Database '$PgDb' already exists."
    } else {
        $create = Invoke-Psql $psqlPath $PgPass "CREATE DATABASE $PgDb"
        if ($create.OK) {
            Write-OK "Database '$PgDb' created."
        } else {
            Write-Warn "Could not create database: $($create.Output)"
            Write-Host "    Run manually: CREATE DATABASE $PgDb;" -ForegroundColor Gray
        }
    }
}

# ── Step 6: Write .env ────────────────────────────────────────────────────────

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
    Write-OK ".env created."
} else {
    Write-OK ".env already exists — keeping existing settings."
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
if ($skipDb) {
    Write-Host "  NOTE: Database was not configured." -ForegroundColor Yellow
    Write-Host "  Edit .env with your PostgreSQL password" -ForegroundColor Yellow
    Write-Host "  and create database '$PgDb' manually." -ForegroundColor Yellow
    Write-Host ""
}
Write-Host "  Run start.bat to launch the app." -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close"
