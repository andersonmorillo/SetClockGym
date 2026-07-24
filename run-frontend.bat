@echo off
cd /d "%~dp0"
npm run dev
if errorlevel 1 pause
