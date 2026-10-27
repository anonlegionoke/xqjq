# UK Day-Ahead Wind Intelligence & Thermal Procurement Portal (January 2026)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![Pytest](https://img.shields.io/badge/Pytest-100%25_Pass-brightgreen.svg?logo=pytest&logoColor=white)](https://pytest.org)
[![Dataset](https://img.shields.io/badge/Data-Elexon_BMRS_Live-orange.svg)](https://bmrs.elexon.co.uk)

A customized, production-grade decision support platform built for UK wholesale electricity utilities. Designed for trading desks bidding into the UK Day-Ahead Market (EPEX SPOT / N2EX) to optimize thermal power procurement, evaluate wind forecast accuracy without look-ahead bias, and hedge real-time balancing cash-out risk.

---

## Live Application

* **Live Web App:** [https://windpulse-energydesk.vercel.app](https://windpulse-energydesk.vercel.app)

---

## The Domain Problem & Value Proposition

### 1. Market Context: Day-Ahead Thermal Procurement
In Great Britain, electricity suppliers must balance customer demand in every 30-minute settlement period. Wind energy is dispatched first due to zero marginal cost. The remaining net demand must be procured from thermal power stations (e.g. Combined Cycle Gas Turbines - CCGT). 

Because the primary Day-Ahead Auction closes on **Day D-1** (EPEX SPOT auction gate closure at **09:20–10:00 UTC**; afternoon auction at **15:30 UTC**), trading desks must commit to thermal generation 14 to 38 hours before physical delivery, relying entirely on wind generation forecasts from National Grid ESO / NESO (`WINDFOR`).

### 2. Asymmetric Financial Risk: The Over-Forecast Danger
* **Over-Forecast (Dangerous Wind Deficit):** If Elexon predicts 14,000 MW of wind, but only 10,000 MW shows up, the utility bought 4,000 MW too little thermal power Day-Ahead. The desk is caught **4,000 MW short** in real time and hit with punitive imbalance cash-out prices (System Buy Price).
* **Under-Forecast (Surplus):** If wind exceeds forecast, thermal generation was over-bought, forcing the desk to spill wind or sell distress power.

### 3. The WindPulse Solution
Instead of naively trusting the raw forecast, this application calculates the **P90 Downside Shortfall Risk Buffer**—the exact MW margin of additional thermal power needed to protect the utility 90% of the time, complete with an interactive procurement simulator.

---

## System Architecture

```
                          ┌────────────────────────────────────────────────────────┐
                          │               React 18 + TypeScript (Vite)             │
                          │        Tailwind CSS • Recharts • Lucide Icons          │
                          │                                                        │
                          │  [Control Bar]   [KPI Ribbon]   [Procurement Calculator]│
                          │  [Main Time-Series Forecast vs Actual + Error Delta]   │
                          │  [Degradation Curve] [Diurnal Profile] [Error Distrib] │
                          └───────────────────────────┬────────────────────────────┘
                                                      │ REST API (/api/v1/wind/...)
                                                      ▼
                          ┌────────────────────────────────────────────────────────┐
                          │                 FastAPI Async Backend                  │
                          │              Uvicorn • Pandas • Pydantic v2            │
                          ├────────────────────────────────────────────────────────┤
                          │ Endpoints:                                             │
                          │   GET  /api/v1/wind/dashboard (Combined payload)       │
                          │   GET  /api/v1/wind/metrics   (Lightweight KPIs)       │
                          │   POST /api/v1/wind/sync      (Live Elexon refresh)    │
                          │   GET  /health                (System & cache status)  │
                          ├────────────────────────────────────────────────────────┤
                          │ Core Engine (backend/app/services/analytics.py):       │
                          │   - Strict Point-in-Time (publishTime <= Cutoff)       │
                          │   - Rolling Horizon vs Gate Closure Rules              │
                          │   - MAE, RMSE, Mean Bias (MBE), WAPE                   │
                          │   - P50/P80/P90/P95/P99 Downside Shortfall Buffer      │
                          └───────────────────────────┬────────────────────────────┘
                                                      │ Parquet Cache (sub-10ms)
                                                      ▼
                          ┌────────────────────────────────────────────────────────┐
                          │              Elexon BMRS Live Streaming API            │
                          │   - FUELHH/stream: Actual wind generation (30-min)     │
                          │   - WINDFOR/stream: Forecasted wind generation (1-hr)  │
                          └────────────────────────────────────────────────────────┘
```

---

## Repository Structure & File Details

```text
.
├── docker-compose.yml              # Single-command full-stack container orchestration
├── README.md                       # Complete documentation, domain context, setup
├── backend/
│   ├── Dockerfile                  # Multi-stage lightweight Python 3.12 container (dynamic $PORT)
│   ├── requirements.txt            # FastAPI, Uvicorn, Pandas, NumPy, Pytest, PyArrow
│   ├── pytest.ini                  # Pytest configuration and pythonpath discovery
│   ├── conftest.py                 # Test fixtures and path resolution
│   ├── data/                       # Local Parquet data cache (Dec 29 2025 - Feb 02 2026)
│   │   ├── fuelhh_wind.parquet     # 1,728 records (Actuals)
│   │   └── windfor.parquet         # 21,024 records (Forecasts)
│   ├── app/
│   │   ├── __init__.py             # Python package marker
│   │   ├── main.py                 # FastAPI app, lifespan data loader, CORS, health check
│   │   ├── schemas.py              # Strict Pydantic models with Literal typing
│   │   ├── routers/
│   │   │   ├── __init__.py         # Routers package marker
│   │   │   └── wind.py             # REST endpoints (/dashboard, /metrics, /sync, /sync/status)
│   │   └── services/
│   │       ├── __init__.py         # Services package marker
│   │       ├── elexon_client.py    # Thread-safe Elexon BMRS stream fetcher and cache manager
│   │       └── analytics.py        # Point-in-time join, vectorized metric math, shortfall buffer engine
│   └── tests/
│       ├── __init__.py             # Test package marker
│       └── test_analytics.py       # Comprehensive pytest suite (causality, 30-min interpolation, validation, API)
└── frontend/
    ├── Dockerfile                  # Multi-stage Node 20 build + Nginx alpine runtime (with VITE_API_URL arg)
    ├── nginx.conf                  # Nginx SPA rewrite routing, security headers & asset caching
    ├── vercel.json                 # Vercel SPA clean URL deployment configuration
    ├── package.json                # React 18, TypeScript, Recharts, Tailwind CSS
    ├── tsconfig.json               # TypeScript strict configuration
    ├── vite.config.ts              # Vite build setup, dev proxy & manual rollup vendor chunks
    ├── tailwind.config.js          # Dark theme energy trading color palette
    └── src/
        ├── App.tsx                 # Main application dashboard layout & state orchestration
        ├── types.ts                # TypeScript interface contracts matching backend schemas
        ├── hooks/
        │   └── useLiveClock.ts     # Live UTC clock and UK date ticker
        ├── utils/
        │   └── analytics.ts        # Fast client-side quantile calculation & date filtering
        ├── services/
        │   └── api.ts              # Async API service with 15s timeout and sync status polling
        └── components/
            ├── Header.tsx          # System status, live Elexon sync polling, cutoff rule, and risk percentile
            ├── HeadlineHeroCard.tsx # Target day forecast picker, dynamic accuracy ring gauge & thermal buffer
            ├── AnalyticsChartSection.tsx # Recharts forecast vs actuals plot with deltas & active window KPI cards
            ├── AuditLab.tsx        # 5-tab diagnostics: horizon decay, diurnal profile, error histogram, ledger, simulator
            └── DomainExplainerModal.tsx # Commercial & technical market guide with Escape key and dialog a11y
```

---

## How to Run the Application

### Option A: Running with Docker Compose (Recommended)

To run the complete full-stack environment with a single command:

```bash
docker compose up --build
```

* **Frontend:** Open [http://localhost:3000](http://localhost:3000)
* **Backend API Docs (Swagger):** Open [http://localhost:8000/docs](http://localhost:8000/docs)
* **Backend Health Check:** Open [http://localhost:8000/health](http://localhost:8000/health)

---

### Option B: Running Locally for Development

#### 1. Backend Setup
```bash
# Navigate to backend and create virtual environment
cd backend
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Verify pre-cached dataset or refresh from Elexon
python3 -c "from app.services.elexon_client import data_manager; data_manager.load_data()"

# Run automated test suite
pytest -v -c pytest.ini

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup
```bash
# In a new terminal, navigate to frontend
cd frontend

# Install node dependencies
npm install

# Start Vite dev server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Mathematical Formulations & Data Engineering

### 1. Zero Look-Ahead Point-in-Time Causality

For any settlement delivery slot $T_{\text{target}}$ and selected decision cutoff:

* **Rolling Horizon ($H$ hours):** $T_{\text{cutoff}} = T_{\text{target}} - H$
* **Day-Ahead Gate Closure:** $T_{\text{cutoff}} = (\text{Date}(T_{\text{target}}) - 1\text{ day}) + T_{\text{gate}}$ (e.g. 09:30 UTC)

The matched forecast is strictly selected using point-in-time causality:

$$
\text{Forecast}(T_{\text{target}}) = \arg\max_{\text{publishTime} \le T_{\text{cutoff}}} \text{WINDFOR}(\text{publishTime}, T_{\text{target}})
$$

Any forecast published after $T_{\text{cutoff}}$ is strictly excluded, preventing look-ahead leakage.

### 2. Quantitative Accuracy Metrics

**Mean Absolute Error (MAE):**

$$
\text{MAE} = \frac{1}{N} \sum_{i=1}^N |F_i - A_i|
$$

**Root Mean Square Error (RMSE):**

$$
\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (F_i - A_i)^2}
$$

**Mean Bias Error (MBE):**

$$
\text{MBE} = \frac{1}{N} \sum_{i=1}^N (F_i - A_i)
$$

### 3. Downside Shortfall & Thermal Risk Buffer

For each settlement period $i$, the wind shortfall is defined as the generation deficit:

$$
\text{Shortfall}_i = \max(0, F_i - A_i)
$$

The thermal procurement buffer at risk percentile $P$ (e.g. P90) is:

$$
\text{Thermal Buffer}_P = \text{Percentile}_P(\{\text{Shortfall}_i\})
$$

The safe wind generation baseline is:

$$
\text{Safe Wind Baseline}_i = \max(0, F_i - \text{Thermal Buffer}_P)
$$

---

## AI Tools Disclosure

As required by Section 2.2 of the challenge instructions:
* **AI Assistance:** Artificial Intelligence tools (Google Gemini / Antigravity coding agents) were utilized during the research, design synthesis, boilerplate generation, and verification phases of this project.
* **Human Engineering Rigour:** The mathematical point-in-time causality proofs, Elexon API data boundary handling (Dec 29, 2025 – Feb 02, 2026), quantitative accuracy formulas, automated pytest test suite, and trading desk domain workflows were designed, verified, and audited with engineering rigor.

---

## Automated Testing Verification

The backend includes a comprehensive automated pytest test suite in `backend/tests/test_analytics.py`:
1. `test_point_in_time_prevents_look_ahead_leakage`: Guarantees that forecasts published after gate closure are never matched.
2. `test_intraday_cutoff_picks_later_forecast`: Verifies rolling lead-time sensitivity.
3. `test_metric_calculations_ground_truth`: Validates MAE, RMSE, MBE, and P90 math against known synthetic ground truth.
4. `test_january_1_boundary_uses_december_forecast`: Confirms Day 1 Jan 2026 delivery correctly links to Dec 31, 2025 forecasts.
5. `test_full_january_2026_coverage_and_zero_nulls`: Validates 100% data coverage across all 744 hours in January 2026.
6. `test_fastapi_endpoints`: Verifies HTTP response codes and JSON schemas.
7. `test_30min_interpolated_resolution`: Validates 48 half-hour settlement periods with continuous linear interpolation.
8. `test_metrics_validation_and_sync_endpoints`: Verifies query parameter validation bounds and live sync polling endpoints.

Run all tests:
```bash
backend/.venv/bin/pytest -v -c backend/pytest.ini
```
*Result: 8 passed in 1.05s.*
