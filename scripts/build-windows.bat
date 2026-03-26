@echo off
:: Build PJF Modelling — Windows (produces backend\dist\pjf-modelling\)
setlocal EnableDelayedExpansion

echo ═══════════════════════════════════════
echo   PJF Modelling — Windows build
echo ═══════════════════════════════════════

set ROOT=%~dp0..

:: ── 1. Build React frontend ──────────────────────────────────────────────────
echo.
echo ^> Building frontend...
cd /d "%ROOT%\frontend"
if not exist "node_modules" (
    call npm install
    if errorlevel 1 ( echo ERROR: npm install failed & exit /b 1 )
)
call npm run build
if errorlevel 1 ( echo ERROR: npm build failed & exit /b 1 )

:: ── 2. Python virtual environment ───────────────────────────────────────────
echo.
echo ^> Setting up Python environment...
cd /d "%ROOT%\backend"
if not exist ".venv" (
    python -m venv .venv
    if errorlevel 1 ( echo ERROR: venv creation failed & exit /b 1 )
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
pip install -q pyinstaller

:: ── 3. PyInstaller ──────────────────────────────────────────────────────────
echo.
echo ^> Running PyInstaller...
pyinstaller pjf_modelling.spec --noconfirm
if errorlevel 1 ( echo ERROR: PyInstaller failed & exit /b 1 )

echo.
echo Done! Executable folder: backend\dist\pjf-modelling\
echo Launch: backend\dist\pjf-modelling\pjf-modelling.exe
pause
