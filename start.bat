@echo off
echo =======================================================
echo    Autonomous CSV AI Intelligence Agent
echo =======================================================
echo Starting FastAPI Backend (Port 8000)...
start cmd /k "cd backend && python run.py"

echo Starting React + Vite Frontend (Port 5173)...
start cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are launching!
echo UI will be live at: http://localhost:5173
echo API Docs at: http://127.0.0.1:8000/docs
echo =======================================================
pause
