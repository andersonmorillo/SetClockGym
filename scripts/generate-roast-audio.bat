@echo off
cd /d "%~dp0.."
python -m pip install -r "scripts\requirements-audio.txt"
python "scripts\generate_roast_audio.py"
pause
