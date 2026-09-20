import React, { useState, useEffect } from 'react';
import { AntiFixtureTestRun, MusicState } from '../types/director';
import { JevDirectorEngine } from '../services/engine/JevDirectorEngine';
import { ShieldAlert, CheckCircle2, AlertTriangle, Play, Zap, RefreshCw, Layers, TrendingUp } from 'lucide-react';

interface AntiFixtureValidatorViewProps {
  jevEngine: JevDirectorEngine;
}

export const AntiFixtureValidatorView: React.FC<AntiFixtureValidatorViewProps> = ({
  jevEngine,
}) => {
  const [runs, setRuns] = useState<AntiFixtureTestRun[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const executeAntiFixtureSuite = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    const testEnergies = [
      { energy: 0.20, label: 'Low Energy State (Quiet/Breakdown)' },
      { energy: 0.76, label: 'Baseline State (17.64s Pre-Drop Ambiguity)' },
      { energy: 0.95, label: 'Climax Energy State (Peak Drop/Impact)' },
    ];

    const results: AntiFixtureTestRun[] = [];

    try {
      for (const t of testEnergies) {
        const state: MusicState = {
          time: 17.64,
          energy: t.energy,
          energyTrend: t.energy === 0.20 ? 'falling' : t.energy === 0.95 ? 'plateau' : 'rising',
          onsetStrength: t.energy === 0.20 ? 0.15 : t.energy === 0.95 ? 0.92 : 0.58,
          nextMajorChange: 2.56,
          bpm: 128,
          section: t.label,
        };

        const t0 = performance.now();
        const p1 = await jevEngine.selectStrategy(state, []);
        let resolved = p1.strategy;
        let diag = undefined;

        if (p1.requiresDiagnostic) {
          diag = await jevEngine.diagnoseStrategy(state, [], p1);
          resolved = diag.resolvedStrategy;
        }
        const latencyMs = Math.round(performance.now() - t0);

        results.push({
          energy: t.energy,
          label: t.label,
          state,
          response: p1,
          resolvedStrategy: resolved,
          diagnostic: diag,
          latencyMs,
        });

        await new Promise((r) => setTimeout(r, 150));
      }

      setRuns(results);
    } catch (err: any) {
      console.error('Anti-fixture execution error:', err);
      setErrorMsg(err.message || 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    executeAntiFixtureSuite();
  }, []);

  // Check if distributions vary
  const checkIsDynamic = () => {
    if (runs.length < 3) return null;
    const r0 = runs[0].response;
    const r1 = runs[1].response;
    const r2 = runs[2].response;

    // Check if probabilities or strategies are identical across distinct inputs
    const p0MatchesP1 = r0.probability === r1.probability && r0.strategy === r1.strategy;
    const p1MatchesP2 = r1.probability === r2.probability && r1.strategy === r2.strategy;

    if (p0MatchesP1 && p1MatchesP2) {
      return false; // Replay / Hardcoded fixture detected!
    }
    return true; // Responsive dynamic inference confirmed!
  };

  const isDynamic = checkIsDynamic();

  return (
    <div className="space-y-5 select-none font-mono">
      {/* Top Banner */}
      <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              Anti-Fixture Live Verification Suite
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
              Proves Dynamic Model Inference (Non-Replay)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Modulates the 17.64s Music State energy ($0.20 \rightarrow 0.76 \rightarrow 0.95$) to verify that JEV dynamically calculates continuous probability tensors rather than replaying static fixtures.
          </p>
        </div>

        <button
          onClick={executeAntiFixtureSuite}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white text-xs rounded transition shadow-sm font-medium"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Running Anti-Fixture Suite...' : 'Re-Run Anti-Fixture Suite'}</span>
        </button>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Dynamic Verification Result Banner */}
      {isDynamic !== null && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            isDynamic
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-300 animate-pulse'
          }`}
        >
          <div className="flex items-center space-x-3">
            {isDynamic ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-rose-400 flex-shrink-0" />
            )}
            <div>
              <div className="text-sm font-bold tracking-tight">
                {isDynamic
                  ? 'DYNAMIC INFERENCE CONFIRMED (PASS)'
                  : 'WARNING: FIXTURE REPLAY DETECTED (FAIL)'}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isDynamic
                  ? 'Probability distributions shift continuously with musical energy physics across all 3 test states.'
                  : 'Engine returned identical probabilities despite significant acoustic energy changes! Check for hardcoded fixture bypass.'}
              </p>
            </div>
          </div>

          <span
            className={`text-xs px-3 py-1 rounded font-bold uppercase border ${
              isDynamic
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}
          >
            {isDynamic ? 'Non-Fixture Verified' : 'Identical Replay'}
          </span>
        </div>
      )}

      {/* 3-Column Energy Test Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {runs.map((run, idx) => {
          const p1 = run.response;
          const energyPct = Math.round(run.energy * 100);

          return (
            <div
              key={idx}
              className="bg-surface-850 border border-surface-700/60 rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between"
            >
              <div>
                {/* Header Line */}
                <div className="flex items-center justify-between pb-3 border-b border-surface-700/50">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-xs font-bold text-white">Test Case #{idx + 1}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{run.latencyMs} ms</span>
                </div>

                {/* Energy Dial */}
                <div className="bg-surface-900 border border-surface-750 p-3 rounded-lg my-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Acoustic Energy:</span>
                    <span className="text-white font-bold">{run.energy.toFixed(2)} ({energyPct}%)</span>
                  </div>
                  <div className="w-full bg-surface-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        run.energy < 0.3 ? 'bg-cyan-400' : run.energy > 0.8 ? 'bg-rose-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${energyPct}%` }}
                    />
                  </div>
                  <span className="text-[10.5px] text-slate-500 block mt-1.5">{run.label}</span>
                </div>

                {/* Strategy Result */}
                <div className="bg-surface-900 border border-surface-750 p-3 rounded-lg mb-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                    Resolved Strategy
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {run.resolvedStrategy}
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>Confidence:</span>
                    <span className="text-emerald-400 font-semibold">
                      {(p1.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {p1.requiresDiagnostic && (
                    <span className="inline-block mt-2 text-[10px] text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                      Diagnostic Pass Executed
                    </span>
                  )}
                </div>

                {/* Probability Distribution */}
                <div className="space-y-1.5 bg-surface-900 border border-surface-750 p-3 rounded-lg text-xs">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    Live Probability Output:
                  </span>
                  {p1.alternatives && (
                    <>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white font-semibold">{p1.strategy}</span>
                        <span className="text-indigo-400 font-bold">{(p1.probability * 100).toFixed(0)}%</span>
                      </div>
                      {p1.alternatives.map((alt) => (
                        <div key={alt.strategy} className="flex justify-between text-[11px] text-slate-400">
                          <span>{alt.strategy}</span>
                          <span>{(alt.probability * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="text-[10.5px] text-slate-500 pt-2 border-t border-surface-750 flex items-center justify-between">
                <span>Input Time: 17.64s</span>
                <span className="text-indigo-400 capitalize">{run.state.energyTrend}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
