@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000
if errorlevel 1 pause
