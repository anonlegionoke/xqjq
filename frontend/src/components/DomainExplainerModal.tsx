import React, { useEffect } from 'react';
import { X, BookOpen, Clock, ShieldCheck, Zap } from 'lucide-react';

interface DomainExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  percentile?: number;
}

export const DomainExplainerModal: React.FC<DomainExplainerModalProps> = ({ isOpen, onClose, percentile = 90 }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-700/80 p-6 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white">UK Day-Ahead Power Market & Risk Architecture</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Technical & Commercial Brief for Utility Trading Desks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 dark:text-slate-200 flex-1">
          {/* Section 1: The Commercial Problem */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            1. The Utility's Procurement Dilemma
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            In the UK electricity system, consumer demand must be served 100% in real time across all 48 half-hour settlement periods.
            Because renewable wind power has zero fuel cost, utilities prioritize dispatching wind first and buying the
            remaining deficit from conventional thermal (gas CCGT) generators in the <strong>Day-Ahead Auction (EPEX SPOT / N2EX)</strong>.
          </p>
          <div className="bg-slate-50 dark:bg-navy-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-navy-700 text-xs space-y-2">
            <div className="font-semibold text-slate-900 dark:text-slate-200">Why Asymmetric Forecast Error Costs Millions:</div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              • <strong>Over-Forecast (Dangerous Wind Deficit):</strong> If Elexon predicts 14,000 MW of wind but only 10,000 MW materializes,
              the utility bought 4,000 MW too little thermal power Day-Ahead. The utility is caught 4,000 MW short in real time and is penalized
              at punitive imbalance cash-out prices (System Buy Price).
            </p>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              • <strong>The Solution:</strong> Rather than blindly trusting the raw forecast, the utility adds a quantitative
              <strong> P-Value Downside Shortfall Buffer (active: P{percentile})</strong> to thermal procurement. Traders can dynamically adjust the risk appetite level (P50, P80, P90, P95, P99) in the top header command strip.
            </p>
          </div>
        </div>

        {/* Section 2: Gate Closure & Point-in-Time Causality */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            2. Auction Gate Closure & Strict Point-in-Time Causality
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            UK Day-Ahead auction bids close on <strong>Day D-1</strong> (EPEX Morning Auction at 09:30 UTC; Afternoon Auction at 15:30 UTC).
            National Grid ESO (NESO) publishes wind forecasts up to 8 times daily.
          </p>
          <div className="p-3.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl text-xs space-y-1.5 text-blue-900 dark:text-blue-200">
            <span className="font-semibold text-blue-900 dark:text-blue-100">Zero Look-Ahead Rule:</span>
            <p className="leading-relaxed">
              To eliminate retrospective bias, for every target delivery time <code className="bg-blue-100/60 dark:bg-blue-900/40 text-blue-900 dark:text-white px-1 py-0.5 rounded font-mono">startTime</code>,
              the portal strictly selects the latest forecast satisfying:
            </p>
            <p className="font-mono text-center py-1.5 bg-white dark:bg-navy-950/80 border border-blue-200 dark:border-navy-700 rounded-lg text-teal-700 dark:text-teal-300 font-bold shadow-sm">
              publishTime &le; CutoffTime
            </p>
            <p className="text-[11px] text-blue-700 dark:text-blue-300/80 leading-relaxed">
              Any forecast published after the auction gate closure is mathematically excluded, guaranteeing real-world decision fidelity.
            </p>
          </div>
        </div>

        {/* Section 3: Quantitative Formulas */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            3. Quantitative Risk Metrics & Safety Buffer
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-navy-800/80 p-3 rounded-xl border border-slate-200 dark:border-navy-700 space-y-1">
              <span className="font-bold text-teal-600 dark:text-teal-400">MAE (Mean Absolute Error)</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Average magnitude of forecast miss in MW. Measures expected baseline inaccuracy.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-navy-800/80 p-3 rounded-xl border border-slate-200 dark:border-navy-700 space-y-1">
              <span className="font-bold text-amber-600 dark:text-amber-400">RMSE (Root Mean Square)</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                L2 norm penalizing extreme multi-gigawatt ramp misses during fast-moving storm fronts.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-navy-800/80 p-3 rounded-xl border border-slate-200 dark:border-navy-700 space-y-1">
              <span className="font-bold text-red-600 dark:text-red-400">Mean Bias Error (MBE) / Systematic Bias</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Also known as <strong>Systematic Forecast Bias</strong>. Measures whether the forecast chronically over- or under-predicts. January 2026 exhibits a persistent +1,854 MW positive bias (wind over-forecast).
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-navy-800/80 p-3 rounded-xl border border-slate-200 dark:border-navy-700 space-y-1">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">P{percentile} Thermal Buffer (Configurable)</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                {percentile}th percentile of shortfall: <code className="bg-slate-200/70 dark:bg-navy-900 text-slate-800 dark:text-slate-200 px-1 py-0.5 rounded font-mono text-[10.5px]">P{percentile}(max(0, Forecast - Actual))</code>.
                The exact MW margin of extra thermal power to procure. Configurable in the top bar (P50–P99) based on desk risk tolerance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Sticky Footer */}
      <div className="flex justify-end p-4 px-6 border-t border-slate-200 dark:border-navy-700/80 bg-slate-50/70 dark:bg-navy-950/40 shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-navy-950 font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
        >
          Got It, Return to Dashboard
        </button>
      </div>
    </div>
  </div>
);
};
