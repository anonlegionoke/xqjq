import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Brush,
  ReferenceLine,
} from 'recharts';
import { MetricsSummary, TimeseriesPoint } from '../types';
import { DATE_PRESETS, DatePreset } from '../utils/analytics';
import { Scale, TrendingUp, AlertTriangle, Shield, BarChart2, ChevronDown, Check, Calendar } from 'lucide-react';

interface AnalyticsChartSectionProps {
  metrics: MetricsSummary;
  timeseries: TimeseriesPoint[];
  selectedPresetId: string;
  onSelectPreset: (preset: DatePreset) => void;
  percentile: number;
  isLoading: boolean;
  theme: 'dark' | 'light';
}

export const AnalyticsChartSection: React.FC<AnalyticsChartSectionProps> = ({
  metrics,
  timeseries,
  selectedPresetId,
  onSelectPreset,
  percentile,
  isLoading,
  theme,
}) => {
  const [showSafeBaseline, setShowSafeBaseline] = useState<boolean>(false);
  const [showErrorBars, setShowErrorBars] = useState<boolean>(false);
  const [isWindowDropdownOpen, setIsWindowDropdownOpen] = useState<boolean>(false);

  const activePreset = DATE_PRESETS.find((p) => p.id === selectedPresetId) || DATE_PRESETS[0];
  const isOverforecast = metrics.mean_bias_mw > 0;

  // Format data for Recharts display
  const chartData = timeseries.map((pt) => {
    const dt = new Date(pt.startTime);
    const dateLabel = dt.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
    const timeLabel = dt.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });

    return {
      ...pt,
      formattedTime: `${dateLabel} ${timeLabel}`,
      shortDate: `${dateLabel} ${timeLabel}`,
      shortfallBar: pt.error_mw > 0 ? pt.error_mw : 0,
      surplusBar: pt.error_mw < 0 ? pt.error_mw : 0,
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isShortfall = data.error_mw > 0;

      return (
        <div className="bg-white dark:bg-navy-950/95 border border-slate-300 dark:border-navy-700 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 z-50 min-w-[230px]">
          <div className="border-b border-slate-200 dark:border-navy-800 pb-1 flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span className="font-semibold">{data.formattedTime} UTC</span>
            <span className="text-[10px] text-slate-400">Delivery Slot</span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex justify-between items-center">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Actual Wind:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {data.actual_mw.toLocaleString()} MW
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Day-Ahead Forecast:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {data.forecast_mw.toLocaleString()} MW
              </span>
            </div>

            {showSafeBaseline && (
              <div className="flex justify-between items-center">
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Safe Baseline (P{percentile}):
                </span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                  {data.safe_wind_mw.toLocaleString()} MW
                </span>
              </div>
            )}

            <div className="pt-1 border-t border-slate-200 dark:border-navy-800/80 flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Error (F - A):</span>
              <span
                className={`font-mono font-bold ${
                  isShortfall
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-teal-600 dark:text-teal-400'
                }`}
              >
                {data.error_mw > 0 ? `+${data.error_mw.toLocaleString()}` : data.error_mw.toLocaleString()} MW
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const gridColor = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  return (
    <div className="bg-white dark:bg-navy-800/90 border border-slate-200 dark:border-navy-700/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-all">
      {/* 1. Main Plot Container matching wireframe */}
      <div className="bg-slate-50/70 dark:bg-navy-900/90 border border-slate-200 dark:border-navy-700/80 rounded-xl p-4 sm:p-5 shadow-inner space-y-4">
        {/* Header of Plot: Controls (Risk P90 badge, Week 1 Dropdown, Toggles) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-navy-800 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>Forecast vs. Actuals Plot</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                ({timeseries.length} settlement slots)
              </span>
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold leading-none bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                <Calendar className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                <span>January 2026</span>
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Strict point-in-time Day-Ahead comparison (zero look-ahead leakage).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Risk Indicator Pill */}
            <div className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 font-mono font-semibold">
              Risk P{percentile}
            </div>

            {/* Week 1 Dropdown Selector (annotated in wireframe: "a dropdown for other options") */}
            <div className="relative">
              <button
                onClick={() => setIsWindowDropdownOpen(!isWindowDropdownOpen)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-700 text-slate-800 dark:text-slate-200 font-medium hover:border-teal-500 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>{activePreset.label}</span>
                <span className="text-[10px] text-slate-400">({activePreset.sublabel})</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isWindowDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsWindowDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-9 z-50 w-48 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg shadow-2xl py-1 text-xs">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-navy-800">
                      Select Delivery Window
                    </div>
                    {DATE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectPreset(p);
                          setIsWindowDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors ${
                          selectedPresetId === p.id
                            ? 'text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-500/10'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{p.label}</span>
                          <span className="text-[10px] text-slate-400">{p.sublabel}</span>
                        </div>
                        {selectedPresetId === p.id && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Optional Safe Baseline Toggle */}
            <button
              onClick={() => setShowSafeBaseline(!showSafeBaseline)}
              className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 font-medium transition-all ${
                showSafeBaseline
                  ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 text-amber-800 dark:text-amber-300'
                  : 'bg-white dark:bg-navy-800 border-slate-300 dark:border-navy-700 text-slate-500 dark:text-slate-400'
              }`}
              title="Toggle Safe Baseline Haircut"
            >
              <Shield className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              <span>Safe Baseline</span>
            </button>

            {/* Optional Error Deltas Toggle */}
            <button
              onClick={() => setShowErrorBars(!showErrorBars)}
              className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 font-medium transition-all ${
                showErrorBars
                  ? 'bg-red-100 dark:bg-red-500/20 border-red-400 text-red-800 dark:text-red-300'
                  : 'bg-white dark:bg-navy-800 border-slate-300 dark:border-navy-700 text-slate-500 dark:text-slate-400'
              }`}
              title="Toggle Error Deltas"
            >
              <BarChart2 className="w-3 h-3 text-red-500 dark:text-red-400" />
              <span>Deltas</span>
            </button>
          </div>
        </div>

        {/* The Recharts Plot */}
        <div className="h-[380px] w-full">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-navy-950/40 rounded-lg">
              <span className="text-xs text-slate-400">Loading forecast timeseries...</span>
            </div>
          ) : timeseries.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-navy-950/40 rounded-lg text-slate-400 text-xs">
              No delivery slots found for the selected window.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -5, bottom: 15 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

                <XAxis
                  dataKey="shortDate"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickMargin={6}
                  minTickGap={45}
                />

                <YAxis
                  yAxisId="gen"
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                  domain={[0, 'auto']}
                  label={{
                    value: 'Generation (MW)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: axisColor,
                    fontSize: 11,
                    offset: 12,
                  }}
                />

                {showErrorBars && (
                  <YAxis
                    yAxisId="err"
                    orientation="right"
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 10 }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`}
                    domain={[-8000, 8000]}
                  />
                )}

                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine yAxisId="gen" y={0} stroke={gridColor} />

                {showErrorBars && (
                  <>
                    <Bar
                      yAxisId="err"
                      dataKey="shortfallBar"
                      name="Wind Deficit"
                      fill="#EF4444"
                      opacity={0.45}
                      barSize={4}
                    />
                    <Bar
                      yAxisId="err"
                      dataKey="surplusBar"
                      name="Wind Surplus"
                      fill="#14B8A6"
                      opacity={0.35}
                      barSize={4}
                    />
                  </>
                )}

                {showSafeBaseline && (
                  <Line
                    yAxisId="gen"
                    type="monotone"
                    dataKey="safe_wind_mw"
                    name={`Safe Wind Baseline (P${percentile})`}
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                <Line
                  yAxisId="gen"
                  type="monotone"
                  dataKey="actual_mw"
                  name="Actual Wind (MW)"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />

                <Line
                  yAxisId="gen"
                  type="monotone"
                  dataKey="forecast_mw"
                  name="Day-Ahead Forecast (MW)"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  isAnimationActive={false}
                />

                <Brush
                  dataKey="shortDate"
                  height={22}
                  stroke={axisColor}
                  fill={theme === 'dark' ? '#0B1120' : '#FFFFFF'}
                  tickFormatter={() => ''}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-navy-800">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <span className="w-3.5 h-1 bg-emerald-500 rounded-full inline-block"></span> Actual Wind (FUELHH)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <span className="w-3.5 h-1 border-b-2 border-dashed border-blue-500 inline-block"></span> Day-Ahead Forecast (WINDFOR)
            </span>
            {showSafeBaseline && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="w-3.5 h-1 border-b-2 border-dotted border-amber-500 inline-block"></span> Safe Baseline (P{percentile})
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono">
            Elexon Wholesale Stream
          </span>
        </div>
      </div>

      {/* 2. Three Metric KPI Cards for the active plot window */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Performance Metrics for Active Plot Window ({activePreset.label}):
          </span>
          <span className="font-mono text-[11px]">
            {timeseries.length} settlement periods evaluated
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: MAE (Mean Absolute Error) */}
          <div className="bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700/70 rounded-xl p-4 shadow-sm text-center space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>MAE (Mean Absolute Error)</span>
            </div>

            <div className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-300">
              {isLoading ? (
                <div className="h-7 w-32 bg-slate-200 dark:bg-navy-700 animate-pulse rounded mx-auto"></div>
              ) : (
                `${metrics.mae_mw.toLocaleString()} MW (${metrics.norm_mae_pct}%)`
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Typical sizing error per settlement slot
            </div>
          </div>

          {/* Card 2: RMSE (Volatility) */}
          <div className="bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700/70 rounded-xl p-4 shadow-sm text-center space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>RMSE (Volatility)</span>
            </div>

            <div className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300">
              {isLoading ? (
                <div className="h-7 w-28 bg-slate-200 dark:bg-navy-700 animate-pulse rounded mx-auto"></div>
              ) : (
                `${metrics.rmse_mw.toLocaleString()} MW`
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              L2 volatility norm penalizing storm ramp misses
            </div>
          </div>

          {/* Card 3: Systematic Forecast Bias */}
          <div className="bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700/70 rounded-xl p-4 shadow-sm text-center space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
              <span>Systematic Forecast Bias</span>
            </div>

            <div
              className={`text-2xl font-bold font-mono ${
                isOverforecast
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isLoading ? (
                <div className="h-7 w-28 bg-slate-200 dark:bg-navy-700 animate-pulse rounded mx-auto"></div>
              ) : (
                `${metrics.mean_bias_mw > 0 ? '+' : ''}${metrics.mean_bias_mw.toLocaleString()} MW`
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {isOverforecast ? 'Over-forecast: wind deficit risk' : 'Under-forecast surplus'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
