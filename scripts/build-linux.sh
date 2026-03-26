#!/bin/bash
# Build PJF Modelling — Linux / Ubuntu (produces backend/dist/pjf-modelling/)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "═══════════════════════════════════════"
echo "  PJF Modelling — Linux build"
echo "═══════════════════════════════════════"

# ── Prerequisites check ──────────────────────────────────────────────────────
command -v node  >/dev/null 2>&1 || { echo "Node.js not found. Install: sudo apt install nodejs npm"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python3 not found. Install: sudo apt install python3 python3-venv"; exit 1; }

# ── 1. Build React frontend ──────────────────────────────────────────────────
echo ""
echo "▶ Building frontend..."
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run build

# ── 2. Python virtual environment ───────────────────────────────────────────
echo ""
echo "▶ Setting up Python environment..."
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
pip install -q pyinstaller

# ── 3. PyInstaller ──────────────────────────────────────────────────────────
echo ""
echo "▶ Running PyInstaller..."
pyinstaller pjf_modelling.spec --noconfirm

echo ""
echo "✔ Done! Executable folder: backend/dist/pjf-modelling/"
echo "  Launch: ./backend/dist/pjf-modelling/pjf-modelling"
