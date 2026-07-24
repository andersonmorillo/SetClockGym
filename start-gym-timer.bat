@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

title Gym Timer Launcher
echo Starting Gym Timer...
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo Python was not found. Install Python and try again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node.js and try again.
  pause
  exit /b 1
)

where ngrok >nul 2>&1
if errorlevel 1 (
  echo ngrok was not found. Install ngrok and add it to PATH, then try again.
  pause
  exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
  echo Creating Python virtual environment...
  python -m venv "backend\.venv"
  if errorlevel 1 (
    echo Failed to create virtual environment.
    pause
    exit /b 1
  )
)

echo Checking backend dependencies...
"backend\.venv\Scripts\python.exe" -c "import fastapi,uvicorn" >nul 2>&1
if errorlevel 1 (
  echo Installing backend packages...
  "backend\.venv\Scripts\pip.exe" install -r "backend\requirements.txt"
  if errorlevel 1 (
    echo Failed to install backend packages.
    pause
    exit /b 1
  )
)

if not exist "node_modules\" (
  echo Installing frontend packages...
  call npm install
  if errorlevel 1 (
    echo Failed to install frontend packages.
    pause
    exit /b 1
  )
)

set "LAN_IP="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LAN_IP=%%i"

if not defined LAN_IP set "LAN_IP=localhost"

rem Use Vite /api proxy (works with ngrok HTTPS and LAN phone access).
set "VITE_API_URL="
set "PHONE_URL=http://%LAN_IP%:5173"
set "NGROK_URL=https://nonexperiential-feebly-carolina.ngrok-free.dev"

echo Starting API on http://0.0.0.0:8000
start "Gym Timer API" "%~dp0backend\run-api.bat"

echo Starting app on http://0.0.0.0:5173
start "Gym Timer App" "%~dp0run-frontend.bat"

timeout /t 3 /nobreak >nul

echo Starting ngrok tunnel...
start "Gym Timer ngrok" ngrok http --url=nonexperiential-feebly-carolina.ngrok-free.dev 5173

timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Gym Timer is launching in three windows:
echo   - Gym Timer API
echo   - Gym Timer App
echo   - Gym Timer ngrok
echo.
echo On this PC:  http://localhost:5173
echo Via ngrok:   %NGROK_URL%
if /i not "%LAN_IP%"=="localhost" (
  echo On your phone ^(same Wi-Fi^): %PHONE_URL%
) else (
  echo Could not detect a LAN IP. Phone LAN URL may not work.
)
echo API is proxied through the app URL ^( /api ^).
echo.
echo Close those windows to stop the app.
echo.
pause
endlocal
