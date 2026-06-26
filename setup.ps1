# Clinic Patient Management App - Full Setup Script
# Run as Administrator via setup.bat

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PgPort = "5432"
$PgDb   = "clinic_db"
$PgUser = "postgres"
$DefaultPgPass = "Clinic@2024"
$PgVer  = "16"   # version to install if PostgreSQL not found

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "`n[ERROR] $msg`n" -ForegroundColor Red }

# ── Helpers ──────────────────────────────────────────────────────────────────

function Find-Command($cmd) {
    return (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
}

function Get-PsqlPath {
    # Try PATH first
    $p = Get-Command psql -ErrorAction SilentlyContinue
    if ($p) { return $p.Source }
    # Search common install locations for versions 12-17
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

function Get-PgBinPath($psqlPath) {
    return Split-Path -Parent $psqlPath
}

function Test-PgConnection($psqlPath, $password) {
    $env:PGPASSWORD = $password
    $out = & $psqlPath -U $PgUser -h localhost -p $PgPort -tAc "SELECT 1" 2>&1
    return ($LASTEXITCODE -eq 0)
}

function Invoke-Psql($psqlPath, $password, $sql) {
    $env:PGPASSWORD = $password
    $out = & $psqlPath -U $PgUser -h localhost -p $PgPort -tAc $sql 2>&1
    return @{ Output = $out; OK = ($LASTEXITCODE -eq 0) }
}

# ── Step 1: Node.js ──────────────────────────────────────────────────────────

Write-Step "Checking Node.js..."

if (Find-Command "node") {
    $nodeVer = (node --version)
    Write-OK "Node.js already installed: $nodeVer"
} else {
    Write-Host "    Node.js not found. Downloading and installing (~30 MB)..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v20.15.0/node-v20.15.0-x64.msi"
    $nodeMsi = "$env:TEMP\node_installer.msi"
    try {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
        Start-Process msiexec -ArgumentList "/i `"$nodeMsi`" /qn /norestart" -Wait
        Remove-Item $nodeMsi -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Err "Failed to download/install Node.js: $_"
        Write-Host "  Please install Node.js manually from https://nodejs.org then re-run setup." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"; exit 1
    }
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Find-Command "node") {
        Write-OK "Node.js installed: $(node --version)"
    } else {
        Write-Err "Node.js installed but not found in PATH. Please restart and re-run setup."
        Read-Host "Press Enter to exit"; exit 1
    }
}

# Ensure npm is also on PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

# ── Step 2: PostgreSQL ────────────────────────────────────────────────────────

Write-Step "Checking PostgreSQL..."

$psqlPath  = Get-PsqlPath
$pgInstalled = ($psqlPath -ne $null)
$PgPass    = $DefaultPgPass   # may be overridden below

if ($pgInstalled) {
    Write-OK "PostgreSQL found: $psqlPath"
} else {
    Write-Host "    PostgreSQL not found. Downloading and installing (~300 MB)..." -ForegroundColor Yellow
    Write-Host "    This may take a few minutes..." -ForegroundColor Gray
    $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-$PgVer.3-1-windows-x64.exe"
    $pgExe = "$env:TEMP\pg_installer.exe"
    try {
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgExe -UseBasicParsing
        $pgArgs = "--mode unattended --superpassword `"$PgPass`" --servicename postgresql-$PgVer --serverport $PgPort --prefix `"C:\PostgreSQL`" --datadir `"C:\PostgreSQL\data`""
        Start-Process $pgExe -ArgumentList $pgArgs -Wait
        Remove-Item $pgExe -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Err "Failed to download/install PostgreSQL: $_"
        Write-Host "  Please install PostgreSQL manually from https://www.postgresql.org then re-run setup." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"; exit 1
    }
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User") +
                ";C:\PostgreSQL\bin"
    $psqlPath = Get-PsqlPath
    if ($psqlPath) {
        Write-OK "PostgreSQL installed."
    } else {
        Write-Err "PostgreSQL installed but psql not found. Please restart and re-run setup."
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
        Write-OK "PostgreSQL service running ($($svc.Name))"
    } else {
        Write-Warn "Could not start PostgreSQL service. Attempting to continue..."
    }
} else {
    Write-Warn "No Windows service found for PostgreSQL — assuming it's already running."
}

# ── Step 4: Verify DB connection & get password ───────────────────────────────

Write-Step "Connecting to PostgreSQL..."

$connected = Test-PgConnection $psqlPath $PgPass

if (-not $connected -and $pgInstalled) {
    # Pre-installed PostgreSQL with a different password
    Write-Host ""
    Write-Warn "Cannot connect to PostgreSQL with the default password."
    Write-Host "    Your PostgreSQL installation uses a different password." -ForegroundColor Yellow
    Write-Host "    Please enter the password for the 'postgres' superuser:" -ForegroundColor Cyan
    Write-Host "    (Leave blank to skip DB setup — you can configure it manually later)" -ForegroundColor Gray
    Write-Host ""
    $securePwd = Read-Host "    postgres password" -AsSecureString
    $PgPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd))

    if ($PgPass -eq "") {
        Write-Warn "Skipping database setup. You will need to:"
        Write-Host "    1. Create database '$PgDb' manually in PostgreSQL" -ForegroundColor Gray
        Write-Host "    2. Update the .env file with your postgres password" -ForegroundColor Gray
        $skipDb = $true
    } else {
        $connected = Test-PgConnection $psqlPath $PgPass
        if ($connected) {
            Write-OK "Connected successfully."
        } else {
            Write-Warn "Still cannot connect. Skipping database setup."
            Write-Host "    Please create database '$PgDb' manually and update .env." -ForegroundColor Gray
            $skipDb = $true
        }
    }
} elseif ($connected) {
    Write-OK "Connected to PostgreSQL."
} else {
    Write-Warn "Cannot connect to PostgreSQL. Skipping database setup."
    Write-Host "    The app will try to connect on first launch." -ForegroundColor Gray
    $skipDb = $true
}

# ── Step 5: Create database ───────────────────────────────────────────────────

Write-Step "Setting up database '$PgDb'..."

if ($skipDb) {
    Write-Warn "Skipped (no connection). Configure DB manually then run start.bat."
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
            Write-Host "    You may need to create it manually: CREATE DATABASE $PgDb;" -ForegroundColor Gray
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
    Write-OK ".env file created."
} else {
    Write-OK ".env already exists — keeping existing settings."
}

# ── Step 7: npm install (server) ─────────────────────────────────────────────

Write-Step "Installing server dependencies..."

Set-Location $AppDir
try {
    & npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install returned exit code $LASTEXITCODE" }
    if (-not (Test-Path (Join-Path $AppDir "node_modules"))) { throw "node_modules folder not created" }
    Write-OK "Server dependencies installed."
} catch {
    Write-Err "npm install (server) failed: $_"
    Read-Host "Press Enter to exit"; exit 1
}

# ── Step 8: npm install (client) ─────────────────────────────────────────────

Write-Step "Installing React client dependencies..."

$ClientDir = Join-Path $AppDir "client"
Set-Location $ClientDir
try {
    & npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install returned exit code $LASTEXITCODE" }
    Write-OK "Client dependencies installed."
} catch {
    Write-Err "npm install (client) failed: $_"
    Read-Host "Press Enter to exit"; exit 1
}

# ── Step 9: Build React app ───────────────────────────────────────────────────

Write-Step "Building React app (this may take a minute)..."

$env:CI = "false"   # Prevent warnings being treated as errors
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build returned exit code $LASTEXITCODE" }
    Write-OK "React app built successfully."
} catch {
    Write-Err "React build failed: $_"
    Read-Host "Press Enter to exit"; exit 1
}

Set-Location $AppDir

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
if ($skipDb) {
    Write-Host "  NOTE: Database was not configured automatically." -ForegroundColor Yellow
    Write-Host "  Edit the .env file with your PostgreSQL password" -ForegroundColor Yellow
    Write-Host "  and create the '$PgDb' database manually." -ForegroundColor Yellow
    Write-Host ""
}
Write-Host "  Run start.bat to launch the app." -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close"
