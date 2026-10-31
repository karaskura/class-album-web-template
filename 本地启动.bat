@echo off
REM ============================================================
REM  Class Album - local launcher (ASCII only on purpose)
REM
REM  cmd.exe parses .bat files byte-by-byte using the system
REM  codepage, so non-ASCII text here gets mangled and breaks
REM  the following lines. All Chinese output lives in
REM  web\scripts\start-local.mjs instead.
REM ============================================================

chcp 65001 >nul
cd /d "%~dp0web"

if not exist "package.json" (
  echo.
  echo   [ERROR] package.json not found in "%~dp0web"
  echo   Please keep this file next to the "web" folder.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo   First run detected: installing dependencies.
  echo   This needs a working network and may take a few minutes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [ERROR] npm install failed. Check your network, then run again.
    echo.
    pause
    exit /b 1
  )
)

node scripts\start-local.mjs

echo.
pause
