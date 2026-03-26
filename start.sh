#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "── PJF Modelling ─────────────────────────"
echo "Starting backend + frontend..."

# Backend
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  echo "[backend] Creating virtual environment..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
echo "[backend] Starting FastAPI on :8000"
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "[frontend] Installing dependencies..."
  npm install
fi
echo "[frontend] Starting Vite dev server on :5173"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM
wait
