@echo off
title Clinic App - Setup
color 0A

echo ============================================
echo   Clinic Patient Management App - Setup
echo   This will install Node.js, PostgreSQL,
echo   and configure the app automatically.
echo ============================================
echo.
echo Administrator access is required.
echo A UAC prompt may appear - click Yes to continue.
echo.
pause

:: Re-launch as Administrator if not already elevated
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Run the PowerShell setup script
powershell -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
