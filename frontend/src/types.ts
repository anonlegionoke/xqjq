export interface DashboardFilterParams {
  start_date: string;
  end_date: string;
  mode: 'rolling_horizon' | 'gate_closure';
  horizon_hours: number;
  gate_closure_hour_utc: number;
  percentile: number;
  resolution: 'hourly' | '30min_interpolated';
}

export interface TimeseriesPoint {
  startTime: string;
  actual_mw: number;
  forecast_mw: number;
  safe_wind_mw: number;
  error_mw: number;
  shortfall_mw: number;
  surplus_mw: number;
  publishTime?: string;
}

export interface MetricsSummary {
  sample_count: number;
  mean_actual_mw: number;
  mean_forecast_mw: number;
  mae_mw: number;
  norm_mae_pct: number;
  rmse_mw: number;
  mean_bias_mw: number;
  wape_pct: number;
  thermal_buffer_mw: number;
  percentile_level: number;
  max_shortfall_mw: number;
  bias_direction: string;
}

export interface HorizonDegradationPoint {
  horizon_hours: number;
  mae_mw: number;
  rmse_mw: number;
  mean_bias_mw: number;
  p90_shortfall_mw: number;
  shortfall_buffers?: Record<string, number>;
  active_shortfall_mw?: number;
}

export interface DiurnalPoint {
  hour: number;
  mean_actual_mw: number;
  mean_forecast_mw: number;
  mae_mw: number;
  rmse_mw: number;
  p90_shortfall_mw: number;
  shortfall_buffers?: Record<string, number>;
  active_shortfall_mw?: number;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  bin_center: number;
  count: number;
}

export interface HistogramData {
  bins: HistogramBin[];
  mean: number;
  std_dev: number;
  min_error: number;
  max_error: number;
}

export interface DashboardResponse {
  params: DashboardFilterParams;
  metrics: MetricsSummary;
  timeseries: TimeseriesPoint[];
  horizon_degradation: HorizonDegradationPoint[];
  diurnal_profile: DiurnalPoint[];
  distribution: HistogramData;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  uptime_seconds: number;
  cached_actuals_count: number;
  cached_forecasts_count: number;
  is_syncing: boolean;
  last_loaded: string | null;
  last_sync_error: string | null;
  dataset_period: string;
}

export interface SyncStatusResponse {
  status: string;
  message: string;
  is_syncing: boolean;
  last_loaded: string | null;
  last_sync_error: string | null;
}
