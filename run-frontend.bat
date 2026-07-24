@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

rem Load root .env when started alone (launcher already injects these).
if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" if not defined %%a set "%%a=%%b"
  )
)

if not defined VITE_PORT set "VITE_PORT=5173"
rem Empty VITE_API_URL uses same-origin /api (Vite proxies to the backend).
if not defined VITE_API_URL set "VITE_API_URL="

echo API mode: same-origin /api via Vite proxy ^(port %VITE_PORT%^)
npm run dev -- --host --port %VITE_PORT%
if errorlevel 1 pause
endlocal
