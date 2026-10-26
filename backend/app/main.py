"""
Main FastAPI Application Entrypoint.
WindPulse UK Day-Ahead Wind Intelligence & Procurement Portal.
"""

import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

# Ensure backend directory is in sys.path so 'app' is importable from any working directory
_backend_dir = str(Path(__file__).resolve().parent.parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from app.routers.wind import router as wind_router
from app.services.elexon_client import data_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

APP_START_TIME = datetime.now(timezone.utc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: preload Elexon wind data into memory
    logger.info("Initializing UK Day-Ahead Wind Intelligence Backend...")
    try:
        fuelhh_df, windfor_df = data_manager.load_data(force_refresh=False)
        logger.info(
            f"Preloaded dataset ready: {len(fuelhh_df)} actuals, {len(windfor_df)} forecasts in memory."
        )
    except Exception as e:
        logger.error(f"Error preloading Elexon data: {e}")
    yield
    # Shutdown
    logger.info("Shutting down Wind Intelligence Backend...")


app = FastAPI(
    title="UK Day-Ahead Wind Intelligence & Procurement API",
    description=(
        "Production-grade analytics platform for UK wholesale electricity traders. "
        "Enables point-in-time forecast evaluation, quantitative error quantification, "
        "and P-value thermal procurement risk buffering for January 2026."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(wind_router)


@app.get("/", include_in_schema=False)
async def root():
    """Redirect root requests to interactive Swagger documentation."""
    return RedirectResponse(url="/docs")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Silence browser favicon 404 noise."""
    return Response(status_code=204)


@app.get("/health", tags=["System"])
async def health_check():
    status = data_manager.get_status()
    return {
        "status": "healthy",
        "service": "UK Day-Ahead Wind Intelligence API",
        "version": "1.0.0",
        "uptime_seconds": (datetime.now(timezone.utc) - APP_START_TIME).total_seconds(),
        "cached_actuals_count": status["cached_actuals_count"],
        "cached_forecasts_count": status["cached_forecasts_count"],
        "is_syncing": status["is_syncing"],
        "last_loaded": status["last_loaded"],
        "last_sync_error": status["last_sync_error"],
        "dataset_period": "January 2026 (Dec 29 2025 - Feb 02 2026)",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
