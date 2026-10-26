"""
Comprehensive Unit & Integration Test Suite for UK Day-Ahead Wind Analytics.
Tests:
1. Strict Point-in-Time Causality (Zero Look-Ahead Leakage)
2. Day-Ahead Gate Closure Mechanics
3. Error Metric Formulas (MAE, RMSE, Mean Bias, Downside Shortfall)
4. Resolution Alignment (Hourly raw vs 30-min interpolation)
5. FastAPI TestClient Route Verification
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.services.analytics import (
    match_forecasts_point_in_time,
    calculate_metrics
)


@pytest.fixture
def synthetic_data():
    """Generates synthetic actuals and multiple forecast runs to test causality."""
    # Target delivery slot: Jan 15, 2026 18:00 UTC
    target_slot = pd.to_datetime("2026-01-15T18:00:00Z")

    actuals = pd.DataFrame([
        {"startTime": target_slot, "actual_mw": 10000.0}
    ])

    # 4 distinct forecast runs published at different times for the same target slot
    forecasts = pd.DataFrame([
        {
            "publishTime": pd.to_datetime("2026-01-14T08:30:00Z"),
            "startTime": target_slot,
            "forecast_mw": 12000.0,  # Available before 09:30 UTC
        },
        {
            "publishTime": pd.to_datetime("2026-01-14T12:30:00Z"),
            "startTime": target_slot,
            "forecast_mw": 11500.0,  # Available after morning auction
        },
        {
            "publishTime": pd.to_datetime("2026-01-15T08:30:00Z"),
            "startTime": target_slot,
            "forecast_mw": 9800.0,   # Same-day intraday update (look-ahead!)
        },
        {
            "publishTime": pd.to_datetime("2026-01-15T16:30:00Z"),
            "startTime": target_slot,
            "forecast_mw": 10100.0,  # 1.5h before delivery (extreme look-ahead!)
        },
    ])

    return actuals, forecasts, target_slot


def test_point_in_time_prevents_look_ahead_leakage(synthetic_data):
    """
    CRITICAL TEST: When decision cutoff is Day D-1 at 09:30 UTC (Jan 14 09:30 UTC),
    the system MUST pick the Jan 14 08:30 UTC forecast (12,000 MW).
    It must NEVER pick Jan 14 12:30 UTC, Jan 15 08:30 UTC, or Jan 15 16:30 UTC.
    """
    actuals, forecasts, target_slot = synthetic_data

    matched = match_forecasts_point_in_time(
        actuals_df=actuals,
        forecasts_df=forecasts,
        start_date="2026-01-15T00:00:00Z",
        end_date="2026-01-15T23:59:59Z",
        mode="gate_closure",
        gate_closure_hour_utc=9.5,  # 09:30 UTC on Day D-1
    )

    assert len(matched) == 1
    row = matched.iloc[0]

    # Must have matched strictly the 08:30 forecast
    expected_publish = pd.to_datetime("2026-01-14T08:30:00Z")
    assert row["publishTime"] == expected_publish
    assert row["forecast_mw"] == 12000.0
    assert row["actual_mw"] == 10000.0
    assert row["error_mw"] == 2000.0  # +2000 MW over-forecast
    assert row["shortfall_mw"] == 2000.0


def test_intraday_cutoff_picks_later_forecast(synthetic_data):
    """
    When the decision cutoff is shortened to rolling 6 hours ahead
    (cutoff for 18:00 UTC is 12:00 UTC on Jan 15),
    it should pick the Jan 15 08:30 UTC forecast (9,800 MW),
    but still NEVER pick the Jan 15 16:30 UTC forecast.
    """
    actuals, forecasts, target_slot = synthetic_data

    matched = match_forecasts_point_in_time(
        actuals_df=actuals,
        forecasts_df=forecasts,
        start_date="2026-01-15T00:00:00Z",
        end_date="2026-01-15T23:59:59Z",
        mode="rolling_horizon",
        horizon_hours=6,
    )

    assert len(matched) == 1
    row = matched.iloc[0]
    expected_publish = pd.to_datetime("2026-01-15T08:30:00Z")
    assert row["publishTime"] == expected_publish
    assert row["forecast_mw"] == 9800.0
    assert row["error_mw"] == -200.0  # -200 MW under-forecast
    assert row["shortfall_mw"] == 0.0
    assert row["surplus_mw"] == 200.0


def test_metric_calculations_ground_truth():
    """Verify MAE, RMSE, MBE, and Downside Shortfall calculations against known hand-computed ground truth."""
    df = pd.DataFrame({
        "actual_mw": [100.0, 200.0, 300.0],
        "forecast_mw": [150.0, 180.0, 400.0],
        "error_mw": [50.0, -20.0, 100.0],
        "shortfall_mw": [50.0, 0.0, 100.0],
        "surplus_mw": [0.0, 20.0, 0.0],
    })

    metrics = calculate_metrics(df, percentile=90.0)

    # Hand calculations:
    # Mean actual = (100 + 200 + 300) / 3 = 200.0
    # Mean forecast = (150 + 180 + 400) / 3 = 243.3
    # MAE = (|50| + |-20| + |100|) / 3 = 170 / 3 = 56.67
    # RMSE = sqrt((2500 + 400 + 10000)/3) = sqrt(4300) = 65.57
    # Mean Bias = (50 - 20 + 100) / 3 = 43.33
    assert metrics.sample_count == 3
    assert metrics.mean_actual_mw == 200.0
    assert metrics.mean_forecast_mw == 243.3
    assert pytest.approx(metrics.mae_mw, 0.1) == 56.7
    assert pytest.approx(metrics.rmse_mw, 0.1) == 65.6
    assert pytest.approx(metrics.mean_bias_mw, 0.1) == 43.3
    # Bias is 43.3 MW, which is within the [-50, 50] MW threshold, so direction must strictly be Balanced
    assert metrics.bias_direction == "Balanced"


def test_fastapi_endpoints():
    """Integration test checking HTTP status and structure of API responses."""
    client = TestClient(app)

    # 0. Root redirect & favicon
    root_resp = client.get("/", follow_redirects=False)
    assert root_resp.status_code == 307
    assert root_resp.headers["location"] == "/docs"

    fav_resp = client.get("/favicon.ico")
    assert fav_resp.status_code == 204

    # 1. Health check
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["cached_actuals_count"] > 1000
    assert data["cached_forecasts_count"] > 10000

    # 2. Dashboard combined endpoint for 1 week in January 2026
    dash_resp = client.get("/api/v1/wind/dashboard?start_date=2026-01-01T00:00:00Z&end_date=2026-01-07T23:59:59Z&horizon_hours=24")
    assert dash_resp.status_code == 200
    d_data = dash_resp.json()
    assert "metrics" in d_data
    assert "timeseries" in d_data
    assert "horizon_degradation" in d_data
    assert "diurnal_profile" in d_data
    assert "distribution" in d_data
    assert d_data["metrics"]["sample_count"] > 0
    assert len(d_data["timeseries"]) > 0

    # 3. Metrics only endpoint
    m_resp = client.get("/api/v1/wind/metrics?start_date=2026-01-01T00:00:00Z&end_date=2026-01-07T23:59:59Z")
    assert m_resp.status_code == 200
    m_data = m_resp.json()
    assert m_data["mae_mw"] > 0
    assert m_data["thermal_buffer_mw"] > 0


def test_january_1_boundary_uses_december_forecast():
    """
    Ensures delivery on Jan 1 00:00 UTC under Day-Ahead Gate Closure
    (cutoff Dec 31 09:30 UTC) correctly matches forecasts published in Dec 2025.
    """
    client = TestClient(app)
    resp = client.get("/api/v1/wind/dashboard?start_date=2026-01-01T00:00:00Z&end_date=2026-01-01T23:59:59Z&mode=gate_closure&gate_closure_hour_utc=9.5")
    assert resp.status_code == 200
    data = resp.json()
    ts = data["timeseries"]
    assert len(ts) >= 24
    first_slot = ts[0]
    assert first_slot["startTime"].startswith("2026-01-01T00:00:00")
    assert first_slot["publishTime"] is not None
    # publishTime must be in Dec 2025 (e.g. Dec 31)
    assert "2025-12" in first_slot["publishTime"]


def test_full_january_2026_coverage_and_zero_nulls():
    """Validates that all 744 hours in January 2026 have complete forecast coverage and zero nulls."""
    client = TestClient(app)
    resp = client.get("/api/v1/wind/dashboard?start_date=2026-01-01T00:00:00Z&end_date=2026-01-31T23:59:59Z&horizon_hours=24")
    assert resp.status_code == 200
    data = resp.json()
    assert data["metrics"]["sample_count"] == 744
    assert len(data["timeseries"]) == 744
    assert data["metrics"]["mean_bias_mw"] > 0  # Validates Elexon over-forecast bias in Jan 2026
    assert len(data["horizon_degradation"]) >= 8
    assert len(data["diurnal_profile"]) == 24
    assert len(data["distribution"]["bins"]) > 0


def test_30min_interpolated_resolution():
    """
    Verifies that requesting resolution='30min_interpolated' returns all 48 half-hour settlement
    periods in a day with continuous interpolated forecast values and zero NaNs.
    """
    client = TestClient(app)
    resp = client.get(
        "/api/v1/wind/dashboard?start_date=2026-01-05T00:00:00Z&end_date=2026-01-05T23:59:59Z&resolution=30min_interpolated"
    )
    assert resp.status_code == 200
    data = resp.json()
    ts = data["timeseries"]
    # 24 hours * 2 = 48 half-hour settlement periods
    assert len(ts) == 48
    # Assert every slot has positive or non-null values
    for slot in ts:
        assert slot["forecast_mw"] >= 0.0
        assert slot["actual_mw"] >= 0.0
        assert slot["safe_wind_mw"] >= 0.0

    # Check that the :30 slot between 00:00 and 01:00 has interpolated forecast
    slot_00 = ts[0]["forecast_mw"]
    slot_30 = ts[1]["forecast_mw"]
    slot_01 = ts[2]["forecast_mw"]
    # Linear midpoint check
    expected_midpoint = round((slot_00 + slot_01) / 2.0, 1)
    assert pytest.approx(slot_30, 0.2) == expected_midpoint


def test_metrics_validation_and_sync_endpoints():
    """Validates that input validation rejects out-of-range parameters and sync endpoints return proper schemas."""
    client = TestClient(app)

    # 1. Invalid percentile (> 99.9) on /metrics must be rejected with 422
    err_resp = client.get("/api/v1/wind/metrics?percentile=150.0")
    assert err_resp.status_code == 422

    # 2. Invalid horizon (> 72h) on /dashboard must be rejected with 422
    err_resp2 = client.get("/api/v1/wind/dashboard?horizon_hours=120")
    assert err_resp2.status_code == 422

    # 3. GET /sync/status returns valid schema
    sync_status_resp = client.get("/api/v1/wind/sync/status")
    assert sync_status_resp.status_code == 200
    s_data = sync_status_resp.json()
    assert "status" in s_data
    assert "is_syncing" in s_data
    assert s_data["is_syncing"] is False
