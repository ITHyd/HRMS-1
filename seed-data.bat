@echo off
cd /d "%~dp0backend"
python -m seed.seed_data
pause
