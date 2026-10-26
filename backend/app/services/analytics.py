"""
Core Quantitative Analytics Engine for UK Day-Ahead Wind Intelligence.
Implements:
1. Strict Point-in-Time (As-Of) Join (Zero Look-Ahead Bias)
2. Dual Decision Modes: Rolling Horizon vs UK Auction Gate Closure
3. Error Metrics: MAE, RMSE, Mean Bias (MBE), WAPE, Downside Shortfall
4. Risk-Adjusted Thermal Buffer (P50/P80/P90/P95/P99) & Safe Wind Baseline
5. Horizon Degradation Analysis (4h to 48h lead times)
6. Diurnal (Hourly) Error Profile
7. Error Distribution Histogram
"""

import numpy as np
import pandas as pd
from typing import List

from app.schemas import (
    DashboardFilterParams,
    TimeseriesPoint,
    MetricsSummary,
    HorizonDegradationPoint,
    DiurnalPoint,
    HistogramBin,
    HistogramData,
    DashboardResponse,
)


def match_forecasts_point_in_time(
    actuals_df: pd.DataFrame,
    forecasts_df: pd.DataFrame,
    start_date: str = "2026-01-01T00:00:00Z",
    end_date: str = "2026-01-31T23:59:59Z",
    mode: str = "rolling_horizon",
    horizon_hours: int = 24,
    gate_closure_hour_utc: float = 9.5,
    resolution: str = "hourly",
) -> pd.DataFrame:
    """
    Performs strict point-in-time matching of wind forecasts to actuals.
    Guarantees no look-ahead leakage:
      publishTime <= cutoffTime
    where cutoffTime is computed per target delivery slot.
    """
    dt_start = pd.to_datetime(start_date, utc=True)
    dt_end = pd.to_datetime(end_date, utc=True)

    # 1. Filter actuals to target window
    act = actuals_df[
        (actuals_df["startTime"] >= dt_start) & (actuals_df["startTime"] <= dt_end)
    ].copy()

    if act.empty:
        return pd.DataFrame(
            columns=["startTime", "actual_mw", "forecast_mw", "publishTime", "error_mw", "shortfall_mw", "surplus_mw"]
        )

    start_dt_index = pd.DatetimeIndex(pd.to_datetime(act["startTime"], utc=True))

    # 2. Handle Resolution
    if resolution == "hourly":
        # Keep exact :00 on-the-hour points where raw forecasts exist
        act_target = pd.DataFrame(act[start_dt_index.minute == 0][["startTime", "actual_mw"]].copy())
    else:
        # Keep 30-min actuals
        act_target = pd.DataFrame(act[["startTime", "actual_mw"]].copy())

    # 3. Compute Decision Cutoff Time per slot
    act_target_start = pd.DatetimeIndex(pd.to_datetime(act_target["startTime"], utc=True))
    if mode == "rolling_horizon":
        # Decision made H hours before target delivery slot
        act_target["cutoffTime"] = act_target_start - pd.Timedelta(hours=horizon_hours)
    else:
        # UK Day-Ahead Market Gate Closure:
        # e.g. Day D-1 at 09:30 UTC for EPEX/N2EX main auction
        delivery_day = act_target_start.floor("D")
        gate_hours = int(gate_closure_hour_utc)
        gate_minutes = int(round((gate_closure_hour_utc - gate_hours) * 60))
        act_target["cutoffTime"] = (
            delivery_day
            - pd.Timedelta(days=1)
            + pd.Timedelta(hours=gate_hours, minutes=gate_minutes)
        )

    # 4. Strict Point-in-Time Match
    # Clean forecasts columns
    fc = forecasts_df[["startTime", "publishTime", "forecast_mw"]].copy()

    # Match forecasts on startTime
    merged = pd.DataFrame(pd.merge(
        act_target,
        fc,
        on="startTime",
        how="inner"
    ))
    # Enforce causality: only forecasts published on or before the cutoff time
    eligible = pd.DataFrame(merged[merged["publishTime"] <= merged["cutoffTime"]])

    # Select the latest available forecast published prior to cutoff
    latest = pd.DataFrame(
        eligible.sort_values(by="publishTime")
        .drop_duplicates(subset=["startTime"], keep="last")
    )

    matched = pd.DataFrame(pd.merge(
        act_target,
        latest[["startTime", "publishTime", "forecast_mw"]],
        on="startTime",
        how="left"
    ))

    # If 30-min resolution is requested, interpolate hourly forecasts for the :30 settlement slots
    if resolution == "30min_interpolated":
        matched = matched.sort_values("startTime").reset_index(drop=True)
        # Interpolate missing forecast_mw linearly between hourly gate closure forecasts
        matched["forecast_mw"] = matched["forecast_mw"].interpolate(method="linear", limit_direction="both")
        # Forward fill publishTime for display
        matched["publishTime"] = matched["publishTime"].ffill().bfill()

    # Drop any unmatched slots where no forecast existed (e.g. extreme lead time)
    matched = matched.dropna(subset=["forecast_mw"]).copy()

    # 5. Compute Error, Shortfall, and Surplus
    matched["error_mw"] = matched["forecast_mw"] - matched["actual_mw"]
    matched["shortfall_mw"] = np.maximum(0.0, matched["error_mw"])
    matched["surplus_mw"] = np.maximum(0.0, -matched["error_mw"])

    return matched.sort_values("startTime").reset_index(drop=True)


def calculate_metrics(
    df: pd.DataFrame,
    percentile: float = 90.0,
) -> MetricsSummary:
    """Computes comprehensive quantitative accuracy and downside risk metrics."""
    if df.empty or len(df) == 0:
        return MetricsSummary(
            sample_count=0,
            mean_actual_mw=0.0,
            mean_forecast_mw=0.0,
            mae_mw=0.0,
            norm_mae_pct=0.0,
            rmse_mw=0.0,
            mean_bias_mw=0.0,
            wape_pct=0.0,
            thermal_buffer_mw=0.0,
            percentile_level=percentile,
            max_shortfall_mw=0.0,
            bias_direction="Neutral",
        )

    actuals = df["actual_mw"].to_numpy()
    forecasts = df["forecast_mw"].to_numpy()
    errors = df["error_mw"].to_numpy()
    shortfalls = df["shortfall_mw"].to_numpy()

    mean_act = float(np.mean(actuals))
    mean_fc = float(np.mean(forecasts))
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    mean_bias = float(np.mean(errors))

    norm_mae = (mae / mean_act * 100.0) if mean_act > 0 else 0.0
    sum_act = float(np.sum(actuals))
    wape = (float(np.sum(np.abs(errors))) / sum_act * 100.0) if sum_act > 0 else 0.0

    # Risk-Adjusted Thermal Buffer (P-value of shortfall)
    thermal_buffer = float(np.percentile(shortfalls, percentile))
    max_shortfall = float(np.max(shortfalls))

    bias_dir = "Over-forecasting (Deficit Risk)" if mean_bias > 50 else ("Under-forecasting (Surplus)" if mean_bias < -50 else "Balanced")

    return MetricsSummary(
        sample_count=len(df),
        mean_actual_mw=round(mean_act, 1),
        mean_forecast_mw=round(mean_fc, 1),
        mae_mw=round(mae, 1),
        norm_mae_pct=round(norm_mae, 1),
        rmse_mw=round(rmse, 1),
        mean_bias_mw=round(mean_bias, 1),
        wape_pct=round(wape, 1),
        thermal_buffer_mw=round(thermal_buffer, 1),
        percentile_level=percentile,
        max_shortfall_mw=round(max_shortfall, 1),
        bias_direction=bias_dir,
    )


def calculate_horizon_degradation(
    actuals_df: pd.DataFrame,
    forecasts_df: pd.DataFrame,
    start_date: str,
    end_date: str,
    resolution: str = "hourly",
) -> List[HorizonDegradationPoint]:
    """
    Evaluates forecast accuracy degradation across lead times:
    4h, 6h, 8h, 12h, 16h, 20h, 24h, 30h, 36h, 42h, 48h.
    Demonstrates the quantitative value of lead time and uncertainty expansion.
    """
    horizons = [4, 6, 8, 12, 16, 20, 24, 30, 36, 42, 48]
    points = []

    for h in horizons:
        df = match_forecasts_point_in_time(
            actuals_df=actuals_df,
            forecasts_df=forecasts_df,
            start_date=start_date,
            end_date=end_date,
            mode="rolling_horizon",
            horizon_hours=h,
            resolution=resolution,
        )
        if df.empty or len(df) < 5:
            continue

        errors = df["error_mw"].to_numpy()
        shortfalls = df["shortfall_mw"].to_numpy()

        mae = float(np.mean(np.abs(errors)))
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        bias = float(np.mean(errors))
        p90 = float(np.percentile(shortfalls, 90.0))

        percentiles = [50, 80, 90, 95, 99]
        buffers = {
            str(p): round(float(np.percentile(shortfalls, float(p))), 1)
            for p in percentiles
        }

        points.append(
            HorizonDegradationPoint(
                horizon_hours=h,
                mae_mw=round(mae, 1),
                rmse_mw=round(rmse, 1),
                mean_bias_mw=round(bias, 1),
                p90_shortfall_mw=round(p90, 1),
                shortfall_buffers=buffers,
            )
        )

    return points


def calculate_diurnal_profile(df: pd.DataFrame) -> List[DiurnalPoint]:
    """
    Groups errors and shortfall risk by hour of day (00:00 to 23:00 UTC).
    Identifies if evening peak periods exhibit elevated forecast volatility.
    """
    if df.empty:
        return []

    df = df.copy()
    df["hour"] = df["startTime"].dt.hour

    grouped = df.groupby("hour")
    points = []
    percentiles = [50, 80, 90, 95, 99]

    for hour, grp in grouped:
        actuals = grp["actual_mw"].to_numpy()
        forecasts = grp["forecast_mw"].to_numpy()
        errors = grp["error_mw"].to_numpy()
        shortfalls = grp["shortfall_mw"].to_numpy()

        buffers = {
            str(p): round(float(np.percentile(shortfalls, float(p))), 1)
            for p in percentiles
        }

        points.append(
            DiurnalPoint(
                hour=int(str(hour)),
                mean_actual_mw=round(float(np.mean(actuals)), 1),
                mean_forecast_mw=round(float(np.mean(forecasts)), 1),
                mae_mw=round(float(np.mean(np.abs(errors))), 1),
                rmse_mw=round(float(np.sqrt(np.mean(errors ** 2))), 1),
                p90_shortfall_mw=round(float(np.percentile(shortfalls, 90.0)), 1),
                shortfall_buffers=buffers,
            )
        )

    return points


def calculate_histogram(df: pd.DataFrame, num_bins: int = 24) -> HistogramData:
    """Computes error frequency distribution with Gaussian summary."""
    if df.empty:
        return HistogramData(bins=[], mean=0.0, std_dev=0.0, min_error=0.0, max_error=0.0)

    errors = df["error_mw"].to_numpy()
    mean_val = float(np.mean(errors))
    std_val = float(np.std(errors))
    min_val = float(np.min(errors))
    max_val = float(np.max(errors))

    counts, bin_edges = np.histogram(errors, bins=num_bins)
    bins = []

    for i in range(len(counts)):
        b_start = float(bin_edges[i])
        b_end = float(bin_edges[i + 1])
        b_center = (b_start + b_end) / 2.0
        bins.append(
            HistogramBin(
                bin_start=round(b_start, 1),
                bin_end=round(b_end, 1),
                bin_center=round(b_center, 1),
                count=int(counts[i]),
            )
        )

    return HistogramData(
        bins=bins,
        mean=round(mean_val, 1),
        std_dev=round(std_val, 1),
        min_error=round(min_val, 1),
        max_error=round(max_val, 1),
    )


def build_dashboard_response(
    actuals_df: pd.DataFrame,
    forecasts_df: pd.DataFrame,
    params: DashboardFilterParams,
) -> DashboardResponse:
    """Main orchestration: executes point-in-time analytics and packages full dashboard data."""
    matched = match_forecasts_point_in_time(
        actuals_df=actuals_df,
        forecasts_df=forecasts_df,
        start_date=params.start_date,
        end_date=params.end_date,
        mode=params.mode,
        horizon_hours=params.horizon_hours,
        gate_closure_hour_utc=params.gate_closure_hour_utc,
        resolution=params.resolution,
    )

    metrics = calculate_metrics(matched, percentile=params.percentile)

    # Compute Risk-Adjusted Safe Wind Baseline for each row
    buffer = metrics.thermal_buffer_mw

    start_times = [t.isoformat() for t in matched["startTime"]]
    actuals = np.round(matched["actual_mw"].to_numpy(), 1)
    forecasts = np.round(matched["forecast_mw"].to_numpy(), 1)
    safe_winds = np.round(np.maximum(0.0, forecasts - buffer), 1)
    errors = np.round(matched["error_mw"].to_numpy(), 1)
    shortfalls = np.round(matched["shortfall_mw"].to_numpy(), 1)
    surpluses = np.round(matched["surplus_mw"].to_numpy(), 1)
    publish_times = [
        t.isoformat() if pd.notna(t) else None
        for t in matched["publishTime"]
    ]

    ts_points = [
        TimeseriesPoint(
            startTime=start_times[i],
            actual_mw=float(actuals[i]),
            forecast_mw=float(forecasts[i]),
            safe_wind_mw=float(safe_winds[i]),
            error_mw=float(errors[i]),
            shortfall_mw=float(shortfalls[i]),
            surplus_mw=float(surpluses[i]),
            publishTime=publish_times[i],
        )
        for i in range(len(matched))
    ]

    horizon_deg = calculate_horizon_degradation(
        actuals_df=actuals_df,
        forecasts_df=forecasts_df,
        start_date=params.start_date,
        end_date=params.end_date,
        resolution=params.resolution,
    )

    diurnal = calculate_diurnal_profile(matched)
    dist = calculate_histogram(matched)

    return DashboardResponse(
        params=params,
        metrics=metrics,
        timeseries=ts_points,
        horizon_degradation=horizon_deg,
        diurnal_profile=diurnal,
        distribution=dist,
    )
