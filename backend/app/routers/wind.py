"""
FastAPI Router for Wind Analytics Endpoints.
"""

from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from typing import Literal
import logging

from app.schemas import (
    DashboardFilterParams,
    DashboardResponse,
    MetricsSummary,
    SyncStatusResponse,
)
from app.services.elexon_client import data_manager
from app.services.analytics import (
    build_dashboard_response,
    match_forecasts_point_in_time,
    calculate_metrics,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/wind", tags=["Wind Analytics"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    start_date: str = Query("2026-01-01T00:00:00Z", description="Start timestamp ISO"),
    end_date: str = Query("2026-01-31T23:59:59Z", description="End timestamp ISO"),
    mode: Literal["rolling_horizon", "gate_closure"] = Query("rolling_horizon", description="'rolling_horizon' or 'gate_closure'"),
    horizon_hours: int = Query(24, ge=1, le=72, description="Rolling horizon lead hours"),
    gate_closure_hour_utc: float = Query(9.5, ge=0.0, le=23.5, description="Gate closure hour on Day D-1"),
    percentile: float = Query(90.0, ge=50.0, le=99.9, description="Risk percentile"),
    resolution: Literal["hourly", "30min_interpolated"] = Query("hourly", description="'hourly' or '30min_interpolated'"),
):
    """
    Returns full dashboard data in a single optimized payload:
    - Point-in-time matched timeseries (actual, forecast, safe baseline, error)
    - Quantitative KPI metrics (MAE, RMSE, Mean Bias, P90 Buffer)
    - Lead-time degradation curve (4h to 48h)
    - Diurnal error profile (hour-of-day)
    - Error distribution histogram
    """
    params = DashboardFilterParams(
        start_date=start_date,
        end_date=end_date,
        mode=mode,
        horizon_hours=horizon_hours,
        gate_closure_hour_utc=gate_closure_hour_utc,
        percentile=percentile,
        resolution=resolution,
    )

    actuals_df, forecasts_df = data_manager.get_data()
    if actuals_df is None or forecasts_df is None or actuals_df.empty or forecasts_df.empty:
        raise HTTPException(status_code=503, detail="Elexon data not loaded")

    return build_dashboard_response(actuals_df, forecasts_df, params)


@router.get("/metrics", response_model=MetricsSummary)
async def get_metrics(
    start_date: str = Query("2026-01-01T00:00:00Z"),
    end_date: str = Query("2026-01-31T23:59:59Z"),
    mode: Literal["rolling_horizon", "gate_closure"] = Query("rolling_horizon"),
    horizon_hours: int = Query(24, ge=1, le=72),
    gate_closure_hour_utc: float = Query(9.5, ge=0.0, le=23.5),
    percentile: float = Query(90.0, ge=50.0, le=99.9),
    resolution: Literal["hourly", "30min_interpolated"] = Query("hourly"),
):
    """Lightweight endpoint returning KPI metrics only."""
    actuals_df, forecasts_df = data_manager.get_data()
    if actuals_df is None or forecasts_df is None or actuals_df.empty or forecasts_df.empty:
        raise HTTPException(status_code=503, detail="Elexon data not loaded")

    matched = match_forecasts_point_in_time(
        actuals_df=actuals_df,
        forecasts_df=forecasts_df,
        start_date=start_date,
        end_date=end_date,
        mode=mode,
        horizon_hours=horizon_hours,
        gate_closure_hour_utc=gate_closure_hour_utc,
        resolution=resolution,
    )
    return calculate_metrics(matched, percentile=percentile)


@router.get("/sync/status", response_model=SyncStatusResponse)
async def get_sync_status():
    """Returns current live data manager sync status."""
    status = data_manager.get_status()
    return SyncStatusResponse(
        status="syncing" if status["is_syncing"] else "idle",
        message="Sync currently running in background" if status["is_syncing"] else "Cache ready",
        is_syncing=status["is_syncing"],
        last_loaded=status["last_loaded"],
        last_sync_error=status["last_sync_error"],
    )


@router.post("/sync", response_model=SyncStatusResponse)
async def sync_data(background_tasks: BackgroundTasks):
    """Triggers an asynchronous refresh from the live Elexon BMRS API with debounce protection."""
    if data_manager.is_syncing:
        status = data_manager.get_status()
        return SyncStatusResponse(
            status="already_syncing",
            message="Data refresh is already in progress",
            is_syncing=True,
            last_loaded=status["last_loaded"],
            last_sync_error=status["last_sync_error"],
        )

    data_manager.is_syncing = True

    def refresh_task():
        try:
            logger.info("Executing background refresh from Elexon API...")
            data_manager.load_data(force_refresh=True)
            logger.info("Background refresh from Elexon API completed successfully.")
        except Exception as e:
            logger.error(f"Error during Elexon sync: {e}", exc_info=True)
            data_manager.last_sync_error = str(e)
        finally:
            data_manager.is_syncing = False

    background_tasks.add_task(refresh_task)
    status = data_manager.get_status()
    return SyncStatusResponse(
        status="sync_initiated",
        message="Downloading latest Elexon dataset in background",
        is_syncing=True,
        last_loaded=status["last_loaded"],
        last_sync_error=None,
    )
