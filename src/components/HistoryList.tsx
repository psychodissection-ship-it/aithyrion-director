import React from 'react';
import { ShotHistoryItem } from '../types/director';
import { History as HistoryIcon, Clock, ChevronRight } from 'lucide-react';

interface HistoryListProps {
  history: ShotHistoryItem[];
  selectedTime?: number;
  onSelectHistoryItem: (item: ShotHistoryItem) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  selectedTime,
  onSelectHistoryItem,
}) => {
  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'INTENSIFY':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'RELEASE':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'IMPACT_HOLD':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'CONTINUE_TENSION':
      default:
        return 'text-violet-400 bg-violet-500/10 border-violet-500/30';
    }
  };

  return (
    <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-4 flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-700/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <HistoryIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
              5. Decision History
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">Sequential contextual memory</p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-surface-900 border border-surface-750">
          {history.length} {history.length === 1 ? 'Record' : 'Records'}
        </span>
      </div>

      {/* History Items Container */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[580px]">
        {history.length === 0 ? (
          <div className="p-6 text-center text-slate-600 font-mono text-xs flex flex-col items-center justify-center h-48">
            <HistoryIcon className="w-6 h-6 mb-2 opacity-40" />
            <span>No historical decisions recorded yet.</span>
            <span className="text-[10px] text-slate-700 mt-1">
              Evaluated points will automatically log here.
            </span>
          </div>
        ) : (
          history.map((item, index) => {
            const isSelected = selectedTime !== undefined && Math.abs(selectedTime - item.time) < 0.05;
            const final = item.pass2.final;

            return (
              <div
                key={item.id || index}
                onClick={() => onSelectHistoryItem(item)}
                className={`p-3 rounded-lg border transition-all cursor-pointer font-mono text-left relative ${
                  isSelected
                    ? 'bg-surface-750 border-indigo-500 shadow-sm ring-1 ring-indigo-500/40'
                    : 'bg-surface-900/80 border-surface-750 hover:border-slate-600'
                }`}
              >
                {/* Header line: Time & Strategy */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {item.time.toFixed(2)}s
                    </span>
                    <span className="text-[10px] text-slate-500">
                      (Δ {item.duration.toFixed(2)}s)
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStrategyColor(
                      item.effectiveStrategy
                    )}`}
                  >
                    {item.effectiveStrategy}
                  </span>
                </div>

                {/* Shot specifics pills */}
                <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                  {item.pass2.cutDecisionType === 'SOFT_CUT' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9.5px] font-semibold">
                      AI SOFT CUT
                    </span>
                  )}
                  {item.pass2.cutDecisionType === 'HARD_FORCE_CUT' && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9.5px] font-semibold">
                      HARD FORCE CUT
                    </span>
                  )}
                  {item.pass2.cutDecisionType === 'CUT_SUPPRESSED' && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9.5px] font-semibold">
                      CUT SUPPRESSED
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-surface-800 text-slate-200 border border-surface-700">
                    {final.shot_scale}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-800 text-cyan-300 border border-surface-700">
                    {final.camera_motion}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-800 text-purple-300 border border-surface-700">
                    {final.character_motion}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-800 text-amber-300 border border-surface-700">
                    {final.lighting_change}
                  </span>
                </div>

                {/* Diagnostic tag if resolved through diagnostic pass */}
                {item.diagnostic && (
                  <div className="mt-2 text-[10px] text-amber-300/80 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/30 flex items-center justify-between">
                    <span>Diagnostic Resolved</span>
                    <span>Tension: {item.diagnostic.diagnostic.tension_should_continue}</span>
                  </div>
                )}

                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
