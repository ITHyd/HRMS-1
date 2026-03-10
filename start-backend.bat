@echo off
cd /d "%~dp0backend"
echo Initializing database...
python -m seed.init_db
echo.
echo Starting backend server...
uvicorn app.main:app --reload --port 8001
pause
