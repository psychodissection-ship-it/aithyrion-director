import React from 'react';
import { StrategyDecision, DiagnosticResolution } from '../types/director';
import { Compass, AlertTriangle, CheckCircle2, SlidersHorizontal, ArrowRight } from 'lucide-react';

interface DirectorDecisionCardProps {
  decision: StrategyDecision | null;
  diagnostic: DiagnosticResolution | null;
  isEvaluating: boolean;
}

export const DirectorDecisionCard: React.FC<DirectorDecisionCardProps> = ({
  decision,
  diagnostic,
  isEvaluating,
}) => {
  if (!decision) {
    return (
      <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px] text-center shadow-sm">
        <Compass className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
          Pass 1: Strategy Decision Idle
        </span>
        <p className="text-xs text-slate-600 mt-1 max-w-xs font-mono">
          Click "Evaluate Point" or select a timeline cue to compute directorial strategy.
        </p>
      </div>
    );
  }

  const confidencePct = Math.round(decision.confidence * 100);
  const isDiagnostic = decision.requiresDiagnostic || !!diagnostic;

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'INTENSIFY':
        return {
          bg: 'bg-amber-500/15',
          border: 'border-amber-500/50',
          text: 'text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          accent: 'from-amber-500 to-orange-600',
        };
      case 'RELEASE':
        return {
          bg: 'bg-cyan-500/15',
          border: 'border-cyan-500/50',
          text: 'text-cyan-400',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          accent: 'from-cyan-500 to-blue-600',
        };
      case 'IMPACT_HOLD':
        return {
          bg: 'bg-rose-500/15',
          border: 'border-rose-500/50',
          text: 'text-rose-400',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          accent: 'from-rose-500 to-pink-600',
        };
      case 'CONTINUE_TENSION':
      default:
        return {
          bg: 'bg-violet-500/15',
          border: 'border-violet-500/50',
          text: 'text-violet-400',
          badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
          accent: 'from-violet-500 to-purple-600',
        };
    }
  };

  const effectiveStrategy = diagnostic ? diagnostic.resolvedStrategy : decision.strategy;
  const stratTheme = getStrategyColor(effectiveStrategy);

  return (
    <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-700/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
              3. Director Decision
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">Pass 1: Strategic Intent</p>
          </div>
        </div>

        {/* Status Tag */}
        <div>
          {isDiagnostic ? (
            <span className="flex items-center gap-1 text-[10.5px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              DIAGNOSTIC REQUIRED
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10.5px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              {decision.status.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Main Strategy Display */}
      <div className="my-3 py-4 px-4 rounded-xl border bg-surface-900/90 text-center relative overflow-hidden border-surface-750">
        <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
          DIRECTOR STRATEGY
        </span>

        <div className="mt-1 flex items-center justify-center space-x-2">
          <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${stratTheme.text}`}>
            {effectiveStrategy}
          </span>
        </div>

        {/* Confidence Gauge */}
        <div className="mt-3 flex items-center justify-center space-x-3 text-xs font-mono">
          <span className="text-slate-400">Confidence</span>
          <div className="w-28 bg-surface-800 rounded-full h-2 overflow-hidden border border-surface-700/60">
            <div
              className={`h-full bg-gradient-to-r ${stratTheme.accent} transition-all duration-500`}
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className={`font-semibold ${confidencePct < 30 ? 'text-rose-400' : confidencePct < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {confidencePct}%
          </span>
        </div>

        {/* Low Confidence explanation */}
        {decision.requiresDiagnostic && (
          <div className="mt-2 text-[10.5px] text-amber-300/90 font-mono bg-amber-950/40 border border-amber-800/40 rounded px-2.5 py-1">
            Confidence &lt; 30% — Triggering Diagnostic Pass to resolve musical ambiguity
          </div>
        )}
      </div>

      {/* Alternatives */}
      {decision.alternatives && decision.alternatives.length > 0 && (
        <div className="mb-3 bg-surface-900/80 border border-surface-750 p-2.5 rounded-lg">
          <div className="text-[10.5px] font-mono text-slate-400 mb-1.5 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" />
            <span>Alternative Distribution:</span>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[11px]">
            {decision.alternatives.map((alt) => (
              <div
                key={alt.strategy}
                className="bg-surface-800/90 border border-surface-700/70 px-2 py-0.5 rounded text-slate-300 flex items-center space-x-1.5"
              >
                <span>{alt.strategy}</span>
                <span className="text-indigo-400 font-semibold">
                  {(alt.probability * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostic Pass Results (When applicable) */}
      {diagnostic && (
        <div className="bg-surface-900 border border-amber-500/40 rounded-lg p-3 relative font-mono">
          <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Diagnostic Pass Execution</span>
            </div>
            <span className="text-[10px] text-slate-400 font-normal">Ambiguity Resolved</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10.5px] mb-2.5">
            <div className="bg-surface-850 p-2 rounded border border-surface-750">
              <span className="text-slate-500 block text-[9.5px]">Impact Arrival</span>
              <span className="text-white font-semibold text-xs mt-0.5 block">
                {diagnostic.diagnostic.impact_arrival.toFixed(2)}
              </span>
            </div>

            <div className="bg-surface-850 p-2 rounded border border-surface-750 ring-1 ring-amber-500/30">
              <span className="text-amber-400 block text-[9.5px]">Tension Continuation</span>
              <span className="text-amber-300 font-semibold text-xs mt-0.5 block">
                {diagnostic.diagnostic.tension_should_continue.toFixed(2)}
              </span>
            </div>

            <div className="bg-surface-850 p-2 rounded border border-surface-750">
              <span className="text-slate-500 block text-[9.5px]">Release Appropriate</span>
              <span className="text-white font-semibold text-xs mt-0.5 block">
                {diagnostic.diagnostic.release_is_appropriate.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] bg-surface-850 p-2 rounded border border-surface-750">
            <ArrowRight className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <div className="text-slate-300">
              <span className="text-amber-400 font-semibold">{diagnostic.resolvedStrategy}:</span>{' '}
              <span className="text-slate-400 text-[10.5px]">{diagnostic.reasoning}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
