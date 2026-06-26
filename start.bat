@echo off
setlocal enabledelayedexpansion
title Clinic Patient Management App
color 0A

echo ============================================
echo   Clinic Patient Management App
echo ============================================
echo.

:: Prefer bundled portable Node.js, fall back to system Node
set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" (
    where node >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Node.js not found.
        echo Please re-extract the app zip or install Node.js from https://nodejs.org
        echo.
        pause
        exit /b 1
    )
    set "NODE_EXE=node"
)

if not exist ".env" (
    echo [ERROR] .env file not found.
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

if not exist "client\build\index.html" (
    echo [ERROR] React app not built.
    echo Please re-extract the full app zip.
    echo.
    pause
    exit /b 1
)

:: Start PostgreSQL service if not running (try common service names)
for %%S in (postgresql-17 postgresql-16 postgresql-15 postgresql-14 postgresql-13 postgresql-12 postgresql) do (
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

"%NODE_EXE%" server.js
