# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for PJF Modelling.

Build:
    cd backend
    pyinstaller pjf_modelling.spec

Output: backend/dist/pjf-modelling   (folder with executable inside)
"""
import sys
import os
from pathlib import Path

ROOT = Path(SPECPATH)                       # backend/
FRONTEND_DIST = ROOT.parent / "frontend" / "dist"

block_cipher = None

a = Analysis(
    ["launcher.py"],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        # Bundle the built React frontend
        (str(FRONTEND_DIST), "frontend/dist"),
    ],
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "fastapi",
        "starlette",
        "pydantic",
        "pydantic_core",
        "numpy",
        "scipy",
        "scipy.optimize",
        "scipy.special",
        "openpyxl",
        "openpyxl.cell",
        "openpyxl.styles",
        "openpyxl.utils",
        "openpyxl.chart",
        "email.mime.multipart",
        "email.mime.base",
        "app.main",
        "app.routers.corporate",
        "app.routers.project_finance",
        "app.routers.acquisition",
        "app.routers.risk_analysis",
        "app.routers.valuation",
        "app.routers.export",
        "app.engines.cash_flow",
        "app.engines.debt_schedule",
        "app.engines.tax",
        "app.engines.valuation",
        "app.engines.risk",
        "app.engines.monte_carlo",
        "app.engines.excel_export",
        "app.models.schemas",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "IPython", "jupyter"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="pjf-modelling",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,          # no terminal window on Windows/Mac
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="pjf-modelling",
)
