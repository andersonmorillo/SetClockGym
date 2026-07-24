@echo off
setlocal EnableExtensions
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

echo Starting API on http://localhost:8000
start "Gym Timer API" "%~dp0backend\run-api.bat"

echo Starting app on http://localhost:5173
start "Gym Timer App" "%~dp0run-frontend.bat"

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Gym Timer is launching in two windows:
echo   - Gym Timer API
echo   - Gym Timer App
echo Close those windows to stop the app.
echo.
pause
endlocal
