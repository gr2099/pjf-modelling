# PJF Modelling — Setup Guide

## Prerequisites

### 1. Install Node.js (for the frontend)
```bash
# Option A: Homebrew (recommended)
brew install node

# Option B: Official installer
# Download from https://nodejs.org (LTS version)
```

### 2. Python 3.9+

---

## Quick Start

```bash
# From the project root:
./start.sh
```

This script:
1. Creates a Python virtual environment in `backend/.venv`
2. Installs all Python dependencies
3. Starts FastAPI on **http://localhost:8000**
4. Installs npm packages (first run only)
5. Starts Vite dev server on **http://localhost:5173**

---

## Manual Start (two terminals)

### Terminal 1 — Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## URLs

| Service  | URL                          |
|----------|------------------------------|
| App      | http://localhost:5173        |
| API      | http://localhost:8000        |
| API Docs | http://localhost:8000/docs   |

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Python · FastAPI · numpy · scipy    |
| Frontend  | React 18 · TypeScript · Vite        |
| Styling   | Tailwind CSS · Radix UI primitives  |
| Charts    | Recharts                            |
| State     | Zustand · TanStack Query            |

---

## Models Implemented

| Model              | Key Outputs                                           |
|--------------------|-------------------------------------------------------|
| Corporate          | FCF, EBITDA, NPV, Equity IRR, DSCR, ROIC             |
| Project Finance    | DSCR, LLCR, PLCR, Equity IRR, Project IRR, DSRA      |
| Acquisition / LBO  | MOIC, Equity IRR, exit waterfall, preferred equity    |
| Merger / M&A       | EPS accretion/dilution, synergies, combined P&L       |
| Real Estate        | NOI, DSCR, equity IRR, equity multiple, exit analysis |
| DCF Valuation      | 4 TV methods, CAPM WACC, football field, comps        |
| Risk Analysis      | Tornado, break-even, waterfall, scenarios             |
| Monte Carlo        | P5/P50/P95, histogram, sample paths                   |

---

## Framework Reference (Bodmer)

```
FCF   =  EBITDA − Cash Taxes − CapEx − ΔNWC
DSCR  =  Available Cash Flow / (Interest + Principal)
IRR   =  Rate where NPV = 0
TV    =  FCF_last × (1 + g) / (WACC − g)
MOIC  =  Exit Equity Proceeds / Equity Invested
```
