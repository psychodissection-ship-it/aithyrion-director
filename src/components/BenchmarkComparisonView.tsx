import React, { useState, useEffect } from 'react';
import { BenchmarkFixture, BenchmarkComparisonResult, BenchmarkFieldDiff } from '../types/director';
import { BENCHMARK_FIXTURES } from '../data/benchmarkFixtures';
import { DirectorEngine } from '../services/engine';
import { CheckCircle2, XCircle, Play, Sparkles, Scale, AlertTriangle, ArrowRight } from 'lucide-react';

interface BenchmarkComparisonViewProps {
  engine: DirectorEngine;
  engineName: string;
}

export const BenchmarkComparisonView: React.FC<BenchmarkComparisonViewProps> = ({
  engine,
  engineName,
}) => {
  const [fixtures] = useState<BenchmarkFixture[]>(BENCHMARK_FIXTURES);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>(BENCHMARK_FIXTURES[2].id); // Default to 17.64s
  const [results, setResults] = useState<Record<string, BenchmarkComparisonResult>>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Run benchmark for a specific fixture
  const runFixtureBenchmark = async (fixture: BenchmarkFixture) => {
    try {
      const p1 = await engine.selectStrategy(fixture.musicState, []);
      let effectiveStrat = p1.strategy;
      let diagRes = undefined;

      if (p1.requiresDiagnostic) {
        diagRes = await engine.diagnoseStrategy(fixture.musicState, [], p1);
        effectiveStrat = diagRes.resolvedStrategy;
      }

      const shot = await engine.selectShotDirection(fixture.musicState, effectiveStrat, []);

      // Build diffs
      const diffs: BenchmarkFieldDiff<any>[] = [];

      // 1. Strategy diff
      const stratMatch = effectiveStrat === fixture.expected.strategy;
      diffs.push({
        field: 'Strategy',
        expected: fixture.expected.strategy,
        actual: effectiveStrat,
        matched: stratMatch,
      });

      // 2. Confidence delta
      const confDelta = p1.confidence - fixture.expected.confidence;
      diffs.push({
        field: 'Confidence',
        expected: `${(fixture.expected.confidence * 100).toFixed(0)}%`,
        actual: `${(p1.confidence * 100).toFixed(0)}%`,
        matched: Math.abs(confDelta) < 0.05,
        notes: `Delta: ${(confDelta * 100).toFixed(0)}%`,
      });

      // 3. Cut type
      const cutMatch = shot.cutDecisionType === fixture.expected.shot.cutDecisionType;
      diffs.push({
        field: 'Cut Decision',
        expected: fixture.expected.shot.cutDecisionType,
        actual: shot.cutDecisionType,
        matched: cutMatch,
      });

      // 4. Shot Scale
      diffs.push({
        field: 'Shot Scale',
        expected: fixture.expected.shot.shot_scale,
        actual: shot.final.shot_scale,
        matched: shot.final.shot_scale === fixture.expected.shot.shot_scale,
      });

      // 5. Camera Motion
      diffs.push({
        field: 'Camera Motion',
        expected: fixture.expected.shot.camera_motion,
        actual: shot.final.camera_motion,
        matched: shot.final.camera_motion === fixture.expected.shot.camera_motion,
      });

      // 6. Character Motion
      diffs.push({
        field: 'Character Motion',
        expected: fixture.expected.shot.character_motion,
        actual: shot.final.character_motion,
        matched: shot.final.character_motion === fixture.expected.shot.character_motion,
      });

      // 7. Lighting
      diffs.push({
        field: 'Lighting',
        expected: fixture.expected.shot.lighting_change,
        actual: shot.final.lighting_change,
        matched: shot.final.lighting_change === fixture.expected.shot.lighting_change,
      });

      // 8. Diagnostic Match (if applicable)
      let diagnosticMatched = undefined;
      if (fixture.expected.diagnostic && diagRes) {
        const expD = fixture.expected.diagnostic;
        const actD = diagRes.diagnostic;
        diagnosticMatched =
          Math.abs(expD.impact_arrival - actD.impact_arrival) < 0.05 &&
          Math.abs(expD.tension_should_continue - actD.tension_should_continue) < 0.05 &&
          Math.abs(expD.release_is_appropriate - actD.release_is_appropriate) < 0.05;

        diffs.push({
          field: 'Diagnostic (Impact / Tension / Release)',
          expected: `${expD.impact_arrival.toFixed(2)} / ${expD.tension_should_continue.toFixed(2)} / ${expD.release_is_appropriate.toFixed(2)}`,
          actual: `${actD.impact_arrival.toFixed(2)} / ${actD.tension_should_continue.toFixed(2)} / ${actD.release_is_appropriate.toFixed(2)}`,
          matched: diagnosticMatched,
          notes: `Resolved: ${diagRes.resolvedStrategy}`,
        });
      }

      const result: BenchmarkComparisonResult = {
        fixture,
        actualStrategy: p1,
        actualDiagnostic: diagRes,
        actualShot: shot,
        strategyMatched: stratMatch,
        confidenceDelta: confDelta,
        shotMatched: diffs.filter((d) => ['Shot Scale', 'Camera Motion', 'Character Motion', 'Lighting'].includes(d.field)).every((d) => d.matched),
        cutMatched: cutMatch,
        diagnosticMatched,
        diffs,
      };

      setResults((prev) => ({ ...prev, [fixture.id]: result }));
    } catch (err: any) {
      console.error(`Benchmark failure for ${fixture.id}:`, err);
    }
  };

  // Run all benchmarks
  const runAllBenchmarks = async () => {
    setIsRunning(true);
    for (const fix of fixtures) {
      await runFixtureBenchmark(fix);
      await new Promise((r) => setTimeout(r, 100));
    }
    setIsRunning(false);
  };

  useEffect(() => {
    runAllBenchmarks();
  }, [engine.engineId]);

  const activeFixture = fixtures.find((f) => f.id === selectedFixtureId) || fixtures[0];
  const activeResult = results[activeFixture.id];

  return (
    <div className="space-y-5 select-none font-mono">
      {/* Top Banner */}
      <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Scale className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              Playground Benchmark Validator
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              Expected vs Actual vs Difference
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Testing against target engine:{' '}
            <span className="text-white font-bold">{engineName}</span>
          </p>
        </div>

        <button
          onClick={runAllBenchmarks}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded transition shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isRunning ? 'Validating Benchmarks...' : 'Re-Run All Benchmarks'}</span>
        </button>
      </div>

      {/* Fixture Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {fixtures.map((fixture) => {
          const res = results[fixture.id];
          const isSelected = fixture.id === selectedFixtureId;
          const isPass = res?.strategyMatched && res?.cutMatched && res?.shotMatched;

          return (
            <div
              key={fixture.id}
              onClick={() => setSelectedFixtureId(fixture.id)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-surface-750 border-indigo-500 ring-1 ring-indigo-500/50 shadow-md'
                  : 'bg-surface-850 border-surface-700/60 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white tracking-tight">
                  {fixture.cueTime.toFixed(2)}s Cue
                </span>
                {res ? (
                  isPass ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> MATCH
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-rose-400 font-semibold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      <XCircle className="w-3 h-3" /> VARIANCE
                    </span>
                  )
                ) : (
                  <span className="text-[10px] text-slate-500">Pending</span>
                )}
              </div>

              <div className="text-[11px] text-slate-300 truncate">{fixture.label}</div>
              <div className="mt-2 text-[10px] text-slate-500">
                Expected:{' '}
                <span className="text-amber-400 font-semibold">{fixture.expected.strategy}</span>
                {fixture.expected.diagnostic && (
                  <span className="text-indigo-400 ml-1">(Diagnostic)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Diff Table & Detailed Card */}
      {activeResult ? (
        <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-700/50">
            <div>
              <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                Benchmark Detail: {activeFixture.label}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">{activeFixture.notes}</p>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Overall Status:</span>
              {activeResult.strategyMatched && activeResult.cutMatched && activeResult.shotMatched ? (
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% REPRODUCED
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[11px] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> VARIANCE DETECTED
                </span>
              )}
            </div>
          </div>

          {/* Diagnostic Special Spotlight (Especially for 17.64s) */}
          {activeFixture.expected.diagnostic && (
            <div className="bg-surface-900 border border-amber-500/40 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Diagnostic Pass Behavior Replication
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Confidence &lt; 30% Threshold Triggered
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-surface-850 p-2.5 rounded border border-surface-750">
                  <span className="text-[10px] text-slate-500 block">Impact Arrival</span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-400 text-[11px]">Exp: 0.38</span>
                    <span className="text-white font-bold">
                      Act: {activeResult.actualDiagnostic?.diagnostic.impact_arrival.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="bg-surface-850 p-2.5 rounded border border-surface-750 ring-1 ring-amber-500/30">
                  <span className="text-[10px] text-amber-400 block">Tension Should Continue</span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-400 text-[11px]">Exp: 0.74</span>
                    <span className="text-amber-300 font-bold">
                      Act: {activeResult.actualDiagnostic?.diagnostic.tension_should_continue.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="bg-surface-850 p-2.5 rounded border border-surface-750">
                  <span className="text-[10px] text-slate-500 block">Release Is Appropriate</span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-400 text-[11px]">Exp: 0.12</span>
                    <span className="text-white font-bold">
                      Act: {activeResult.actualDiagnostic?.diagnostic.release_is_appropriate.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {activeResult.actualDiagnostic && (
                <div className="mt-3 text-xs bg-surface-850 p-2 rounded border border-surface-750 text-slate-300 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    <strong className="text-amber-400">Resolved Strategy:</strong>{' '}
                    {activeResult.actualDiagnostic.resolvedStrategy} —{' '}
                    <span className="text-slate-400">{activeResult.actualDiagnostic.reasoning}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Full Field-by-Field Diff Table */}
          <div className="overflow-x-auto border border-surface-750 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-900 border-b border-surface-750 text-[11px] text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Evaluation Dimension</th>
                  <th className="py-2.5 px-4">Expected (Playground Baseline)</th>
                  <th className="py-2.5 px-4">Actual ({engineName})</th>
                  <th className="py-2.5 px-4">Difference / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-750/70 bg-surface-900/50">
                {activeResult.diffs.map((diff, idx) => (
                  <tr key={idx} className="hover:bg-surface-800/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-300">{diff.field}</td>
                    <td className="py-2.5 px-4 text-slate-300 font-medium">
                      {String(diff.expected)}
                    </td>
                    <td className="py-2.5 px-4 text-white font-medium">
                      {String(diff.actual)}
                    </td>
                    <td className="py-2.5 px-4">
                      {diff.matched ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Matched
                          {diff.notes && (
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              ({diff.notes})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-semibold">
                          <XCircle className="w-3.5 h-3.5" /> Discrepancy
                          {diff.notes && (
                            <span className="text-[10px] text-rose-300/80 font-normal ml-1">
                              ({diff.notes})
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-8 text-center text-slate-500">
          Running benchmark analysis...
        </div>
      )}
    </div>
  );
};
