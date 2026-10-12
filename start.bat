@echo off
cd /d "%~dp0"

rem Start local infrastructure for PostgreSQL and Redis
where docker >nul 2>nul
if errorlevel 1 (
    echo Docker is required but was not found in PATH.
    exit /b 1
)

docker compose -f "backend\docker-compose.yml" up -d --wait
if errorlevel 1 (
    echo Failed to start PostgreSQL and Redis. Check Docker and backend\.env port settings.
    exit /b 1
)

rem Start backend in its own terminal
start "MARP Backend" cmd /k "cd /d ""%~dp0backend"" && .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

rem Start generation and source-ingestion worker in its own terminal
start "MARP Worker" cmd /k "cd /d ""%~dp0backend"" && .\.venv\Scripts\python.exe -m arq app.workers.settings.WorkerSettings"

rem Start frontend in its own terminal
start "MARP Frontend" cmd /k "cd /d ""%~dp0"" && npm install && npm run dev -- --host 0.0.0.0"

echo.
echo MARP services are starting...
echo Backend: http://localhost:8000/docs
echo Frontend: http://localhost:5173
exit /b 0
