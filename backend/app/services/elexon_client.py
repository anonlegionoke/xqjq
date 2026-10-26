"""
Elexon BMRS API Client & Local Cache Manager.
Handles fetching and caching of:
- FUELHH/stream (Actual Wind Generation, 30-min resolution)
- WINDFOR/stream (Forecasted Wind Generation, hourly resolution)
"""

import os
import time
import threading
import logging
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional, Dict, Any, List
import httpx
import pandas as pd

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
FUELHH_CACHE_PATH = os.path.join(DATA_DIR, "fuelhh_wind.parquet")
WINDFOR_CACHE_PATH = os.path.join(DATA_DIR, "windfor.parquet")

BASE_URL = os.getenv("ELEXON_API_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1/datasets")
DEFAULT_START = "2025-12-29T00:00:00Z"
DEFAULT_END = "2026-02-02T23:59:59Z"


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def fetch_stream_chunk(client: httpx.Client, endpoint: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    url = f"{BASE_URL}/{endpoint}/stream"
    headers = {"User-Agent": "WindPulse-EnergyDesk/1.0 (Day-Ahead Analytics)"}
    
    for attempt in range(3):
        try:
            resp = client.get(url, params=params, headers=headers, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data
            return []
        except Exception as e:
            logger.warning(f"Attempt {attempt+1} failed for {endpoint} with params {params}: {e}")
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
            else:
                logger.error(f"Failed to fetch {endpoint} after 3 attempts: {e}")
                raise
    return []


def download_fuelhh_data(start_iso: str = DEFAULT_START, end_iso: str = DEFAULT_END) -> pd.DataFrame:
    """Fetch FUELHH actual wind generation for the given window."""
    ensure_data_dir()
    logger.info(f"Fetching FUELHH WIND data from {start_iso} to {end_iso}...")
    
    with httpx.Client() as client:
        # FUELHH WIND is compact (~1600 rows for 1 month), can be fetched in a single or 2 chunks
        records = fetch_stream_chunk(client, "FUELHH", {
            "publishDateTimeFrom": start_iso,
            "publishDateTimeTo": end_iso,
            "fuelType": "WIND"
        })
    
    if not records:
        logger.warning("No FUELHH wind records returned.")
        return pd.DataFrame(columns=["startTime", "publishTime", "actual_mw", "settlementDate", "settlementPeriod"])
    
    df = pd.DataFrame(records)
    # Standardize column names & types
    df = df.rename(columns={"generation": "actual_mw"})
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
    df["actual_mw"] = pd.to_numeric(df["actual_mw"], errors="coerce")
    df["actual_mw"] = df["actual_mw"].fillna(0.0)
    
    # Sort and remove duplicates (ensures latest publishTime is kept for each startTime)
    df = df.sort_values(["startTime", "publishTime"]).drop_duplicates(subset=["startTime"], keep="last")
    df.to_parquet(FUELHH_CACHE_PATH, index=False)
    logger.info(f"Saved {len(df)} FUELHH records to {FUELHH_CACHE_PATH}")
    return df


def download_windfor_data(start_iso: str = DEFAULT_START, end_iso: str = DEFAULT_END) -> pd.DataFrame:
    """Fetch WINDFOR forecast generation in 7-day chunks."""
    ensure_data_dir()
    logger.info(f"Fetching WINDFOR forecast data from {start_iso} to {end_iso}...")
    
    dt_start = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    dt_end = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    
    chunk_days = 7
    all_records = []
    
    curr = dt_start
    with httpx.Client() as client:
        while curr < dt_end:
            next_curr = min(curr + timedelta(days=chunk_days), dt_end)
            c_start_iso = curr.strftime("%Y-%m-%dT%H:%M:%SZ")
            c_end_iso = next_curr.strftime("%Y-%m-%dT%H:%M:%SZ")
            
            logger.info(f"Fetching WINDFOR chunk: {c_start_iso} to {c_end_iso}")
            chunk = fetch_stream_chunk(client, "WINDFOR", {
                "publishDateTimeFrom": c_start_iso,
                "publishDateTimeTo": c_end_iso,
            })
            all_records.extend(chunk)
            curr = next_curr
    
    if not all_records:
        logger.warning("No WINDFOR records returned.")
        return pd.DataFrame(columns=["publishTime", "startTime", "forecast_mw"])
    
    df = pd.DataFrame(all_records)
    df = df.rename(columns={"generation": "forecast_mw"})
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df["forecast_mw"] = pd.to_numeric(df["forecast_mw"], errors="coerce")
    df["forecast_mw"] = df["forecast_mw"].fillna(0.0)
    
    # Deduplicate on (publishTime, startTime)
    df = df.sort_values(["publishTime", "startTime"]).drop_duplicates(
        subset=["publishTime", "startTime"], keep="last"
    )
    df.to_parquet(WINDFOR_CACHE_PATH, index=False)
    logger.info(f"Saved {len(df)} WINDFOR records to {WINDFOR_CACHE_PATH}")
    return df


class ElexonDataManager:
    """Manages cached in-memory access to Elexon wind actuals and forecasts with thread safety."""
    
    def __init__(self):
        self.fuelhh_df: Optional[pd.DataFrame] = None
        self.windfor_df: Optional[pd.DataFrame] = None
        self.last_loaded: Optional[datetime] = None
        self._lock = threading.Lock()
        self.is_syncing: bool = False
        self.last_sync_error: Optional[str] = None
        
    def load_data(self, force_refresh: bool = False) -> Tuple[pd.DataFrame, pd.DataFrame]:
        ensure_data_dir()
        with self._lock:
            # Load or download FUELHH
            if force_refresh or not os.path.exists(FUELHH_CACHE_PATH):
                self.fuelhh_df = download_fuelhh_data()
            else:
                self.fuelhh_df = pd.read_parquet(FUELHH_CACHE_PATH)
                self.fuelhh_df["startTime"] = pd.to_datetime(self.fuelhh_df["startTime"], utc=True)
                self.fuelhh_df["publishTime"] = pd.to_datetime(self.fuelhh_df["publishTime"], utc=True)
                
            # Load or download WINDFOR
            if force_refresh or not os.path.exists(WINDFOR_CACHE_PATH):
                self.windfor_df = download_windfor_data()
            else:
                self.windfor_df = pd.read_parquet(WINDFOR_CACHE_PATH)
                self.windfor_df["publishTime"] = pd.to_datetime(self.windfor_df["publishTime"], utc=True)
                self.windfor_df["startTime"] = pd.to_datetime(self.windfor_df["startTime"], utc=True)
                
            self.last_loaded = datetime.now(timezone.utc)
            self.last_sync_error = None
            logger.info(
                f"ElexonDataManager ready: {len(self.fuelhh_df)} actuals, {len(self.windfor_df)} forecasts loaded."
            )
            return self.fuelhh_df, self.windfor_df

    def get_data(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        if self.fuelhh_df is None or self.windfor_df is None:
            return self.load_data()
        return self.fuelhh_df, self.windfor_df

    def get_status(self) -> Dict[str, Any]:
        if self.fuelhh_df is None or self.windfor_df is None:
            self.load_data()
        return {
            "cached_actuals_count": len(self.fuelhh_df) if self.fuelhh_df is not None else 0,
            "cached_forecasts_count": len(self.windfor_df) if self.windfor_df is not None else 0,
            "last_loaded": self.last_loaded.isoformat() if self.last_loaded else None,
            "is_syncing": self.is_syncing,
            "last_sync_error": self.last_sync_error,
        }


data_manager = ElexonDataManager()
