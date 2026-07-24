@echo off
cd /d "%~dp0"
rem Empty VITE_API_URL uses same-origin /api (Vite proxies to the backend).
if not defined VITE_API_URL set "VITE_API_URL="
echo API mode: same-origin /api via Vite proxy
npm run dev -- --host
if errorlevel 1 pause
