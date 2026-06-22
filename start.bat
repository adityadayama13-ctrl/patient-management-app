@echo off
setlocal enabledelayedexpansion
title Clinic Patient Management App
color 0A

echo ============================================
echo   Clinic Patient Management App
echo ============================================
echo.

:: Check setup was done
if not exist "node_modules" (
    echo [ERROR] App not set up yet.
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [ERROR] .env file not found.
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

if not exist "client\build\index.html" (
    echo [ERROR] React app not built yet.
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

:: Start PostgreSQL service if not running (try common service names)
for %%S in (postgresql-16 postgresql-15 postgresql-14 postgresql-13 postgresql) do (
    sc query %%S >nul 2>&1
    if !errorlevel! equ 0 (
        sc query %%S | findstr "RUNNING" >nul 2>&1
        if !errorlevel! neq 0 (
            echo Starting PostgreSQL service (%%S)...
            net start %%S >nul 2>&1
            timeout /t 3 /nobreak >nul
        )
        goto :pg_done
    )
)
:pg_done

:: Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set RAW=%%a
    goto :found
)
:found
set IP=%RAW: =%

echo.
:: Get hostname for mDNS URL
for /f %%H in ('hostname') do set HOSTNAME=%%H

echo ============================================
echo   App is running!
echo.
echo   This PC:      http://localhost:5000
echo   Clinic URL:   http://%HOSTNAME%.local:5000
echo   By IP:        http://%IP%:5000
echo.
echo   Use the Clinic URL on any phone, tablet,
echo   or PC connected to the same WiFi.
echo   (Use the IP address for Android devices)
echo.
echo   Press Ctrl+C to stop the server.
echo ============================================
echo.

node server.js
