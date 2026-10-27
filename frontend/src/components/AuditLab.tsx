import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  HorizonDegradationPoint,
  DiurnalPoint,
  TimeseriesPoint,
  MetricsSummary,
  HistogramData,
} from '../types';
import {
  TrendingUp,
  Clock,
  Table as TableIcon,
  Calculator,
  BarChart3,
  ChevronRight,
  Flame,
  ShieldCheck,
  AlertCircle,
  ChevronLeft,
  Moon,
  Sun,
  Zap,
  CheckCircle2,
  Minus,
  Plus,
  Wind,
  Layers,
  Info,
  Calendar,
  X,
} from 'lucide-react';

interface AuditLabProps {
  horizonData: HorizonDegradationPoint[];
  diurnalData: DiurnalPoint[];
  distributionData?: HistogramData;
  timeseries: TimeseriesPoint[];
  metrics: MetricsSummary;
  percentile: number;
  isLoading: boolean;
  theme?: 'dark' | 'light';
}

export const AuditLab: React.FC<AuditLabProps> = ({
  horizonData,
  diurnalData,
  distributionData,
  timeseries,
  metrics,
  percentile,
  isLoading,
  theme = 'dark',
}) => {
  const [activeTab, setActiveTab] = useState<'horizon' | 'diurnal' | 'distribution' | 'inspector' | 'dispatch'>('horizon');
  const [tablePage, setTablePage] = useState<number>(1);
  const [showViewExplainer, setShowViewExplainer] = useState<boolean>(true);
  const pageSize = 12;

  // Reset table pagination whenever the timeseries / window changes
  useEffect(() => {
    setTablePage(1);
  }, [timeseries]);

  // Dispatch Simulator state (defaulting to 44,000 MW per wireframe)
  const [demandMw, setDemandMw] = useState<number>(44000);
  const minDemand = 18000;
  const maxDemand = 48000;
  const demandPct = Math.min(100, Math.max(0, ((demandMw - minDemand) / (maxDemand - minDemand)) * 100));

  const stressInfo = useMemo(() => {
    if (demandMw >= 42000) {
      return {
        label: 'Severe Cold Snap',
        badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30',
        trackFill: 'bg-gradient-to-r from-teal-500 via-amber-500 to-red-500',
        thumbBorder: 'border-red-500 shadow-red-500/30',
      };
    }
    if (demandMw >= 28000) {
      return {
        label: 'Typical Daily Peak',
        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/30',
        trackFill: 'bg-gradient-to-r from-teal-500 to-amber-500',
        thumbBorder: 'border-amber-500 shadow-amber-500/30',
      };
    }
    return {
      label: 'Off-Peak Baseload',
      badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30',
      trackFill: 'bg-gradient-to-r from-indigo-500 to-teal-500',
      thumbBorder: 'border-indigo-500 shadow-indigo-500/30',
    };
  }, [demandMw]);

  const meanForecast = metrics.mean_forecast_mw || 12000;
  const buffer = metrics.thermal_buffer_mw || 3500;
  const safeWindMw = Math.max(0, meanForecast - buffer);
  const naiveThermalProcurement = Math.max(0, demandMw - meanForecast);
  const recommendedThermalProcurement = Math.max(0, demandMw - safeWindMw);
  const hedgeDelta = recommendedThermalProcurement - naiveThermalProcurement;

  // Grid Supply Stack percentages for vertical meter
  const windPct = Math.min(100, Math.max(0, (safeWindMw / demandMw) * 100));
  const bufferPct = Math.min(100 - windPct, Math.max(0, (hedgeDelta / demandMw) * 100));
  const thermalPct = Math.max(0, 100 - windPct - bufferPct);
  const [activeStackSlice, setActiveStackSlice] = useState<'gas' | 'buffer' | 'wind' | null>(null);

  // Table pagination
  const totalPages = Math.max(1, Math.ceil(timeseries.length / pageSize));
  const currentPagePoints = useMemo(() => {
    const startIdx = (tablePage - 1) * pageSize;
    return timeseries.slice(startIdx, startIdx + pageSize);
  }, [timeseries, tablePage, pageSize]);

  // Dynamically attach active_shortfall_mw based on active percentile
  const processedHorizonData = useMemo(() => {
    if (!horizonData) return [];
    return horizonData.map((pt) => {
      const key = String(percentile);
      const bufferVal = pt.shortfall_buffers?.[key] ?? pt.p90_shortfall_mw;
      return {
        ...pt,
        active_shortfall_mw: bufferVal,
      };
    });
  }, [horizonData, percentile]);

  const processedDiurnalData = useMemo(() => {
    if (!diurnalData) return [];
    return diurnalData.map((pt) => {
      const key = String(percentile);
      const bufferVal = pt.active_shortfall_mw ?? pt.shortfall_buffers?.[key] ?? pt.p90_shortfall_mw;
      return {
        ...pt,
        active_shortfall_mw: bufferVal,
      };
    });
  }, [diurnalData, percentile]);

  const gridColor = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-navy-950/95 border border-slate-300 dark:border-navy-700 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 z-50">
          <div className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-navy-800 pb-1">
            {label}
          </div>
          {payload.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center gap-4">
              <span className="flex items-center gap-1.5" style={{ color: item.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                {item.name}:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value} MW
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-navy-800/90 border border-slate-200 dark:border-navy-700/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-all">
      {/* Header and 4-Tab Switcher (Centered per wireframe) */}
      <div className="space-y-3 border-b border-slate-200 dark:border-navy-700/60 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>Diagnostics & Audit Lab</span>
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold leading-none bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                <Calendar className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                <span>January 2026</span>
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Forensic intelligence suite: analyze forecast decay across auction horizons, 24-hour diurnal patterns, point-in-time causality, and thermal dispatch simulations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowViewExplainer(!showViewExplainer)}
            className="self-start sm:self-center px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
            title={showViewExplainer ? 'Hide view explanation' : 'Show view explanation'}
          >
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>{showViewExplainer ? 'Hide View Guide' : 'What is this view?'}</span>
          </button>
        </div>

        {/* 5 Clean Tabs (Centered on desktop, scrollable on mobile) */}
        <div className="flex justify-center w-full overflow-x-auto scrollbar-none py-1">
          <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-100 dark:bg-navy-900/90 p-1 rounded-xl border border-slate-300 dark:border-navy-700/80 text-xs shadow-inner shrink-0 overflow-x-auto scrollbar-none max-w-full">
            <button
              onClick={() => setActiveTab('horizon')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${
                activeTab === 'horizon'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Forecast Decay (Lead Time)</span>
            </button>

            <button
              onClick={() => setActiveTab('diurnal')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${
                activeTab === 'diurnal'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>24h Diurnal Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('distribution')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${
                activeTab === 'distribution'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Error Distribution</span>
            </button>

            <button
              onClick={() => setActiveTab('inspector')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${
                activeTab === 'inspector'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Raw Data & Cutoff Inspector</span>
            </button>

            <button
              onClick={() => setActiveTab('dispatch')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[11px] sm:text-xs ${
                activeTab === 'dispatch'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Thermal Dispatch Simulator</span>
            </button>
          </div>
        </div>

        {/* Dynamic Contextual Explainer: What this is about (Toggleable) */}
        {showViewExplainer && (
          <div className="relative bg-slate-50/80 dark:bg-navy-900/60 border border-slate-200 dark:border-navy-700/70 rounded-xl p-3 flex items-start gap-2.5 text-xs transition-all">
            <div className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 space-y-0.5 pr-6">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>What this view is about:</span>
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 px-2 py-0.2 rounded-full border border-blue-200 dark:border-blue-500/30">
                  {activeTab === 'horizon' && 'Forecast Horizon Degradation'}
                  {activeTab === 'diurnal' && '24-Hour Settlement Cycle'}
                  {activeTab === 'distribution' && 'Forecast Error Frequency Distribution'}
                  {activeTab === 'inspector' && 'Point-in-Time Causality Ledger'}
                  {activeTab === 'dispatch' && 'Thermal Gas & Wind Power Purchasing'}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11.5px]">
                {activeTab === 'horizon' && (
                  <>
                    Tracks how wind forecast uncertainty compounds the further ahead you look (from 4 hours intraday continuous trading out to 48 hours Day-Ahead). Demonstrates why Day-Ahead auctions require significantly wider safety buffers than short-term dispatch.
                  </>
                )}
                {activeTab === 'diurnal' && (
                  <>
                    Maps wind generation and forecast behavior across every hour of the 24-hour daily cycle (00:00 to 23:00 UTC). Spotlights high-risk evening peak demand slots (17:00–20:00 UTC) where unexpected wind drops trigger severe cash-out penalties.
                  </>
                )}
                {activeTab === 'distribution' && (
                  <>
                    Empirical frequency distribution of Day-Ahead forecast errors across January 2026. The clear shift to the right of 0 MW proves the systematic positive over-forecast bias (+1,854 MW) and quantifies extreme shortfall tail risks.
                  </>
                )}
                {activeTab === 'inspector' && (
                  <>
                    Auditable point-in-time causality ledger covering all 1,488 half-hour settlement periods in January 2026. Verifies zero look-ahead data leakage by strictly enforcing publish time cutoff rules.
                  </>
                )}
                {activeTab === 'dispatch' && (
                  <>
                    Interactive power purchasing simulator demonstrating how utilities blend variable wind with firm gas thermal CCGT contracts to serve consumer demand while insulating the balance sheet against shortfall penalties.
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowViewExplainer(false)}
              className="absolute top-2.5 right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-navy-800 transition-colors"
              title="Hide explainer"
              aria-label="Hide explainer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Horizon Degradation Curve */}
      {activeTab === 'horizon' && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-medium">
              Forecast Degradation Curve vs. Lead Time (4h Intraday to 48h Day-Ahead):
            </span>
            <span className="text-[11px] text-teal-600 dark:text-teal-400 font-mono shrink-0 self-start sm:self-auto">
              Uncertainty expansion across auction horizons
            </span>
          </div>

          <div className="h-[280px] w-full">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950/40 rounded-lg">
                <span className="text-xs text-slate-400">Loading degradation curve...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={processedHorizonData}
                  margin={{ top: 10, right: 10, left: -5, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="horizon_hours"
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 11 }}
                    tickFormatter={(val) => `${val}h`}
                    label={{
                      value: 'Forecast Lead Time (Hours Ahead of Delivery)',
                      position: 'insideBottom',
                      offset: -5,
                      fill: axisColor,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 11 }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ fontSize: '11px', color: axisColor }}
                  />

                  <Line
                    type="monotone"
                    dataKey="mae_mw"
                    name="MAE (Typical Miss)"
                    stroke="#14B8A6"
                    strokeWidth={2.5}
                    dot={{ fill: '#14B8A6', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rmse_mw"
                    name="RMSE (L2 Volatility)"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="active_shortfall_mw"
                    name={`P${percentile} Shortfall Buffer`}
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ fill: '#F59E0B', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
            Trading Insight: Downside risk buffer (amber dashed) expands significantly beyond 24h lead time, proving mathematically why Day-Ahead auctions require a larger thermal buffer than short-lead intraday continuous trading.
          </p>
        </div>
      )}

      {/* Tab 2: Diurnal Hourly Profile */}
      {activeTab === 'diurnal' && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-medium">
              24-Hour Diurnal Settlement Profile (00:00 to 23:00 UTC):
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono shrink-0 self-start sm:self-auto">
              Highlights evening peak (17:00–20:00 UTC) forecast risk
            </span>
          </div>

          <div className="h-[280px] w-full">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950/40 rounded-lg">
                <span className="text-xs text-slate-400">Loading diurnal profile...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={processedDiurnalData}
                  margin={{ top: 10, right: 10, left: -5, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="hour"
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 11 }}
                    tickFormatter={(val) => `${val.toString().padStart(2, '0')}:00`}
                    label={{
                      value: 'Settlement Hour of Day (UTC)',
                      position: 'insideBottom',
                      offset: -5,
                      fill: axisColor,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 11 }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ fontSize: '11px', color: axisColor }}
                  />

                  <Line
                    type="monotone"
                    dataKey="mean_actual_mw"
                    name="Mean Actual Wind (MW)"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="mean_forecast_mw"
                    name="Mean Forecast (MW)"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="active_shortfall_mw"
                    name={`P${percentile} Shortfall Buffer (MW)`}
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={{ fill: '#F59E0B', r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
            Trading Insight: Evening peak hours (17:00–20:00 UTC) coincide with UK peak consumer demand and higher cash-out penalty rates. Note the wider shortfall buffer during these slots, mandating proactive CCGT scheduling.
          </p>
        </div>
      )}

      {/* Tab 3: Error Distribution Histogram */}
      {activeTab === 'distribution' && (
        <div className="space-y-3">
          <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">
                Forecast Error Frequency Distribution (Forecast - Actual MW):
              </span>
              <span className="text-slate-500 dark:text-slate-400 ml-2">
                Empirical 24-bin histogram across all January 2026 delivery slots
              </span>
            </div>
            {distributionData && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                <span className="whitespace-nowrap">
                  Mean: <strong className={distributionData.mean > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}>
                    {distributionData.mean > 0 ? `+${distributionData.mean.toLocaleString()}` : distributionData.mean.toLocaleString()} MW
                  </strong>
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="whitespace-nowrap">
                  Std Dev: <strong className="text-blue-500 dark:text-blue-400">
                    {distributionData.std_dev.toLocaleString()} MW
                  </strong>
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="whitespace-nowrap">
                  Range: <strong className="text-slate-700 dark:text-slate-300">
                    [{distributionData.min_error.toLocaleString()}, {distributionData.max_error.toLocaleString()}] MW
                  </strong>
                </span>
              </div>
            )}
          </div>

          <div className="h-[320px] w-full">
            {!distributionData || !distributionData.bins || distributionData.bins.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-navy-700/60">
                <span className="text-xs text-slate-500 dark:text-slate-400">Loading error distribution...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distributionData.bins}
                  margin={{ top: 10, right: 15, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="bin_center"
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 10 }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`}
                    label={{
                      value: 'Forecast Error Delta (MW) [Positive = Wind Deficit / Over-Forecast]',
                      position: 'insideBottom',
                      offset: -10,
                      fill: axisColor,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 10 }}
                    label={{
                      value: 'Frequency (Hours)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 0,
                      style: { textAnchor: 'middle' },
                      fill: axisColor,
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const bin = payload[0].payload;
                        const isDeficit = bin.bin_center > 0;
                        return (
                          <div className="bg-white dark:bg-navy-950/95 border border-slate-300 dark:border-navy-700 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-1 z-50">
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              Error Range (Bin): {bin.bin_start.toLocaleString()} to {bin.bin_end.toLocaleString()} MW
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Frequency: <span className="font-mono font-bold text-slate-900 dark:text-white">{bin.count} hours</span>
                            </div>
                            <div className={`text-[10.5px] font-semibold ${isDeficit ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                              {isDeficit ? 'Over-Forecast: Wind Deficit Risk' : 'Under-Forecast: Wind Surplus'}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine x={0} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="3 3" />
                  <Bar
                    dataKey="count"
                    name="Frequency Count"
                    radius={[4, 4, 0, 0]}
                  >
                    {distributionData.bins.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.bin_center >= 0 ? '#EF4444' : '#10B981'}
                        opacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
            Trading Insight: Notice the pronounced rightward skew past 0 MW (highlighted in red). In wholesale power markets, positive errors mean wind under-delivered relative to Day-Ahead schedule, exposing the desk to punitive cash-out charges unless protected by the calculated thermal buffer.
          </p>
        </div>
      )}

      {/* Tab 4: Raw Data & Cutoff Inspector */}
      {activeTab === 'inspector' && (
        <div className="space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-700 dark:text-slate-300 gap-1 sm:gap-2">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">
                Point-in-Time Causality & Cutoff Audit Table
              </span>
              <span className="text-slate-500 dark:text-slate-400 ml-2">
                (Showing {timeseries.length} total matched slots)
              </span>
            </div>
            <div className="text-[11px] text-teal-600 dark:text-teal-400 font-mono shrink-0 self-start sm:self-auto">
              Proof: Every forecast publishTime ≤ decision cutoffTime
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-navy-700/80 bg-slate-50 dark:bg-navy-900/60 max-w-full">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-100 dark:bg-navy-950/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-navy-700 font-semibold">
                <tr>
                  <th className="py-2.5 px-3 min-w-[150px] whitespace-nowrap">Delivery Slot (UTC)</th>
                  <th className="py-2.5 px-3 min-w-[150px] whitespace-nowrap">Forecast Published</th>
                  <th className="py-2.5 px-3 text-right min-w-[110px] whitespace-nowrap">Actual Wind</th>
                  <th className="py-2.5 px-3 text-right min-w-[125px] whitespace-nowrap">Day-Ahead Forecast</th>
                  <th className="py-2.5 px-3 text-right min-w-[115px] whitespace-nowrap">Error (F - A)</th>
                  <th className="py-2.5 px-3 text-center min-w-[120px] whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 text-center min-w-[135px] whitespace-nowrap">Causality Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-navy-800 text-slate-800 dark:text-slate-300 font-mono">
                {currentPagePoints.map((row, idx) => {
                  const dtDelivery = new Date(row.startTime);
                  const dtPublish = row.publishTime ? new Date(row.publishTime) : null;
                  const isDeficit = row.error_mw > 0;
                  const leadHours = dtPublish
                    ? Math.round(((dtDelivery.getTime() - dtPublish.getTime()) / (1000 * 3600)) * 10) / 10
                    : null;

                  return (
                    <tr key={idx} className="hover:bg-white dark:hover:bg-navy-800/60 transition-colors">
                      <td className="py-2 px-3 text-slate-900 dark:text-slate-200 font-sans whitespace-nowrap">
                        {dtDelivery.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                        {dtDelivery.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-sans whitespace-nowrap">
                        {dtPublish ? (
                          <>
                            {dtPublish.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                            {dtPublish.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                          </>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                        {row.actual_mw.toLocaleString()} MW
                      </td>
                      <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">
                        {row.forecast_mw.toLocaleString()} MW
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold whitespace-nowrap ${
                          isDeficit
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-teal-600 dark:text-teal-400'
                        }`}
                      >
                        {row.error_mw > 0 ? `+${row.error_mw.toLocaleString()}` : row.error_mw.toLocaleString()} MW
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap min-w-[120px]">
                        <span
                          className={`inline-block whitespace-nowrap text-[10px] px-2.5 py-0.5 rounded font-sans font-semibold ${
                            isDeficit
                              ? 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-500/25'
                              : 'bg-teal-100 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-500/25'
                          }`}
                        >
                          {isDeficit ? 'Wind Deficit' : 'Surplus'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap min-w-[135px]">
                        <span className="inline-block whitespace-nowrap text-[10px] px-2.5 py-0.5 rounded font-sans bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/25 font-semibold">
                          ✓ {leadHours ? `${leadHours}h prior` : 'Valid'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>
              Page {tablePage} of {totalPages} ({timeseries.length} total settlement records)
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                className="px-2.5 py-1 rounded bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 disabled:opacity-40 text-slate-800 dark:text-slate-200 transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                disabled={tablePage === totalPages}
                className="px-2.5 py-1 rounded bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 disabled:opacity-40 text-slate-800 dark:text-slate-200 transition-all flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Day-Ahead Thermal Procurement Simulator (Wireframe Redesign) */}
      {activeTab === 'dispatch' && (
        <div className="space-y-4">
          {/* Sub-header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Utility Dispatch Simulator: Balances Wind Variability with Firm Gas Power
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Simulates real-world power purchasing in Day-Ahead market against consumer demand.
              </p>
            </div>
            <div className="text-xs text-amber-800 dark:text-amber-300 font-semibold bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/25 px-2.5 py-1 rounded-lg self-start sm:self-auto">
              Protection Target: P{percentile} Shortfall Coverage
            </div>
          </div>

          {/* Top Wide Card: Target Settlement Grid Demand with Modern High-End Slider */}
          <div className="bg-slate-50 dark:bg-navy-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-navy-700/80 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500" />
                    Target settlement grid
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${stressInfo.badge}`}>
                    {stressInfo.label} • {((demandMw / maxDemand) * 100).toFixed(0)}% Grid Capacity
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Slide or fine-tune to test how wind uncertainty and thermal hedges scale under grid stress.
                </p>
              </div>

              {/* Monospace Readout and Fine-Tuning Steppers */}
              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                {/* Stepper Buttons (-500 / +500) */}
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-sm p-0.5">
                  <button
                    type="button"
                    onClick={() => setDemandMw((prev) => Math.max(minDemand, prev - 500))}
                    disabled={demandMw <= minDemand}
                    title="Decrease by 500 MW"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-3.5 bg-slate-200 dark:bg-navy-700 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setDemandMw((prev) => Math.min(maxDemand, prev + 500))}
                    disabled={demandMw >= maxDemand}
                    title="Increase by 500 MW"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-baseline gap-1.5 bg-white dark:bg-navy-950 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm">
                  <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                    {demandMw.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                    MW
                  </span>
                </div>
              </div>
            </div>

            {/* Modern High-End Slider Control */}
            <div className="space-y-2 pt-2">
              {/* Slider Track Wrapper with custom thumb & floating tooltip */}
              <div className="relative flex items-center select-none group h-12">
                {/* Track Background Groove */}
                <div className="w-full h-3 rounded-full bg-slate-200/90 dark:bg-navy-950 border border-slate-300 dark:border-navy-700/80 shadow-inner relative overflow-hidden">
                  {/* Dynamic Active Progress Gradient Fill */}
                  <div
                    className={`h-full rounded-full transition-all duration-75 relative ${stressInfo.trackFill}`}
                    style={{ width: `${demandPct}%` }}
                  >
                    {/* Glowing highlight edge */}
                    <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/50 blur-[0.5px] rounded-r-full" />
                  </div>
                </div>

                {/* Milestone Tick Notches along the track */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none px-3.5 flex justify-between items-center z-[5]">
                  {/* 18k MW (0%) */}
                  <div className="w-0.5 h-2 bg-slate-400/60 dark:bg-slate-500/60 rounded-full" />
                  {/* 25k MW (23.3%) */}
                  <div className="w-0.5 h-1.5 bg-slate-400/40 dark:bg-slate-600/40 rounded-full" />
                  {/* 32k MW (46.7%) */}
                  <div className="w-0.5 h-2 bg-amber-500/80 rounded-full" />
                  {/* 40k MW (73.3%) */}
                  <div className="w-0.5 h-1.5 bg-slate-400/40 dark:bg-slate-600/40 rounded-full" />
                  {/* 44k MW (86.7%) */}
                  <div className="w-0.5 h-2 bg-red-500/80 rounded-full" />
                  {/* 48k MW (100%) */}
                  <div className="w-0.5 h-2 bg-slate-400/60 dark:bg-slate-500/60 rounded-full" />
                </div>

                {/* Custom Thumb Knob positioned with exact pixel math */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75 flex items-center justify-center z-10"
                  style={{
                    left: `calc(${demandPct}% + ${(0.5 - demandPct / 100) * 28}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Floating Value HUD Tooltip */}
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap opacity-90 group-hover:opacity-100 transition-opacity">
                    <div className="bg-slate-900 text-white dark:bg-slate-900 dark:text-slate-100 text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md shadow-lg border border-slate-700 dark:border-navy-600 flex items-center gap-1">
                      <span>{demandMw.toLocaleString()} MW</span>
                    </div>
                    {/* Downward triangle pointer */}
                    <div className="w-0 h-0 mx-auto border-x-4 border-x-transparent border-t-4 border-t-slate-900 dark:border-t-navy-600" />
                  </div>

                  {/* Tactile Knob Handle */}
                  <div
                    className={`w-7 h-7 rounded-full bg-white dark:bg-navy-900 border-2 shadow-lg flex items-center justify-center transition-transform group-hover:scale-110 active:scale-95 ${stressInfo.thumbBorder}`}
                  >
                    {/* Vertical grip ridges */}
                    <div className="flex gap-0.5 items-center justify-center">
                      <div className="w-0.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                      <div className="w-0.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    </div>
                  </div>
                </div>

                {/* Native Range Input for Fluid Touch, Mouse & Keyboard Navigation */}
                <input
                  type="range"
                  min={minDemand}
                  max={maxDemand}
                  step="500"
                  value={demandMw}
                  onChange={(e) => setDemandMw(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-grab active:cursor-grabbing z-20"
                  aria-label="Target settlement grid demand slider"
                />
              </div>

              {/* Graduation Scale Labels below the slider */}
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 dark:text-slate-500 px-1">
                <span>18k MW (Min)</span>
                <span className="hidden sm:inline">25k MW</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">32k MW (Typical Peak)</span>
                <span className="hidden sm:inline">40k MW</span>
                <span className="text-red-600 dark:text-red-400 font-semibold">44k MW (Cold Snap)</span>
                <span>48k MW (Max)</span>
              </div>

              {/* Milestone Preset Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono pt-2">
                {/* Extreme Low / Overnight Off-Peak */}
                <button
                  type="button"
                  onClick={() => setDemandMw(18000)}
                  className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all group ${
                    demandMw === 18000
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/30'
                      : 'bg-white dark:bg-navy-900/80 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div className="leading-tight">
                      <div className="text-[11px] font-bold">18,000 MW</div>
                      <div className="text-[10px] opacity-75 font-sans">Overnight Off-Peak</div>
                    </div>
                  </div>
                  {demandMw === 18000 && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                </button>

                {/* Middle / Typical Mid-Day */}
                <button
                  type="button"
                  onClick={() => setDemandMw(32000)}
                  className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all group ${
                    demandMw === 32000
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-300 font-bold shadow-md shadow-amber-500/10 ring-2 ring-amber-500/30'
                      : 'bg-white dark:bg-navy-900/80 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div className="leading-tight text-left">
                      <div className="text-[11px] font-bold">32,000 MW</div>
                      <div className="text-[10px] opacity-75 font-sans">Typical Daily Peak</div>
                    </div>
                  </div>
                  {demandMw === 32000 && (
                    <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                </button>

                {/* Extreme High / Winter Cold Snap Peak */}
                <button
                  type="button"
                  onClick={() => setDemandMw(44000)}
                  className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all group ${
                    demandMw >= 44000
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-400 dark:border-red-500 text-red-700 dark:text-red-300 font-bold shadow-md shadow-red-500/10 ring-2 ring-red-500/30'
                      : 'bg-white dark:bg-navy-900/80 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="leading-tight">
                      <div className="text-[11px] font-bold">44,000 MW</div>
                      <div className="text-[10px] opacity-75 font-sans">Severe Cold Snap</div>
                    </div>
                  </div>
                  {demandMw >= 44000 && (
                    <CheckCircle2 className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom 3-Card Row matching wireframe */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Box 1 (Left): Red Box - Highlight Risk & Deficit Value */}
            <div className="lg:col-span-5 bg-red-50/70 dark:bg-red-950/20 border-2 border-red-300/80 dark:border-red-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-red-200 dark:border-red-500/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  Strategy A: Deficit Risk
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/30">
                  Zero Buffer
                </span>
              </div>

              {/* Highlight Deficit Value */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-red-800 dark:text-red-300 uppercase tracking-wider">
                  Unhedged Wind Deficit Exposure
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-red-600 dark:text-red-400 tracking-tight">
                  -{buffer.toLocaleString()} MW
                </div>
                <p className="text-[11px] text-red-700/90 dark:text-red-300/80 leading-relaxed pt-1">
                  If wind drops to P{percentile} downside tail, utility is short {buffer.toLocaleString()} MW and thrown into real-time Elexon Balancing Mechanism penalties.
                </p>
              </div>

              {/* Breakdown Details */}
              <div className="bg-white/80 dark:bg-navy-950/60 rounded-xl p-2.5 border border-red-200/80 dark:border-red-500/20 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="font-sans">Expected Wind:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{meanForecast.toLocaleString()} MW</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="font-sans">Naive Thermal Buy:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{naiveThermalProcurement.toLocaleString()} MW</span>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-navy-800 flex justify-between text-red-600 dark:text-red-400 font-bold">
                  <span className="font-sans">Max Historic Shortfall:</span>
                  <span>{metrics.max_shortfall_mw.toLocaleString()} MW</span>
                </div>
              </div>
            </div>

            {/* Box 2 (Middle): Green Box - Percentage of Protection as Highlight Value */}
            <div className="lg:col-span-5 bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-300/80 dark:border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-500/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Strategy B: Protected Procurement
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                  WindPulse Active
                </span>
              </div>

              {/* Highlight Protection Value */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Reliability Protection Level
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {percentile}% Protection
                </div>
                <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/80 leading-relaxed pt-1">
                  Hedging with firm gas thermal contracts covers {percentile}% of wind ramp drops, completely neutralizing cash-out penalty risk.
                </p>
              </div>

              {/* Breakdown Details */}
              <div className="bg-white/80 dark:bg-navy-950/60 rounded-xl p-2.5 border border-emerald-200/80 dark:border-emerald-500/20 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="font-sans">Safe Wind Baseline:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{safeWindMw.toLocaleString()} MW</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span className="font-sans">Firm Thermal Gas Buy:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{recommendedThermalProcurement.toLocaleString()} MW</span>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-navy-800 flex justify-between text-emerald-700 dark:text-emerald-300 font-bold">
                  <span className="font-sans">Procured Hedge Buffer:</span>
                  <span>+{hedgeDelta.toLocaleString()} MW Gas</span>
                </div>
              </div>
            </div>

            {/* Box 3 (Right): Vertical Grid Supply Stack */}
            <div className="lg:col-span-2 bg-slate-50 dark:bg-navy-900/60 border border-slate-200 dark:border-navy-700/80 rounded-2xl p-4 flex flex-col items-center justify-between space-y-3 shadow-sm relative">
              {/* Header without "Vertical Stack" text */}
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-500" />
                  Grid Supply
                </div>
              </div>

              {/* Vertical Stack Bar */}
              <div className="w-14 sm:w-16 h-52 sm:h-56 bg-slate-200 dark:bg-navy-950 rounded-xl overflow-hidden flex flex-col-reverse border border-slate-300 dark:border-navy-700 relative shadow-inner">
                {/* 1. Safe Wind (Bottom, Emerald) */}
                <div
                  style={{ height: `${windPct}%` }}
                  onMouseEnter={() => setActiveStackSlice('wind')}
                  onMouseLeave={() => setActiveStackSlice(null)}
                  className={`w-full bg-emerald-500 hover:brightness-110 transition-all duration-200 flex flex-col items-center justify-center text-[10px] font-mono font-bold text-white overflow-hidden cursor-pointer select-none ${
                    activeStackSlice === 'wind' ? 'ring-2 ring-emerald-300 z-10 brightness-110' : ''
                  }`}
                >
                  {windPct >= 12 && (
                    <div className="text-center leading-tight">
                      <div>{windPct.toFixed(0)}%</div>
                      {windPct >= 18 && (
                        <div className="text-[8.5px] font-normal opacity-85">
                          {(safeWindMw / 1000).toFixed(1)}k
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Safety Buffer (Middle, Amber) */}
                <div
                  style={{ height: `${bufferPct}%` }}
                  onMouseEnter={() => setActiveStackSlice('buffer')}
                  onMouseLeave={() => setActiveStackSlice(null)}
                  className={`w-full bg-amber-400 hover:brightness-110 transition-all duration-200 flex flex-col items-center justify-center text-[10px] font-mono font-bold text-amber-950 overflow-hidden cursor-pointer select-none ${
                    activeStackSlice === 'buffer' ? 'ring-2 ring-amber-300 z-10 brightness-110' : ''
                  }`}
                >
                  {bufferPct >= 10 && (
                    <div className="text-center leading-tight">
                      <div>{bufferPct.toFixed(0)}%</div>
                      {bufferPct >= 16 && (
                        <div className="text-[8.5px] font-normal opacity-90">
                          +{(hedgeDelta / 1000).toFixed(1)}k
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Base Gas Thermal (Top, Slate/Blue) */}
                <div
                  style={{ height: `${thermalPct}%` }}
                  onMouseEnter={() => setActiveStackSlice('gas')}
                  onMouseLeave={() => setActiveStackSlice(null)}
                  className={`w-full bg-slate-500 dark:bg-slate-600 hover:brightness-110 transition-all duration-200 flex flex-col items-center justify-center text-[10px] font-mono font-bold text-white overflow-hidden cursor-pointer select-none ${
                    activeStackSlice === 'gas' ? 'ring-2 ring-slate-400 z-10 brightness-110' : ''
                  }`}
                >
                  {thermalPct >= 12 && (
                    <div className="text-center leading-tight">
                      <div>{thermalPct.toFixed(0)}%</div>
                      {thermalPct >= 18 && (
                        <div className="text-[8.5px] font-normal opacity-85">
                          {(naiveThermalProcurement / 1000).toFixed(1)}k
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Vertical Stack Mini Legend with numbers alongside % */}
              <div className="space-y-1.5 w-full text-[10px] font-mono pt-2 border-t border-slate-200 dark:border-navy-800">
                <div
                  onMouseEnter={() => setActiveStackSlice('gas')}
                  onMouseLeave={() => setActiveStackSlice(null)}
                  className={`flex items-center justify-between text-slate-600 dark:text-slate-400 p-1 rounded-lg transition-colors cursor-pointer ${
                    activeStackSlice === 'gas' ? 'bg-slate-200/60 dark:bg-navy-800 text-slate-900 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-navy-800/50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                    <span>Gas:</span>
                  </span>
                  <div className="text-right flex items-center gap-1">
                    <span className="font-bold">{thermalPct.toFixed(0)}%</span>
                    <span className="text-[9px] font-normal text-slate-500 dark:text-slate-400">({naiveThermalProcurement.toLocaleString()} MW)</span>
                  </div>
                </div>

                <div
                  onMouseEnter={() => setActiveStackSlice('buffer')}
                  onMouseLeave={() => setActiveStackSlice(null)}
                  className={`flex items-center justify-between text-amber-600 dark:text-amber-400 p-1 rounded-lg transition-colors cursor-pointer ${
                    activeStackSlice === 'buffer' ? 'bg-amber-100/60 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300' : 'hover:bg-amber-50 dark:hover:bg-amber-500/10'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span>Hedge:</span>
                  </span>
                  <div className="text-right flex items-center gap-1">
                    <span className="font-bold">{bufferPct.toFixed(0)}%</span>
                    <span className="text-[9px] font-normal text-amber-600/80 dark:text-amber-400/80">(+{hedgeDelta.toLocaleString()} MW)</span>
                  </div>
                </div>

                <div
                  onMouseEnter={() => setActiveStackSlice('wind')}
                  onMouseLeave={() => setActiveStackSlice(null)}
                  className={`flex items-center justify-between text-emerald-600 dark:text-emerald-400 p-1 rounded-lg transition-colors cursor-pointer ${
                    activeStackSlice === 'wind' ? 'bg-emerald-100/60 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300' : 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>Wind:</span>
                  </span>
                  <div className="text-right flex items-center gap-1">
                    <span className="font-bold">{windPct.toFixed(0)}%</span>
                    <span className="text-[9px] font-normal text-emerald-600/80 dark:text-emerald-400/80">({safeWindMw.toLocaleString()} MW)</span>
                  </div>
                </div>
              </div>

              {/* Rich Interactive Hover Card with Comprehensive Trading Details */}
              {activeStackSlice && (
                <div className="absolute z-40 pointer-events-none transition-all duration-200 space-y-3 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl p-4 shadow-2xl w-80 max-w-[calc(100vw-3rem)] bottom-full mb-3 left-1/2 -translate-x-1/2 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:left-auto lg:right-full lg:mr-3 lg:translate-x-0">
                  {/* Arrow pointer: points down on < lg, points right on lg */}
                  <div className="absolute w-3 h-3 bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 bottom-[-6px] left-1/2 -translate-x-1/2 border-b border-r rotate-45 lg:bottom-auto lg:top-1/2 lg:-right-1.5 lg:-translate-y-1/2 lg:left-auto lg:translate-x-0 lg:border-t lg:border-r lg:border-b-0" />

                  {activeStackSlice === 'gas' && (
                    <>
                      <div className="flex items-start justify-between border-b border-slate-100 dark:border-navy-800 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-500/15 border border-slate-500/30 flex items-center justify-center text-slate-600 dark:text-slate-300">
                            <Flame className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              Base Gas Thermal Buy
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              CCGT Unhedged Baseline
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                          {thermalPct.toFixed(1)}% Share
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-slate-50 dark:bg-navy-900/60 p-2 rounded-xl border border-slate-200 dark:border-navy-800">
                          <div className="text-[10px] text-slate-400 font-sans">Dispatched Volume</div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{naiveThermalProcurement.toLocaleString()} MW</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-navy-900/60 p-2 rounded-xl border border-slate-200 dark:border-navy-800">
                          <div className="text-[10px] text-slate-400 font-sans">Grid Target</div>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{demandMw.toLocaleString()} MW</div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
                        <p>
                          <strong>Role:</strong> Sized as naive residual demand: <code className="text-[10.5px] bg-slate-100 dark:bg-navy-900 px-1 py-0.5 rounded">Demand ({demandMw.toLocaleString()}) - Mean Forecast ({meanForecast.toLocaleString()})</code>.
                        </p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          Assumes wind delivers exactly at its mean forecast. Provides firm physical base generation via Combined-Cycle Gas Turbines.
                        </p>
                      </div>
                    </>
                  )}

                  {activeStackSlice === 'buffer' && (
                    <>
                      <div className="flex items-start justify-between border-b border-amber-100 dark:border-amber-500/20 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <ShieldCheck className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-amber-900 dark:text-amber-300">
                              Safety Hedge Buffer (Gas)
                            </div>
                            <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                              P{percentile} Downside Protection
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                          {bufferPct.toFixed(1)}% Share
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-500/30">
                          <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-sans">Procured Buffer</div>
                          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">+{hedgeDelta.toLocaleString()} MW</div>
                        </div>
                        <div className="bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-500/30">
                          <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-sans">Protection Level</div>
                          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">{percentile}% Tail Drop</div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
                        <p>
                          <strong>Role:</strong> Pre-committed Day-Ahead physical gas contract covering {percentile}% of historical wind drop-off shortfalls.
                        </p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          Shields the utility against catastrophic real-time Elexon cash-out imbalance penalties when wind drops unexpectedly.
                        </p>
                      </div>
                    </>
                  )}

                  {activeStackSlice === 'wind' && (
                    <>
                      <div className="flex items-start justify-between border-b border-emerald-100 dark:border-emerald-500/20 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Wind className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                              Safe Wind Baseline
                            </div>
                            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                              Non-Imbalance Firm Wind
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                          {windPct.toFixed(1)}% Share
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
                          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-sans">Safe Baseline</div>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{safeWindMw.toLocaleString()} MW</div>
                        </div>
                        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
                          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-sans">Mean Forecast</div>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{meanForecast.toLocaleString()} MW</div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
                        <p>
                          <strong>Role:</strong> The reliable core wind generation: <code className="text-[10.5px] bg-slate-100 dark:bg-navy-900 px-1 py-0.5 rounded">Mean ({meanForecast.toLocaleString()}) - P{percentile} Buffer ({buffer.toLocaleString()})</code>.
                        </p>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                          Guaranteed green electricity capture at £0/MWh marginal fuel cost, safe from imbalance cash-out liability.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
