@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

rem Load root .env when started alone (launcher already injects these).
if exist "..\.env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in ("..\.env") do (
    if not "%%a"=="" if not defined %%a set "%%a=%%b"
  )
)

if not defined API_HOST set "API_HOST=0.0.0.0"
if not defined API_PORT set "API_PORT=8000"

".venv\Scripts\python.exe" -m uvicorn main:app --reload --host %API_HOST% --port %API_PORT%
if errorlevel 1 pause
endlocal
