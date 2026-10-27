import React, { useState, useMemo } from 'react';
import { ShieldAlert, Info, X, Calendar, ChevronLeft, ChevronRight, Scale, AlertTriangle, TrendingUp } from 'lucide-react';
import { MetricsSummary } from '../types';

interface HeadlineHeroCardProps {
  targetDate: string;
  onTargetDateChange: (date: string) => void;
  targetDayForecastMw: number;
  historicalMetrics: MetricsSummary;
  historicalSampleCount: number;
  percentile: number;
  isLoading: boolean;
}

export const HeadlineHeroCard: React.FC<HeadlineHeroCardProps> = ({
  targetDate,
  onTargetDateChange,
  targetDayForecastMw,
  historicalMetrics,
  historicalSampleCount,
  percentile,
  isLoading,
}) => {
  const [showAccuracyInfo, setShowAccuracyInfo] = useState(false);

  // Format Target Date for Title & Subtitle
  const dtTarget = useMemo(() => new Date(`${targetDate}T00:00:00Z`), [targetDate]);

  const formattedDateUpper = useMemo(() => {
    return dtTarget
      .toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
      .toUpperCase();
  }, [dtTarget]);

  const formattedDateNormal = useMemo(() => {
    return dtTarget.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }, [dtTarget]);

  // Previous Day (Decision Date: 09:30 UTC on Day D-1)
  const prevDayFormatted = useMemo(() => {
    const prevMs = dtTarget.getTime() - 24 * 3600 * 1000;
    return new Date(prevMs).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }, [dtTarget]);

  // Navigation handlers for Target Date picker
  const handlePrevDay = () => {
    const t = dtTarget.getTime() - 24 * 3600 * 1000;
    const prevIso = new Date(t).toISOString().slice(0, 10);
    if (prevIso >= '2026-01-01') onTargetDateChange(prevIso);
  };

  const handleNextDay = () => {
    const t = dtTarget.getTime() + 24 * 3600 * 1000;
    const nextIso = new Date(t).toISOString().slice(0, 10);
    if (nextIso <= '2026-01-31') onTargetDateChange(nextIso);
  };

  // Dynamic accuracy percentage from historical point-in-time metrics: 100% - NMAE%
  const accuracyPct = useMemo(() => {
    if (historicalMetrics.norm_mae_pct == null || isNaN(historicalMetrics.norm_mae_pct)) return 82.8;
    const raw = 100 - historicalMetrics.norm_mae_pct;
    return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
  }, [historicalMetrics.norm_mae_pct]);

  const formattedAccuracy = historicalSampleCount === 0
    ? '--'
    : Number.isInteger(accuracyPct)
    ? `${accuracyPct}%`
    : `${accuracyPct.toFixed(1)}%`;

  // Color tiers: >=85% Green, 70-84.9% Amber, 50-69.9% Orange, <50% Red
  const confidenceStyle = useMemo(() => {
    if (accuracyPct >= 85) {
      return {
        stroke: '#10B981',
        textClass: 'text-emerald-500 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-500/10',
        label: 'High Confidence',
      };
    } else if (accuracyPct >= 70) {
      return {
        stroke: '#F59E0B',
        textClass: 'text-amber-500 dark:text-amber-400',
        bgClass: 'bg-amber-50 dark:bg-amber-500/10',
        label: 'Moderate Risk',
      };
    } else if (accuracyPct >= 50) {
      return {
        stroke: '#F97316',
        textClass: 'text-orange-500 dark:text-orange-400',
        bgClass: 'bg-orange-50 dark:bg-orange-500/10',
        label: 'Elevated Risk',
      };
    } else {
      return {
        stroke: '#EF4444',
        textClass: 'text-red-500 dark:text-red-400',
        bgClass: 'bg-red-50 dark:bg-red-500/10',
        label: 'Low Reliability',
      };
    }
  }, [accuracyPct]);

  // SVG Progress Ring geometry
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (accuracyPct / 100) * circumference;

  // Track record date range text
  const trackRecordRangeText = useMemo(() => {
    if (targetDate === '2026-01-01') return '01 Jan Baseline';
    return `01 Jan – ${prevDayFormatted}`;
  }, [targetDate, prevDayFormatted]);

  return (
    <div className="bg-white dark:bg-navy-800/90 border border-slate-200 dark:border-navy-700/80 rounded-2xl p-5 sm:p-6 shadow-sm transition-all space-y-4">
      {/* Top Header Row: Section Title + Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-navy-700/60 pb-3">
        <div>
          <div className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
            <span>TARGET DAY FORECAST ({formattedDateUpper})</span>
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold leading-none bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 shrink-0 whitespace-nowrap">
              Auction Delivery Day
            </span>
          </div>
        </div>

        {/* Small Elegant Date Picker on Top-Right Corner */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-xl p-1 shadow-sm shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePrevDay}
            disabled={targetDate <= '2026-01-01'}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous Day in January 2026"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hidden md:inline">
              Target Day:
            </span>
            <input
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={targetDate}
              onChange={(e) => onTargetDateChange(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
              title="Pick any date in January 2026"
            />
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            disabled={targetDate >= '2026-01-31'}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next Day in January 2026"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: 3 Distinct Functional Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        {/* Column 1 (md: 1 col, lg: 4 cols): Tomorrow Forecast Daily Average + Confidence Gauge */}
        <div className="md:col-span-1 lg:col-span-4 flex flex-col justify-between bg-slate-50/50 dark:bg-navy-900/40 p-3 sm:p-3.5 rounded-xl border border-slate-200/70 dark:border-navy-700/60">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Day-Ahead Prediction
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight flex items-center h-12 sm:h-14">
                  {isLoading ? (
                    <div className="h-8 w-32 bg-slate-200 dark:bg-navy-700 animate-pulse rounded-lg"></div>
                  ) : (
                    `${targetDayForecastMw.toLocaleString()} MW`
                  )}
                </div>
                <div className="text-xs font-semibold text-teal-700 dark:text-teal-400 mt-0.5">
                  Mean Day-Ahead Wind Generation
                </div>
              </div>

              {/* Circular Confidence Gauge */}
              <div className="flex flex-col items-center justify-center shrink-0 relative">
                <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                  <svg className="w-14 h-14 shrink-0 -rotate-90 transform" viewBox="0 0 72 72">
                    <circle
                      cx="36"
                      cy="36"
                      r={radius}
                      className="stroke-slate-200 dark:stroke-navy-700/80"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <circle
                      cx="36"
                      cy="36"
                      r={radius}
                      stroke={confidenceStyle.stroke}
                      strokeWidth="5"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xs sm:text-[13px] font-extrabold font-mono tracking-tight ${confidenceStyle.textClass}`}>
                      {formattedAccuracy}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-0.5 relative">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    Confidence
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAccuracyInfo(!showAccuracyInfo)}
                    className={`p-0.5 rounded-full transition-colors focus:outline-none ${
                      showAccuracyInfo
                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 ring-2 ring-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                    aria-label="How Forecast Accuracy & Confidence is calculated"
                    title="Click for calculation details"
                  >
                    <Info className="w-3 h-3" />
                  </button>

                  {/* Accuracy Explainer Popover (Floating balloon style) */}
                  {showAccuracyInfo && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowAccuracyInfo(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 max-w-[calc(100vw-2rem)] p-3.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl text-left text-xs animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-2 mb-2">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-emerald-500" />
                            <span>Point-in-Time Confidence</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAccuracyInfo(false)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mb-2.5">
                          Calculated strictly on historical data known prior to {formattedDateNormal} ({trackRecordRangeText}):
                        </p>

                        <div className="bg-slate-100 dark:bg-navy-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-navy-800 font-mono text-[11px] space-y-1 mb-2.5">
                          <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                            Formula
                          </div>
                          <div className="text-slate-900 dark:text-white font-semibold">
                            Confidence = 100% − NMAE%
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 pt-0.5 border-t border-slate-200/50 dark:border-navy-800">
                            = 100% − {historicalMetrics.norm_mae_pct.toFixed(1)}% = <span className={`font-bold ${confidenceStyle.textClass}`}>{formattedAccuracy}</span>
                          </div>
                        </div>

                        <div className={`p-1.5 rounded-md text-[10.5px] font-medium flex items-center justify-between ${confidenceStyle.bgClass} ${confidenceStyle.textClass}`}>
                          <span>Status: <strong>{confidenceStyle.label}</strong></span>
                          <span className="font-mono font-bold">{formattedAccuracy}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-navy-700/40 mt-2">
            Decision cutoff: <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{prevDayFormatted}</span>
          </div>
        </div>

        {/* Column 2 (md: 1 col, lg: 3 cols): Recommended Thermal Buffer */}
        <div className="md:col-span-1 lg:col-span-3 bg-amber-500/5 dark:bg-navy-900/80 border border-amber-400/60 dark:border-amber-500/40 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>RECOMMENDED BUFFER (P{percentile})</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tracking-tight flex items-center h-12 sm:h-14">
              {isLoading ? (
                <div className="h-8 w-32 bg-slate-200 dark:bg-navy-700 animate-pulse rounded-lg"></div>
              ) : (
                `+${historicalMetrics.thermal_buffer_mw.toLocaleString()} MW`
              )}
            </div>
            <div className="text-xs font-semibold text-amber-700/90 dark:text-amber-400 mt-0.5">
              P{percentile} Downside Wind Risk Protection
            </div>
          </div>

          <div className="text-[10.5px] text-amber-800/80 dark:text-amber-200/90 font-medium leading-relaxed pt-1.5 border-t border-amber-300/40 dark:border-amber-500/20 mt-2">
            Procure extra thermal CCGT to cover {percentile}% of historical wind drops up to {formattedDateNormal}.
          </div>
        </div>

        {/* Column 3 (md: 2 cols full width, lg: 5 cols): Point-in-Time Track Record */}
        <div className="md:col-span-2 lg:col-span-5 flex flex-col justify-between bg-slate-50/50 dark:bg-navy-900/40 p-3 sm:p-3.5 rounded-xl border border-slate-200/70 dark:border-navy-700/60">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Point-in-Time Track Record
            </span>
            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-200/70 dark:border-blue-500/20">
              {trackRecordRangeText} ({historicalSampleCount} slots)
            </span>
          </div>

          {/* 3 Compact Cards: On mobile stack or compact side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-auto">
            {/* Card 1: MAE */}
            <div className="bg-white dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-700/70 rounded-lg p-2.5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-bold text-[10.5px]">
                  <Scale className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="truncate">MAE (Mean Error)</span>
                </div>
                <div className="text-sm font-extrabold font-mono text-teal-600 dark:text-teal-400 tracking-tight leading-tight mt-1">
                  {isLoading ? (
                    <span className="inline-block h-4 w-14 bg-slate-200 dark:bg-navy-700 animate-pulse rounded"></span>
                  ) : (
                    `${historicalMetrics.mae_mw.toLocaleString()} MW`
                  )}
                </div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  {isLoading ? '--' : `(${historicalMetrics.norm_mae_pct}% NMAE)`}
                </div>
              </div>
              <div className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-tight pt-1 border-t border-slate-100 dark:border-navy-800/80 mt-1 truncate">
                Typical sizing miss
              </div>
            </div>

            {/* Card 2: RMSE */}
            <div className="bg-white dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-700/70 rounded-lg p-2.5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-bold text-[10.5px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">RMSE (Volatility)</span>
                </div>
                <div className="text-sm font-extrabold font-mono text-blue-600 dark:text-blue-400 tracking-tight leading-tight mt-1">
                  {isLoading ? (
                    <span className="inline-block h-4 w-14 bg-slate-200 dark:bg-navy-700 animate-pulse rounded"></span>
                  ) : (
                    `${historicalMetrics.rmse_mw.toLocaleString()} MW`
                  )}
                </div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  L2 Ramp Norm
                </div>
              </div>
              <div className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-tight pt-1 border-t border-slate-100 dark:border-navy-800/80 mt-1 truncate">
                Peak storm misses
              </div>
            </div>

            {/* Card 3: Bias */}
            <div className="bg-white dark:bg-navy-950/80 border border-slate-200/80 dark:border-navy-700/70 rounded-lg p-2.5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200 font-bold text-[10.5px]">
                  <TrendingUp className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
                  <span className="truncate">Systematic Bias</span>
                </div>
                <div
                  className={`text-sm font-extrabold font-mono tracking-tight leading-tight mt-1 ${
                    historicalMetrics.mean_bias_mw > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {isLoading ? (
                    <span className="inline-block h-4 w-14 bg-slate-200 dark:bg-navy-700 animate-pulse rounded"></span>
                  ) : (
                    `${historicalMetrics.mean_bias_mw > 0 ? '+' : ''}${historicalMetrics.mean_bias_mw.toLocaleString()} MW`
                  )}
                </div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  {isLoading ? '--' : historicalMetrics.mean_bias_mw > 0 ? 'Deficit Risk' : 'Surplus Risk'}
                </div>
              </div>
              <div className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-tight pt-1 border-t border-slate-100 dark:border-navy-800/80 mt-1 truncate">
                {isLoading ? '--' : historicalMetrics.mean_bias_mw > 0 ? 'Over-forecast' : 'Under-forecast'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
