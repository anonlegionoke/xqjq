"""
Pydantic schemas for the UK Day-Ahead Wind Intelligence & Procurement API.
"""

from typing import List, Optional, Dict, Literal
from pydantic import BaseModel, Field


class DashboardFilterParams(BaseModel):
    start_date: str = Field(default="2026-01-01T00:00:00Z", description="Start timestamp (ISO)")
    end_date: str = Field(default="2026-01-31T23:59:59Z", description="End timestamp (ISO)")
    mode: Literal["rolling_horizon", "gate_closure"] = Field(
        default="rolling_horizon", description="'rolling_horizon' or 'gate_closure'"
    )
    horizon_hours: int = Field(default=24, ge=1, le=72, description="Forecast lead time in hours")
    gate_closure_hour_utc: float = Field(default=9.5, ge=0.0, le=23.5, description="Day D-1 Gate closure hour (e.g. 9.5 for 09:30 UTC)")
    percentile: float = Field(default=90.0, ge=50.0, le=99.9, description="Risk confidence level for shortfall buffer")
    resolution: Literal["hourly", "30min_interpolated"] = Field(
        default="hourly", description="'hourly' or '30min_interpolated'"
    )


class SyncStatusResponse(BaseModel):
    status: str
    message: str
    is_syncing: bool = False
    last_loaded: Optional[str] = None
    last_sync_error: Optional[str] = None


class TimeseriesPoint(BaseModel):
    startTime: str
    actual_mw: float
    forecast_mw: float
    safe_wind_mw: float
    error_mw: float
    shortfall_mw: float
    surplus_mw: float
    publishTime: Optional[str] = None


class MetricsSummary(BaseModel):
    sample_count: int
    mean_actual_mw: float
    mean_forecast_mw: float
    mae_mw: float
    norm_mae_pct: float
    rmse_mw: float
    mean_bias_mw: float
    wape_pct: float
    thermal_buffer_mw: float
    percentile_level: float
    max_shortfall_mw: float
    bias_direction: str


class HorizonDegradationPoint(BaseModel):
    horizon_hours: int
    mae_mw: float
    rmse_mw: float
    mean_bias_mw: float
    p90_shortfall_mw: float
    shortfall_buffers: Dict[str, float] = Field(default_factory=dict)


class DiurnalPoint(BaseModel):
    hour: int
    mean_actual_mw: float
    mean_forecast_mw: float
    mae_mw: float
    rmse_mw: float
    p90_shortfall_mw: float
    shortfall_buffers: Dict[str, float] = Field(default_factory=dict)


class HistogramBin(BaseModel):
    bin_start: float
    bin_end: float
    bin_center: float
    count: int


class HistogramData(BaseModel):
    bins: List[HistogramBin]
    mean: float
    std_dev: float
    min_error: float
    max_error: float


class DashboardResponse(BaseModel):
    params: DashboardFilterParams
    metrics: MetricsSummary
    timeseries: List[TimeseriesPoint]
    horizon_degradation: List[HorizonDegradationPoint]
    diurnal_profile: List[DiurnalPoint]
    distribution: HistogramData
