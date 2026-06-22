@echo off
title Clinic App - Firewall Setup
color 0A

:: Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ============================================
    echo   ERROR: Please run as Administrator
    echo.
    echo   Right-click this file and choose
    echo   "Run as administrator"
    echo ============================================
    pause
    exit /b 1
)

echo ============================================
echo   Clinic App - Firewall Setup
echo ============================================
echo.

:: Remove old rule if it exists
netsh advfirewall firewall delete rule name="Clinic App (Port 5000)" >nul 2>&1

:: Add inbound rule for port 5000 (Private networks only)
netsh advfirewall firewall add rule ^
    name="Clinic App (Port 5000)" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=5000 ^
    profile=private ^
    description="Allow clinic staff on the same WiFi to access the Clinic Patient Management app" ^
    enable=yes

if %errorlevel% equ 0 (
    echo.
    echo [OK] Firewall rule added successfully.
    echo.
    echo   Clinic devices on the same WiFi can now
    echo   open the app at:
    echo.
    for /f %%H in ('hostname') do set HOSTNAME=%%H
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
        set RAW=%%a
        goto :found
    )
    :found
    set IP=%RAW: =%
    echo     http://%HOSTNAME%.local:5000   (Windows / iPhone / iPad)
    echo     http://%IP%:5000         (Android)
    echo.
    echo   Run start.bat to launch the app.
) else (
    echo.
    echo [ERROR] Failed to add firewall rule.
    echo   Try running setup.bat as Administrator instead.
)

echo.
pause
