#!/bin/bash
# Build PJF Modelling — macOS (produces backend/dist/pjf-modelling/)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "═══════════════════════════════════════"
echo "  PJF Modelling — macOS build"
echo "═══════════════════════════════════════"

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
echo "  Launch: backend/dist/pjf-modelling/pjf-modelling"
