# PJF Modelling

> Corporate & Project Finance modelling engine — browser-based, cross-platform, Excel-exportable.

![Stack](https://img.shields.io/badge/backend-FastAPI%20%7C%20Python-009688?style=flat-square)
![Stack](https://img.shields.io/badge/frontend-React%2018%20%7C%20TypeScript-3178c6?style=flat-square)
![Stack](https://img.shields.io/badge/styling-Tailwind%20CSS-38bdf8?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Overview

PJF Modelling is a full-stack financial modelling tool that runs entirely in your browser. It implements the core frameworks from corporate and project finance — cash flow projections, debt scheduling, valuation, risk analysis, and Monte Carlo simulation — with a clean, modern UI and one-click Excel export.

No spreadsheet required. No cloud dependency. Runs locally on Windows, macOS, and Linux.

---

## Features

| Module | Description |
|---|---|
| **Corporate Model** | Revenue build, EBITDA, FCF, tax schedule, NPV, equity IRR, DSCR |
| **Project Finance** | Construction/operations split, DSCR, DSRA, project & equity IRR |
| **Acquisition / LBO** | Entry multiples, debt tranches, MOIC, equity IRR, exit waterfall |
| **DCF Valuation** | WACC, terminal value (Gordon Growth / exit multiple), bridge to equity |
| **Risk Analysis** | Tornado chart, break-even, scenario manager, waterfall |
| **Monte Carlo** | 1 000-run simulation, P5/P50/P95 bands, histogram, sample paths |
| **Excel Export** | Any result set exported to a formatted `.xlsx` in one click |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.9+ · FastAPI · uvicorn · NumPy · SciPy · pandas · openpyxl |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · Recharts · Zustand |
| Packaging | PyInstaller — single self-contained executable, no install needed |

---

## Quick Start (Development)

### Prerequisites
- Python 3.9+
- Node.js 18+

### Run

```bash
git clone https://github.com/gr2099/pjf-modelling.git
cd pjf-modelling
./start.sh
```

This will:
1. Create a Python virtual environment and install backend dependencies
2. Start FastAPI on **http://localhost:8000**
3. Install npm packages (first run only)
4. Start the Vite dev server on **http://localhost:5173**

Open **http://localhost:5173** in your browser.

> **Windows:** run `start.sh` via Git Bash, or start the two servers manually (see below).

### Manual Start (two terminals)

**Terminal 1 — Backend**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
npm run dev
```

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

---

## Standalone Executables

Build a self-contained executable that opens directly in the browser — no Python or Node.js required on the target machine.

### macOS
```bash
./scripts/build-mac.sh
# Output: backend/dist/pjf-modelling/pjf-modelling
```

### Linux / Ubuntu
```bash
./scripts/build-linux.sh
# Output: backend/dist/pjf-modelling/pjf-modelling
```

### Windows
```bat
scripts\build-windows.bat
:: Output: backend\dist\pjf-modelling\pjf-modelling.exe
```

The executable bundles the React frontend, FastAPI server, and all Python dependencies. Double-click (or run from terminal) and the app opens automatically in your default browser.

---

## GitHub Actions — Automated Builds

Pushing a version tag triggers a cross-platform build on GitHub Actions and attaches the binaries to a GitHub Release:

```bash
git tag v1.0.0
git push --tags
```

Artifacts produced:
- `pjf-modelling-mac.tar.gz`
- `pjf-modelling-linux.tar.gz`
- `pjf-modelling-windows.zip`

---

## Excel Export

Every model result page has an **Export to Excel** button. The download includes:

- Formatted input summary
- Year-by-year financial schedules
- Key metrics table (IRR, NPV, DSCR, MOIC, …)
- Charts-ready data columns

---

## Financial Framework

Core identities implemented:

```
FCF    =  EBITDA − Cash Taxes − CapEx − ΔNWC
DSCR   =  Available Cash Flow / (Interest + Principal)
IRR    =  Discount rate where NPV = 0
NPV    =  Σ FCFt / (1 + WACC)^t  +  Terminal Value / (1 + WACC)^n
TV     =  FCF_last × (1 + g) / (WACC − g)          [Gordon Growth]
MOIC   =  Exit Equity Proceeds / Equity Invested
DSRA   =  Debt Service Reserve Account (6–12 months coverage)
```

---

## Project Structure

```
pjf-modelling/
├── backend/
│   ├── app/
│   │   ├── engines/          # Core computation: cash flow, debt, valuation, risk, Monte Carlo
│   │   ├── models/           # Pydantic request/response schemas
│   │   └── routers/          # FastAPI route handlers per module
│   ├── launcher.py           # PyInstaller entry point
│   ├── pjf_modelling.spec    # PyInstaller build spec
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/       # Charts, tables, layout, UI primitives
│       ├── pages/            # One page per financial module
│       └── lib/              # API client, utilities
├── scripts/
│   ├── build-mac.sh
│   ├── build-linux.sh
│   └── build-windows.bat
├── .github/workflows/
│   └── build.yml             # Cross-platform CI/CD
└── start.sh                  # Dev launcher (Mac/Linux)
```

---

## License

MIT
