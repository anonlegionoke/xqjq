import { TimeseriesPoint, MetricsSummary, DiurnalPoint } from '../types';

export interface DatePreset {
  id: string;
  label: string;
  sublabel: string;
  startDate: string;
  endDate: string;
}

export const DATE_PRESETS: DatePreset[] = [
  {
    id: 'week1',
    label: 'Week 1',
    sublabel: 'Jan 1–7',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-01-07T23:59:59Z',
  },
  {
    id: 'storm_henk',
    label: 'Storm Henk',
    sublabel: 'Jan 2–4',
    startDate: '2026-01-02T00:00:00Z',
    endDate: '2026-01-04T23:59:59Z',
  },
  {
    id: 'week2',
    label: 'Week 2',
    sublabel: 'Jan 8–14',
    startDate: '2026-01-08T00:00:00Z',
    endDate: '2026-01-14T23:59:59Z',
  },
  {
    id: 'week3',
    label: 'Week 3',
    sublabel: 'Jan 15–21',
    startDate: '2026-01-15T00:00:00Z',
    endDate: '2026-01-21T23:59:59Z',
  },
  {
    id: 'week4',
    label: 'Week 4',
    sublabel: 'Jan 22–28',
    startDate: '2026-01-22T00:00:00Z',
    endDate: '2026-01-28T23:59:59Z',
  },
  {
    id: 'full',
    label: 'Full Month',
    sublabel: '31 Days',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-01-31T23:59:59Z',
  },
];

/**
 * Filter timeseries points by start and end timestamps (inclusive).
 */
export function filterTimeseriesByDate(
  points: TimeseriesPoint[],
  startDate: string,
  endDate: string
): TimeseriesPoint[] {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  return points.filter((pt) => {
    const t = new Date(pt.startTime).getTime();
    return t >= startMs && t <= endMs;
  });
}

/**
 * Quantile calculation matching numpy's default linear interpolation.
 */
function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * Client-side calculation of MAE, RMSE, Mean Bias, and Thermal Buffer.
 * Executes in < 1ms in JavaScript, eliminating redundant network calls on filter changes.
 */
export function calculateClientMetrics(
  points: TimeseriesPoint[],
  percentile: number
): MetricsSummary {
  if (!points || points.length === 0) {
    return {
      sample_count: 0,
      mean_actual_mw: 0,
      mean_forecast_mw: 0,
      mae_mw: 0,
      norm_mae_pct: 0,
      rmse_mw: 0,
      mean_bias_mw: 0,
      wape_pct: 0,
      thermal_buffer_mw: 0,
      percentile_level: percentile,
      max_shortfall_mw: 0,
      bias_direction: 'Neutral',
    };
  }

  const n = points.length;
  let sumActual = 0;
  let sumForecast = 0;
  let sumAbsError = 0;
  let sumSqError = 0;
  let sumError = 0;
  const shortfalls: number[] = [];
  let maxShortfall = 0;

  for (let i = 0; i < n; i++) {
    const pt = points[i];
    const actual = pt.actual_mw;
    const forecast = pt.forecast_mw;
    const error = forecast - actual;
    const shortfall = Math.max(0, error);

    sumActual += actual;
    sumForecast += forecast;
    sumAbsError += Math.abs(error);
    sumSqError += error * error;
    sumError += error;
    shortfalls.push(shortfall);

    if (shortfall > maxShortfall) {
      maxShortfall = shortfall;
    }
  }

  const meanActual = sumActual / n;
  const meanForecast = sumForecast / n;
  const mae = sumAbsError / n;
  const rmse = Math.sqrt(sumSqError / n);
  const meanBias = sumError / n;
  const normMaePct = meanActual > 0 ? (mae / meanActual) * 100 : 0;
  const wapePct = sumActual > 0 ? (sumAbsError / sumActual) * 100 : 0;

  const buffer = quantile(shortfalls, percentile / 100);

  let biasDirection = 'Neutral';
  if (meanBias > 50) {
    biasDirection = 'Over-Forecast Skew (Wind Deficit Risk)';
  } else if (meanBias < -50) {
    biasDirection = 'Under-Forecast Skew (Wind Surplus)';
  }

  return {
    sample_count: n,
    mean_actual_mw: Math.round(meanActual * 10) / 10,
    mean_forecast_mw: Math.round(meanForecast * 10) / 10,
    mae_mw: Math.round(mae * 10) / 10,
    norm_mae_pct: Math.round(normMaePct * 10) / 10,
    rmse_mw: Math.round(rmse * 10) / 10,
    mean_bias_mw: Math.round(meanBias * 10) / 10,
    wape_pct: Math.round(wapePct * 10) / 10,
    thermal_buffer_mw: Math.round(buffer * 10) / 10,
    percentile_level: percentile,
    max_shortfall_mw: Math.round(maxShortfall * 10) / 10,
    bias_direction: biasDirection,
  };
}

/**
 * Client-side calculation of 24-hour diurnal profile (00:00 to 23:00 UTC).
 * Computes mean actual, mean forecast, MAE, RMSE, and the selected percentile shortfall buffer.
 * Executes in < 0.5ms directly over active timeseries.
 */
export function calculateClientDiurnalProfile(
  points: TimeseriesPoint[],
  percentile: number
): DiurnalPoint[] {
  if (!points || points.length === 0) return [];

  // Group by hour 0..23
  const hourBuckets: {
    actuals: number[];
    forecasts: number[];
    errors: number[];
    shortfalls: number[];
  }[] = Array.from({ length: 24 }, () => ({
    actuals: [],
    forecasts: [],
    errors: [],
    shortfalls: [],
  }));

  for (const pt of points) {
    const d = new Date(pt.startTime);
    const hour = d.getUTCHours();
    if (hour >= 0 && hour < 24) {
      const err = pt.forecast_mw - pt.actual_mw;
      const sf = Math.max(0, err);
      hourBuckets[hour].actuals.push(pt.actual_mw);
      hourBuckets[hour].forecasts.push(pt.forecast_mw);
      hourBuckets[hour].errors.push(err);
      hourBuckets[hour].shortfalls.push(sf);
    }
  }

  const result: DiurnalPoint[] = [];

  for (let h = 0; h < 24; h++) {
    const bucket = hourBuckets[h];
    const cnt = bucket.actuals.length;
    if (cnt === 0) continue;

    const meanAct = bucket.actuals.reduce((a, b) => a + b, 0) / cnt;
    const meanFc = bucket.forecasts.reduce((a, b) => a + b, 0) / cnt;
    const mae = bucket.errors.reduce((a, b) => a + Math.abs(b), 0) / cnt;
    const rmse = Math.sqrt(bucket.errors.reduce((a, b) => a + b * b, 0) / cnt);
    const p90 = quantile(bucket.shortfalls, 0.9);
    const activeBuffer = quantile(bucket.shortfalls, percentile / 100);

    result.push({
      hour: h,
      mean_actual_mw: Math.round(meanAct * 10) / 10,
      mean_forecast_mw: Math.round(meanFc * 10) / 10,
      mae_mw: Math.round(mae * 10) / 10,
      rmse_mw: Math.round(rmse * 10) / 10,
      p90_shortfall_mw: Math.round(p90 * 10) / 10,
      active_shortfall_mw: Math.round(activeBuffer * 10) / 10,
      shortfall_buffers: {
        [String(percentile)]: Math.round(activeBuffer * 10) / 10,
        '90': Math.round(p90 * 10) / 10,
      },
    });
  }

  return result;
}
