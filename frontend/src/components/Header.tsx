import React, { useState } from 'react';
import { Wind, RefreshCw, HelpCircle, Sun, Moon, Calendar, ChevronDown, Check, Info, X } from 'lucide-react';
import { useLiveClock } from '../hooks/useLiveClock';
import { triggerSync, getSyncStatus } from '../services/api';

const PERCENTILE_OPTIONS = [50, 80, 90, 95, 99];

interface HeaderProps {
  onOpenExplainer: () => void;
  onRefreshData: () => void;
  isLoading: boolean;
  sampleCount: number;
  mode: 'rolling_horizon' | 'gate_closure';
  onModeChange: (mode: 'rolling_horizon' | 'gate_closure') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  percentile?: number;
  onPercentileChange?: (percentile: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenExplainer,
  onRefreshData,
  isLoading,
  sampleCount,
  mode,
  onModeChange,
  theme,
  onToggleTheme,
  percentile = 90,
  onPercentileChange,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isPercentileOpen, setIsPercentileOpen] = useState(false);
  const [showCutoffInfo, setShowCutoffInfo] = useState(false);
  const { timeStr, dateStr } = useLiveClock();

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Initiating Elexon sync...');
    try {
      await triggerSync();
      setSyncStatus('Syncing live stream...');

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const status = await getSyncStatus();
          if (!status.is_syncing || attempts >= 30) {
            clearInterval(pollInterval);
            setIsSyncing(false);
            if (status.last_sync_error) {
              setSyncStatus(`Sync error: ${status.last_sync_error}`);
            } else {
              setSyncStatus('Data updated successfully');
              onRefreshData();
            }
            setTimeout(() => setSyncStatus(null), 4000);
          }
        } catch {
          if (attempts >= 15) {
            clearInterval(pollInterval);
            setIsSyncing(false);
            onRefreshData();
            setTimeout(() => setSyncStatus(null), 3000);
          }
        }
      }, 2000);
    } catch (err: any) {
      setSyncStatus('Sync failed: ' + (err.message || 'Check connection'));
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  return (
    <header className="w-full">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-1.5 sm:gap-2 xl:gap-2.5">
        {/* Row 1 on mobile/tablet: Logo on left, Clock & actions on right */}
        <div className="flex items-center justify-between w-full xl:w-auto gap-2 sm:gap-2.5">
          {/* Module 1: Logo | Energy Desk */}
          <div className="bg-white dark:bg-navy-800/90 border border-slate-200 dark:border-navy-700/80 rounded-xl px-3 sm:px-3.5 shadow-sm flex items-center space-x-2.5 transition-colors min-h-[46px] sm:min-h-[52px] box-border shrink-0">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Wind className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 leading-none">
                <span>WindPulse</span>
                <span className="text-slate-400 font-light">|</span>
                <span className="text-teal-600 dark:text-teal-400 font-medium">Energy Desk</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                UK Day-Ahead Wind Intelligence
              </div>
            </div>
          </div>

          {/* Module 3 on mobile/tablet (< xl) */}
          <div className="xl:hidden bg-white dark:bg-navy-800/90 border border-slate-200 dark:border-navy-700/80 rounded-xl px-3 sm:px-3.5 shadow-sm flex items-center space-x-2 sm:space-x-3 transition-colors min-h-[46px] sm:min-h-[52px] box-border shrink-0">
            <div className="leading-tight">
              <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100 leading-none">
                {timeStr || '10:30:12 UTC'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-tight mt-0.5">
                TODAY {dateStr || '24/10/2026'}
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-navy-700" />

            {/* Theme Toggle (Dark / Light) */}
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-900/80 border border-slate-300 dark:border-navy-700/60 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-blue-600" />
              )}
            </button>

            {/* Guide Modal Trigger */}
            <button
              onClick={onOpenExplainer}
              className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 transition-all"
              title="Trading Desk Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Module 2: Grouped Command Strip (full width on < xl, centered on xl) */}
        <div className="bg-white dark:bg-navy-800/90 border border-slate-200 dark:border-navy-700/80 rounded-xl px-2 sm:px-3 py-1.5 sm:py-0 my-0 shadow-sm flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 transition-colors min-h-[46px] sm:min-h-[52px] box-border w-full xl:w-auto relative z-30">
          {/* Sub-item 1: January 2026 */}
          <div className="text-xs font-mono font-medium px-2 sm:px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/20 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0">
            <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="hidden sm:inline">January 2026</span>
            <span className="sm:hidden">Jan 2026</span>
          </div>

          <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-navy-700 shrink-0" />

          {/* Sub-item 2: Cut off rule: 24hr | Gate with (i) rich tooltip */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 px-0.5 sm:px-1 relative shrink-0">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <span className="hidden sm:inline">Cut off rule:</span>
              <span className="sm:hidden">Cutoff:</span>
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-navy-900/90 p-0.5 rounded-lg border border-slate-300 dark:border-navy-700/60">
              <button
                onClick={() => onModeChange('rolling_horizon')}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  mode === 'rolling_horizon'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Continuous 24-hour rolling lead time before delivery"
              >
                24hr
              </button>
              <span className="text-slate-300 dark:text-slate-600 px-0.5">|</span>
              <button
                onClick={() => onModeChange('gate_closure')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  mode === 'gate_closure'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="UK EPEX Day-Ahead auction cutoff (09:30 UTC on Day D-1)"
              >
                Gate
              </button>
            </div>

            {/* (i) Info trigger button */}
            <button
              type="button"
              onClick={() => setShowCutoffInfo(!showCutoffInfo)}
              className={`p-1 rounded-full transition-colors focus:outline-none cursor-pointer ${
                showCutoffInfo
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/30'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700'
              }`}
              aria-label="Cut off rule details and explanation"
              title="Click to learn how Cut off rules work"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {/* Rich Tooltip Popover (Floating balloon style) */}
            {showCutoffInfo && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowCutoffInfo(false)}
                />
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2.5 z-50 w-80 sm:w-96 max-w-[calc(100vw-2rem)] p-4 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl text-left text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Info className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          Cutoff Rules & Causality
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          Zero look-ahead point-in-time comparison
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCutoffInfo(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                      aria-label="Close cutoff info"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Forecast selection strictly filters out any publication after the decision cutoff to eliminate retrospective look-ahead bias:
                  </p>

                  {/* 2 Options Cards */}
                  <div className="space-y-2">
                    {/* Option 1: 24hr */}
                    <div
                      onClick={() => {
                        onModeChange('rolling_horizon');
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        mode === 'rolling_horizon'
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-500/40 ring-1 ring-blue-400/30'
                          : 'bg-slate-50 dark:bg-navy-900/60 border-slate-200 dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                          <span className="font-mono px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px]">
                            24hr
                          </span>
                          <span>Rolling 24-Hour Horizon</span>
                        </div>
                        {mode === 'rolling_horizon' ? (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Click to activate</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>Rule:</strong> Uses the latest forecast published at least <strong>24 hours prior</strong> to each specific half-hour settlement slot (<code className="bg-slate-200/60 dark:bg-navy-800 px-1 py-0.5 rounded font-mono text-[10px]">publishTime &le; startTime - 24h</code>).
                      </p>
                      <div className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400 italic">
                        Use case: Standardized constant-horizon benchmarking and lead time sensitivity analysis.
                      </div>
                    </div>

                    {/* Option 2: Gate */}
                    <div
                      onClick={() => {
                        onModeChange('gate_closure');
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        mode === 'gate_closure'
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-500/40 ring-1 ring-blue-400/30'
                          : 'bg-slate-50 dark:bg-navy-900/60 border-slate-200 dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                          <span className="font-mono px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px]">
                            Gate
                          </span>
                          <span>Auction Gate Closure (09:30 UTC)</span>
                        </div>
                        {mode === 'gate_closure' ? (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Click to activate</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>Rule:</strong> Freezes forecasts at <strong>09:30 UTC on Day D-1</strong> for all 48 settlement slots of delivery day D (UK EPEX SPOT / Nord Pool auction deadline).
                      </p>
                      <div className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400 italic">
                        Use case: Realistic commercial trading simulation with dynamic lead times from 14.5h (slot 1) to 38.5h (slot 48).
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-navy-700 shrink-0" />

          {/* Sub-item 3: Risk Percentile Dropdown (P90) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsPercentileOpen(!isPercentileOpen)}
              className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 hover:border-amber-400 transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shadow-sm"
              title="Select Risk Appetite Percentile"
              aria-haspopup="listbox"
              aria-expanded={isPercentileOpen}
              aria-label="Select Risk Appetite Percentile"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>P{percentile}</span>
              <ChevronDown className="w-3 h-3 text-amber-500 shrink-0" />
            </button>

            {isPercentileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsPercentileOpen(false)}
                />
                <div className="absolute left-0 sm:right-0 sm:left-auto top-9 z-50 w-44 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl py-1 text-xs">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
                    <span>Risk Appetite</span>
                    <span>Coverage</span>
                  </div>
                  {PERCENTILE_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        onPercentileChange?.(p);
                        setIsPercentileOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left font-mono flex items-center justify-between hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors ${
                        percentile === p
                          ? 'text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-500/10'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {percentile === p ? (
                          <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        <span>P{p}</span>
                      </span>
                      <span className="text-[10px] text-slate-400">{p}% buffer</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-navy-700 shrink-0" />

          {/* Sub-item 4: Sync Data */}
          <button
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            className="bg-slate-100 dark:bg-navy-900/80 hover:bg-slate-200 dark:hover:bg-navy-700 border border-slate-300 dark:border-navy-700/70 text-slate-700 dark:text-slate-200 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium transition-all shadow-sm flex items-center space-x-1 sm:space-x-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
            title="Manually pull fresh data from Elexon BMRS API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isLoading ? 'animate-spin text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
            <span className="sm:hidden">{isSyncing ? 'Syncing' : 'Sync'}</span>
          </button>
        </div>

        {/* Module 3 on desktop (hidden on < xl) */}
        <div className="hidden xl:flex bg-white dark:bg-navy-800/90 border border-slate-200 dark:border-navy-700/80 rounded-xl px-3.5 shadow-sm items-center space-x-3 transition-colors min-h-[52px] box-border shrink-0">
          <div className="leading-tight">
            <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100 leading-none">
              {timeStr || '10:30:12 UTC'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-tight mt-0.5">
              TODAY {dateStr || '24/10/2026'}
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-navy-700" />

          {/* Theme Toggle (Dark / Light) */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-900/80 border border-slate-300 dark:border-navy-700/60 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-blue-600" />
            )}
          </button>

          {/* Guide Modal Trigger */}
          <button
            onClick={onOpenExplainer}
            className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 transition-all"
            title="Trading Desk Guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="mt-2 text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/25 rounded-lg px-3 py-1 flex items-center space-x-2">
          <span>{syncStatus}</span>
        </div>
      )}
    </header>
  );
};
