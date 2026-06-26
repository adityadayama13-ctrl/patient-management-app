# Clinic Patient Management App - Setup Script
# Run as Administrator via setup.bat
# Node.js and node_modules are pre-bundled in this package.
# This script sets up PostgreSQL, cleans residues, and creates the database.

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
function Write-Info($msg) { Write-Host "    --> $msg" -ForegroundColor Gray }

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

function Test-PortInUse($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return ($conn -ne $null)
}

function Get-ProcessOnPort($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) { return $null }
    return Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
}

# ══════════════════════════════════════════════════════════════════════════════
# Step 0: Pre-installation cleanup
# ══════════════════════════════════════════════════════════════════════════════

Write-Step "Scanning for previous installation residues..."

$cleanupDone = $false

# ── 0a: Remove leftover temp installer files ──────────────────────────────────
$tempFiles = @(
    "$env:TEMP\pg_installer.exe",
    "$env:TEMP\node_installer.msi",
    "$env:TEMP\node-portable.zip"
)
foreach ($f in $tempFiles) {
    if (Test-Path $f) {
        Remove-Item $f -Force -ErrorAction SilentlyContinue
        Write-OK "Removed leftover temp file: $(Split-Path -Leaf $f)"
        $cleanupDone = $true
    }
}

# ── 0b: Detect multiple conflicting PostgreSQL services ───────────────────────
$allPgSvcs = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($allPgSvcs.Count -gt 1) {
    Write-Warn "Multiple PostgreSQL services detected:"
    foreach ($s in $allPgSvcs) {
        Write-Info "$($s.Name) — $($s.Status)"
    }
    Write-Host "    This can cause port conflicts. Only one should be Running." -ForegroundColor Yellow
    Write-Host "    Setup will use the first running service." -ForegroundColor Gray
    $cleanupDone = $true
}

# ── 0c: Check for stale PostgreSQL PID file (crashed previous instance) ────────
$stalePidPaths = @(
    "C:\PostgreSQL\data\postmaster.pid",
    "C:\Program Files\PostgreSQL\$PgVer\data\postmaster.pid",
    "C:\Program Files\PostgreSQL\17\data\postmaster.pid",
    "C:\Program Files\PostgreSQL\15\data\postmaster.pid"
)
foreach ($pidFile in $stalePidPaths) {
    if (Test-Path $pidFile) {
        # Check if the PID inside is actually running
        $pidContent = Get-Content $pidFile -ErrorAction SilentlyContinue
        $pid = if ($pidContent) { [int]($pidContent[0].Trim()) } else { 0 }
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if (-not $proc) {
            Write-Warn "Stale PostgreSQL PID file found (process no longer running): $pidFile"
            try {
                Remove-Item $pidFile -Force
                Write-OK "Removed stale PID file — PostgreSQL can now start cleanly."
            } catch {
                Write-Warn "Could not remove PID file automatically. Delete it manually: $pidFile"
            }
            $cleanupDone = $true
        }
    }
}

# ── 0d: Detect broken partial PostgreSQL install (folder exists, no service) ──
$partialDirs = @("C:\PostgreSQL", "D:\PostgreSQL")
foreach ($dir in $partialDirs) {
    if (Test-Path $dir) {
        $hasBin = Test-Path (Join-Path $dir "bin\psql.exe")
        $hasSvc = ($allPgSvcs -ne $null -and $allPgSvcs.Count -gt 0)
        if (-not $hasBin -and -not $hasSvc) {
            Write-Warn "Partial PostgreSQL install directory found with no working binary: $dir"
            Write-Host "    This leftover folder may interfere with a fresh install." -ForegroundColor Yellow
            $ans = Read-Host "    Remove it? (Y/N)"
            if ($ans -match "^[Yy]") {
                try {
                    Remove-Item $dir -Recurse -Force
                    Write-OK "Removed $dir"
                } catch {
                    Write-Warn "Could not remove $dir — you may need to delete it manually."
                }
            }
            $cleanupDone = $true
        }
    }
}

# ── 0e: Check for port conflicts ──────────────────────────────────────────────
if (Test-PortInUse 5432) {
    $proc = Get-ProcessOnPort 5432
    $name = if ($proc) { $proc.ProcessName } else { "unknown" }
    if ($name -notmatch "postgres") {
        Write-Warn "Port 5432 is in use by '$name' (not PostgreSQL)."
        Write-Host "    This will prevent PostgreSQL from starting." -ForegroundColor Yellow
        Write-Host "    Stop '$name' or change its port before continuing." -ForegroundColor Gray
        $cleanupDone = $true
    }
}

if (Test-PortInUse 5000) {
    $proc = Get-ProcessOnPort 5000
    $name = if ($proc) { $proc.ProcessName } else { "unknown" }
    Write-Warn "Port 5000 is already in use by '$name'."
    Write-Host "    The clinic app may not start. Stop '$name' or change PORT in .env." -ForegroundColor Gray
    $cleanupDone = $true
}

# ── 0f: Remove stale Windows Firewall rule (will recreate correctly later) ────
$fwRule = Get-NetFirewallRule -DisplayName "Clinic App (Port 5000)" -ErrorAction SilentlyContinue
if ($fwRule) {
    try {
        Remove-NetFirewallRule -DisplayName "Clinic App (Port 5000)" -ErrorAction SilentlyContinue
        Write-OK "Removed old firewall rule (will recreate with correct settings)."
        $cleanupDone = $true
    } catch {}
}

if (-not $cleanupDone) {
    Write-OK "No residues found — system is clean."
}

# ── 0g: Add/refresh Windows Firewall rule for port 5000 ──────────────────────
try {
    New-NetFirewallRule -DisplayName "Clinic App (Port 5000)" `
        -Direction Inbound -Protocol TCP -LocalPort 5000 `
        -Action Allow -Profile Private `
        -Description "Allow clinic staff on LAN to access the Clinic App" `
        -ErrorAction Stop | Out-Null
    Write-OK "Firewall rule set: TCP 5000 inbound (Private networks)."
} catch {
    Write-Warn "Could not set firewall rule automatically: $_"
    Write-Info "Run setup-firewall.bat as Administrator to set it manually."
}

# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Bundled Node.js check
# ══════════════════════════════════════════════════════════════════════════════

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

# ══════════════════════════════════════════════════════════════════════════════
# Step 2: PostgreSQL
# ══════════════════════════════════════════════════════════════════════════════

Write-Step "Checking PostgreSQL..."

$psqlPath    = Get-PsqlPath
$pgInstalled = ($psqlPath -ne $null)
$PgPass      = $DefaultPgPass

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

# ══════════════════════════════════════════════════════════════════════════════
# Step 3: Start PostgreSQL service
# ══════════════════════════════════════════════════════════════════════════════

Write-Step "Checking PostgreSQL service..."

$svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Running" } | Select-Object -First 1
if (-not $svc) {
    $svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
}

if ($svc) {
    if ($svc.Status -ne "Running") {
        try { Start-Service $svc.Name; Start-Sleep 3 } catch {}
    }
    $svc.Refresh()
    if ($svc.Status -eq "Running") {
        Write-OK "Service running: $($svc.Name)"
    } else {
        Write-Warn "Could not start PostgreSQL service ($($svc.Name)). Attempting to continue..."
    }
} else {
    Write-Warn "No Windows service found — assuming PostgreSQL is running on port $PgPort."
}

# ══════════════════════════════════════════════════════════════════════════════
# Step 4: Verify connection
# ══════════════════════════════════════════════════════════════════════════════

Write-Step "Connecting to PostgreSQL..."

$skipDb    = $false
$connected = Test-PgConnection $psqlPath $PgPass

if (-not $connected -and $pgInstalled) {
    Write-Host ""
    Write-Warn "Cannot connect with the default password."
    Write-Host "    Your PostgreSQL has a different password for the 'postgres' user." -ForegroundColor Yellow
    Write-Host "    Enter it below (or press Enter to skip DB setup):" -ForegroundColor Cyan
    Write-Host ""
    $securePwd = Read-Host "    postgres password" -AsSecureString
    $PgPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd))

    if ($PgPass -eq "") {
        Write-Warn "Skipping database setup."
        Write-Info "Manually create database '$PgDb' in PostgreSQL and update the .env file."
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

# ══════════════════════════════════════════════════════════════════════════════
# Step 5: Database setup (with upgrade vs fresh-install choice)
# ══════════════════════════════════════════════════════════════════════════════

Write-Step "Setting up database '$PgDb'..."

if ($skipDb) {
    Write-Warn "Skipped. Configure the database manually then run start.bat."
} else {
    $check = Invoke-Psql $psqlPath $PgPass "SELECT 1 FROM pg_database WHERE datname='$PgDb'"
    $dbExists = ($check.Output -match "1")

    if ($dbExists) {
        Write-Host ""
        Write-Host "    Database '$PgDb' already exists from a previous installation." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "    [1] Keep existing data (upgrade)  — recommended for reinstalls" -ForegroundColor White
        Write-Host "    [2] Delete and recreate           — fresh start, ALL DATA WILL BE LOST" -ForegroundColor Red
        Write-Host ""
        $choice = Read-Host "    Enter 1 or 2"

        if ($choice -eq "2") {
            Write-Host ""
            $confirm = Read-Host "    Type YES to confirm deleting all clinic data"
            if ($confirm -eq "YES") {
                # Terminate active connections first
                Invoke-Psql $psqlPath $PgPass "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$PgDb' AND pid <> pg_backend_pid()" | Out-Null
                $drop = Invoke-Psql $psqlPath $PgPass "DROP DATABASE IF EXISTS $PgDb"
                if ($drop.OK) {
                    Write-OK "Old database dropped."
                    $dbExists = $false
                } else {
                    Write-Warn "Could not drop database: $($drop.Output)"
                    Write-Info "Keeping existing database."
                }
            } else {
                Write-Warn "Not confirmed — keeping existing data."
            }
        } else {
            Write-OK "Keeping existing data (upgrade mode)."
        }
    }

    if (-not $dbExists) {
        $create = Invoke-Psql $psqlPath $PgPass "CREATE DATABASE $PgDb"
        if ($create.OK) {
            Write-OK "Database '$PgDb' created."
        } else {
            Write-Warn "Could not create database: $($create.Output)"
            Write-Info "Run manually in psql: CREATE DATABASE $PgDb;"
        }
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# Step 6: Write .env
# ══════════════════════════════════════════════════════════════════════════════

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
    # If the password changed (user entered a different one), update it
    $existing = Get-Content $envPath -Raw
    if ($existing -notmatch [regex]::Escape("DB_PASSWORD=$PgPass")) {
        $existing = $existing -replace "DB_PASSWORD=.*", "DB_PASSWORD=$PgPass"
        Set-Content $envPath $existing -Encoding utf8 -NoNewline
        Write-OK ".env updated with current password."
    } else {
        Write-OK ".env already exists — settings unchanged."
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# Done
# ══════════════════════════════════════════════════════════════════════════════

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
