import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routers import corporate, project_finance, acquisition, risk_analysis, valuation, export

app = FastAPI(
    title="PJF Modelling",
    description="Corporate & Project Finance Modelling Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(corporate.router,       prefix="/api/corporate",   tags=["Corporate"])
app.include_router(project_finance.router, prefix="/api/project",     tags=["Project Finance"])
app.include_router(acquisition.router,     prefix="/api/acquisition", tags=["Acquisition / LBO"])
app.include_router(risk_analysis.router,   prefix="/api/risk",        tags=["Risk Analysis"])
app.include_router(valuation.router,       prefix="/api/valuation",   tags=["Valuation"])
app.include_router(export.router,          prefix="/api/export",      tags=["Export"])


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Serve built React frontend (production / packaged mode) ───────────────────
# In dev mode the Vite server handles this; in production/packaged mode
# FastAPI serves the pre-built static files from frontend/dist.
_STATIC_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

if _STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(_STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        # API routes are handled above; everything else serves index.html
        index = _STATIC_DIR / "index.html"
        return FileResponse(str(index))
