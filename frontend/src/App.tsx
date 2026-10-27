import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { HeadlineHeroCard } from './components/HeadlineHeroCard';
import { AnalyticsChartSection } from './components/AnalyticsChartSection';
import { AuditLab } from './components/AuditLab';
import { DomainExplainerModal } from './components/DomainExplainerModal';
import { fetchDashboard } from './services/api';
import { DashboardResponse, TimeseriesPoint } from './types';
import {
  DATE_PRESETS,
  DatePreset,
  filterTimeseriesByDate,
  calculateClientMetrics,
  calculateClientDiurnalProfile,
} from './utils/analytics';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  // Theme state ('dark' | 'light')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('windpulse_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('windpulse_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 1. In-memory master month dataset (fetched once on load or manual sync)
  const [monthData, setMonthData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState<boolean>(false);

  // 2. Active User Controls (Defaulting to Week 1 for clean non-squished presentation)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('week1');
  const [mode, setMode] = useState<'rolling_horizon' | 'gate_closure'>('rolling_horizon');
  const [percentile, setPercentile] = useState<number>(90);
  const [targetDate, setTargetDate] = useState<string>('2026-01-08');

  // Active preset object
  const activePreset = useMemo(() => {
    return DATE_PRESETS.find((p) => p.id === selectedPresetId) || DATE_PRESETS[0];
  }, [selectedPresetId]);

  const loadMonthData = useCallback(async (targetMode: 'rolling_horizon' | 'gate_closure') => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchDashboard({
        start_date: '2026-01-01T00:00:00Z',
        end_date: '2026-01-31T23:59:59Z',
        mode: targetMode,
        horizon_hours: 24,
        gate_closure_hour_utc: 9.5,
        percentile: 90,
        resolution: 'hourly',
      });
      setMonthData(response);
    } catch (err: any) {
      console.error('Failed to load wind data:', err);
      setError(err.message || 'Unable to connect to analytics backend.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonthData(mode);
  }, [mode, loadMonthData]);

  const handleModeChange = (newMode: 'rolling_horizon' | 'gate_closure') => {
    setMode(newMode);
  };

  const handlePresetSelect = (preset: DatePreset) => {
    setSelectedPresetId(preset.id);
  };

  const handlePercentileChange = (newPercentile: number) => {
    setPercentile(newPercentile);
  };

  const activeTimeseries = useMemo<TimeseriesPoint[]>(() => {
    if (!monthData || !monthData.timeseries) return [];

    if (activePreset.id === 'full') {
      return monthData.timeseries;
    }

    return filterTimeseriesByDate(
      monthData.timeseries,
      activePreset.startDate,
      activePreset.endDate
    );
  }, [monthData, activePreset]);

  const activeMetrics = useMemo(() => {
    if (!activeTimeseries.length) {
      return (
        monthData?.metrics || {
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
        }
      );
    }

    return calculateClientMetrics(activeTimeseries, percentile);
  }, [activeTimeseries, percentile, monthData]);

  const timeseriesWithBaseline = useMemo(() => {
    const buffer = activeMetrics.thermal_buffer_mw;
    return activeTimeseries.map((pt) => ({
      ...pt,
      safe_wind_mw: Math.max(0, Math.round((pt.forecast_mw - buffer) * 10) / 10),
    }));
  }, [activeTimeseries, activeMetrics.thermal_buffer_mw]);

  const activeDiurnalData = useMemo(() => {
    if (!activeTimeseries.length) {
      return monthData?.diurnal_profile || [];
    }
    return calculateClientDiurnalProfile(activeTimeseries, percentile);
  }, [activeTimeseries, percentile, monthData]);

  // Target Day forecast (24 slots on that exact day)
  const targetDayPoints = useMemo(() => {
    if (!monthData?.timeseries) return [];
    return monthData.timeseries.filter((p) => p.startTime.startsWith(targetDate));
  }, [monthData, targetDate]);

  const targetDayMeanForecast = useMemo(() => {
    if (!targetDayPoints.length) return 0;
    const sum = targetDayPoints.reduce((acc, p) => acc + p.forecast_mw, 0);
    return Math.round((sum / targetDayPoints.length) * 10) / 10;
  }, [targetDayPoints]);

  // Historical point-in-time sample strictly prior to targetDate 00:00:00Z (zero look-ahead leakage)
  const targetHistoricalPoints = useMemo(() => {
    if (!monthData?.timeseries) return [];
    const cutoffIso = `${targetDate}T00:00:00Z`;
    return monthData.timeseries.filter((p) => p.startTime < cutoffIso);
  }, [monthData, targetDate]);

  const targetHistoricalMetrics = useMemo(() => {
    return calculateClientMetrics(targetHistoricalPoints, percentile);
  }, [targetHistoricalPoints, percentile]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-navy-900 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4 flex-1 min-w-0">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 flex items-center justify-between text-red-600 dark:text-red-300 text-xs shadow-lg">
            <div className="flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadMonthData(mode)}
              className="flex items-center space-x-1 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-700 dark:text-red-200 transition-all font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* 1. Header Row matching wireframe (Logo, Cut off rule, Sync, Clock & Date, Theme) */}
        <Header
          onOpenExplainer={() => setIsExplainerOpen(true)}
          onRefreshData={() => loadMonthData(mode)}
          isLoading={isLoading}
          sampleCount={monthData?.timeseries.length || 0}
          mode={mode}
          onModeChange={handleModeChange}
          theme={theme}
          onToggleTheme={toggleTheme}
          percentile={percentile}
          onPercentileChange={handlePercentileChange}
        />

        {/* 2. Headline / Hero Card (Tomorrow Forecast with Target Date Picker & Point-in-Time Track Record) */}
        <HeadlineHeroCard
          targetDate={targetDate}
          onTargetDateChange={setTargetDate}
          targetDayForecastMw={targetDayMeanForecast}
          historicalMetrics={targetHistoricalMetrics}
          historicalSampleCount={targetHistoricalPoints.length}
          percentile={percentile}
          isLoading={isLoading}
        />

        {/* 3. Analytics & Plot Section matching wireframe (3 Cards: MAE, Bias, RMSE + Main Plot with Week dropdown) */}
        <AnalyticsChartSection
          metrics={activeMetrics}
          timeseries={timeseriesWithBaseline}
          selectedPresetId={selectedPresetId}
          onSelectPreset={handlePresetSelect}
          percentile={percentile}
          isLoading={isLoading}
          theme={theme}
        />

        {/* 4. Deep-Dive Section ("keep the deep dive like that for now... we can fix that later") */}
        {monthData && (
          <AuditLab
            horizonData={monthData.horizon_degradation}
            diurnalData={activeDiurnalData}
            distributionData={monthData.distribution}
            timeseries={timeseriesWithBaseline}
            metrics={activeMetrics}
            percentile={percentile}
            isLoading={isLoading}
            theme={theme}
          />
        )}
      </div>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950/80 px-6 py-4 text-xs text-slate-500 dark:text-slate-400 mt-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 font-medium">
            <span>UK Day-Ahead Wind Forecast Intelligence & Imbalance Protection</span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Data: Elexon BMRS (FUELHH & WINDFOR)</span>
          </div>
        </div>
      </footer>

      {/* Domain Explainer Modal */}
      <DomainExplainerModal
        isOpen={isExplainerOpen}
        onClose={() => setIsExplainerOpen(false)}
        percentile={percentile}
      />
    </div>
  );
};

export default App;
