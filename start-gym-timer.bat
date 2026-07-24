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

rem Load root .env into this process (does not override vars already set).
if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" if not defined %%a set "%%a=%%b"
  )
) else (
  echo No .env found. Copy .env.example to .env and edit before running.
  echo.
)

if not defined API_HOST set "API_HOST=0.0.0.0"
if not defined API_PORT set "API_PORT=8000"
if not defined VITE_PORT set "VITE_PORT=5173"
if not defined VITE_API_PROXY_TARGET set "VITE_API_PROXY_TARGET=http://127.0.0.1:8000"

rem ngrok is optional: only used when NGROK_DOMAIN is set in .env (or the environment).
set "HAVE_NGROK=0"
where ngrok >nul 2>&1
if not errorlevel 1 set "HAVE_NGROK=1"

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

rem Empty VITE_API_URL uses same-origin /api via Vite proxy.
if not defined VITE_API_URL set "VITE_API_URL="
set "PHONE_URL=http://%LAN_IP%:%VITE_PORT%"

set "USE_NGROK=0"
if "%HAVE_NGROK%"=="1" if defined NGROK_DOMAIN if not "%NGROK_DOMAIN%"=="" set "USE_NGROK=1"

echo Starting API on http://%API_HOST%:%API_PORT%
start "Gym Timer API" "%~dp0backend\run-api.bat"

echo Starting app on http://0.0.0.0:%VITE_PORT%
start "Gym Timer App" "%~dp0run-frontend.bat"

timeout /t 3 /nobreak >nul

if "%USE_NGROK%"=="1" (
  echo Starting ngrok tunnel to %NGROK_DOMAIN%...
  start "Gym Timer ngrok" ngrok http --url=%NGROK_DOMAIN% %VITE_PORT%
  set "NGROK_URL=https://%NGROK_DOMAIN%"
) else (
  if "%HAVE_NGROK%"=="0" (
    echo ngrok not found on PATH - skipping public tunnel ^(optional^).
  ) else (
    echo NGROK_DOMAIN not set in .env - skipping public tunnel ^(optional^).
  )
)

timeout /t 2 /nobreak >nul
start "" "http://localhost:%VITE_PORT%"

echo.
if "%USE_NGROK%"=="1" (
  echo Gym Timer is launching in three windows:
  echo   - Gym Timer API
  echo   - Gym Timer App
  echo   - Gym Timer ngrok
) else (
  echo Gym Timer is launching in two windows:
  echo   - Gym Timer API
  echo   - Gym Timer App
)
echo.
echo On this PC:  http://localhost:%VITE_PORT%
if "%USE_NGROK%"=="1" echo Via ngrok:   %NGROK_URL%
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
