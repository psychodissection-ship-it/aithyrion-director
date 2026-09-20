import React, { useState, useEffect } from 'react';
import { TimelinePoint, StrategyDecision, DiagnosticResolution, ShotDirectionDecision, JevHealthStatus } from '../types/director';
import { MockDirectorEngine } from '../services/engine/MockDirectorEngine';
import { JevDirectorEngine } from '../services/engine/JevDirectorEngine';
import { DARK_WINGS_TRACK } from '../data/sampleTrackDarkWings';
import { SplitSquareVertical, CheckCircle2, AlertTriangle, Play, Film, Video, SunMedium, Scissors, Sparkles, ShieldCheck, ShieldAlert } from 'lucide-react';

interface EngineComparisonData {
  p1: StrategyDecision;
  diag?: DiagnosticResolution;
  effectiveStrategy: string;
  p2: ShotDirectionDecision;
  durationMs: number;
}

export const CompareEnginesView: React.FC = () => {
  const [timeline] = useState<TimelinePoint[]>(DARK_WINGS_TRACK.timeline);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(3); // Default to 17.64s
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [jevHealth, setJevHealth] = useState<JevHealthStatus | null>(null);

  const [mockResult, setMockResult] = useState<EngineComparisonData | null>(null);
  const [jevResult, setJevResult] = useState<EngineComparisonData | null>(null);
  const [jevError, setJevError] = useState<string | null>(null);

  const activePoint = timeline[selectedPointIndex];

  const checkHealth = async () => {
    const jevEngine = new JevDirectorEngine();
    try {
      const h = await jevEngine.checkHealth();
      setJevHealth(h);
    } catch {
      setJevHealth({
        configured: false,
        mode: 'ERROR',
        endpointConfigured: false,
        apiKeyConfigured: false,
      });
    }
  };

  const runDualComparison = async (pointIdx = selectedPointIndex) => {
    setIsComparing(true);
    setJevError(null);
    const targetPoint = timeline[pointIdx];
    const mockEngine = new MockDirectorEngine();
    const jevEngine = new JevDirectorEngine();

    // 1. Run Mock
    const t0 = performance.now();
    const mockP1 = await mockEngine.selectStrategy(targetPoint.musicState, []);
    let mockStrat = mockP1.strategy;
    let mockDiag = undefined;
    if (mockP1.requiresDiagnostic) {
      mockDiag = await mockEngine.diagnoseStrategy(targetPoint.musicState, [], mockP1);
      mockStrat = mockDiag.resolvedStrategy;
    }
    const mockP2 = await mockEngine.selectShotDirection(targetPoint.musicState, mockStrat as any, []);
    const mockDuration = performance.now() - t0;

    setMockResult({
      p1: mockP1,
      diag: mockDiag,
      effectiveStrategy: mockStrat,
      p2: mockP2,
      durationMs: mockDuration,
    });

    // 2. Run JEV (via proxy)
    const t1 = performance.now();
    try {
      const jevP1 = await jevEngine.selectStrategy(targetPoint.musicState, []);
      let jevStrat = jevP1.strategy;
      let jevDiag = undefined;
      if (jevP1.requiresDiagnostic) {
        jevDiag = await jevEngine.diagnoseStrategy(targetPoint.musicState, [], jevP1);
        jevStrat = jevDiag.resolvedStrategy;
      }
      const jevP2 = await jevEngine.selectShotDirection(targetPoint.musicState, jevStrat as any, []);
      const jevDuration = performance.now() - t1;

      setJevResult({
        p1: jevP1,
        diag: jevDiag,
        effectiveStrategy: jevStrat,
        p2: jevP2,
        durationMs: jevDuration,
      });
    } catch (err: any) {
      console.error('JEV Engine dual comparison error:', err);
      setJevError(err.message || 'JEV Execution Failed');
    } finally {
      setIsComparing(false);
      checkHealth();
    }
  };

  useEffect(() => {
    checkHealth();
    runDualComparison(3);
  }, []);

  const isSimulated = jevHealth?.mode === 'SIMULATED';
  const isLiveRemote = jevHealth?.mode === 'LIVE_REMOTE';

  // Consensus evaluations
  const strategyConsensus = mockResult && jevResult ? mockResult.effectiveStrategy === jevResult.effectiveStrategy : false;
  const cutConsensus = mockResult && jevResult ? mockResult.p2.cutDecisionType === jevResult.p2.cutDecisionType : false;
  const shotConsensus =
    mockResult && jevResult
      ? mockResult.p2.final.shot_scale === jevResult.p2.final.shot_scale &&
        mockResult.p2.final.camera_motion === jevResult.p2.final.camera_motion
      : false;

  const renderEngineColumn = (
    title: string,
    badgeColor: string,
    data: EngineComparisonData | null,
    isJev = false
  ) => {
    if (isJev && jevError) {
      return (
        <div className="bg-surface-850 border border-rose-500/50 rounded-xl p-8 text-center text-rose-400 font-mono space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <div className="font-bold text-sm">LIVE JEV NOT CONFIGURED / ERROR</div>
          <div className="text-xs text-rose-300">{jevError}</div>
          <div className="text-[11px] text-slate-500 mt-2">
            Configure JEV_API_ENDPOINT and JEV_API_KEY in server environment to enable live remote evaluation.
          </div>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-8 text-center text-slate-500 font-mono">
          Awaiting execution...
        </div>
      );
    }

    const { p1, diag, effectiveStrategy, p2, durationMs } = data;
    const final = p2.final;

    return (
      <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-5 font-mono space-y-4 shadow-sm">
        {/* Engine Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-700/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${badgeColor}`} />
              <h3 className="text-sm font-bold text-white">
                {isJev && isSimulated ? 'SIMULATED JEV' : title}
              </h3>
              {isJev && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                    isLiveRemote
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isLiveRemote ? 'LIVE REMOTE JEV' : 'SIMULATED JEV'}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">
              Execution latency: {durationMs.toFixed(0)} ms
            </span>
          </div>

          <span className="text-xs px-2.5 py-1 rounded bg-surface-900 border border-surface-750 text-indigo-300 font-semibold">
            {effectiveStrategy}
          </span>
        </div>

        {/* Pass 1 Strategy Card */}
        <div className="bg-surface-900/90 border border-surface-750 p-3 rounded-lg">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Pass 1 Strategy:</span>
            <span className="text-white font-bold">{p1.strategy}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Confidence:</span>
            <span className="text-emerald-400 font-bold">{(p1.confidence * 100).toFixed(0)}%</span>
          </div>
          {p1.requiresDiagnostic && (
            <div className="mt-2 text-[10px] text-amber-300 bg-amber-950/30 px-2 py-1 rounded border border-amber-900/40">
              Diagnostic triggered (Confidence &lt; 30%)
            </div>
          )}
        </div>

        {/* Diagnostic Pass if any */}
        {diag && (
          <div className="bg-surface-900/90 border border-amber-500/30 p-3 rounded-lg text-[10.5px]">
            <span className="text-amber-400 font-semibold block mb-1">Diagnostic Resolution:</span>
            <div className="grid grid-cols-3 gap-1.5 text-center my-1.5">
              <div className="bg-surface-850 p-1 rounded">
                <span className="text-[9px] text-slate-500 block">Impact</span>
                <span className="text-white font-bold">{diag.diagnostic.impact_arrival.toFixed(2)}</span>
              </div>
              <div className="bg-surface-850 p-1 rounded ring-1 ring-amber-500/30">
                <span className="text-[9px] text-amber-400 block">Tension</span>
                <span className="text-amber-300 font-bold">{diag.diagnostic.tension_should_continue.toFixed(2)}</span>
              </div>
              <div className="bg-surface-850 p-1 rounded">
                <span className="text-[9px] text-slate-500 block">Release</span>
                <span className="text-white font-bold">{diag.diagnostic.release_is_appropriate.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-300 mt-1">
              &rarr; <span className="text-amber-400 font-bold">{diag.resolvedStrategy}</span>
            </div>
          </div>
        )}

        {/* Pass 2 Visual Shot Directions */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between bg-surface-900/90 p-2 rounded border border-surface-750">
            <span className="text-slate-400 flex items-center gap-1">
              <Film className="w-3.5 h-3.5 text-indigo-400" /> Shot Scale:
            </span>
            <span className="font-bold text-white">{final.shot_scale}</span>
          </div>

          <div className="flex justify-between bg-surface-900/90 p-2 rounded border border-surface-750">
            <span className="text-slate-400 flex items-center gap-1">
              <Video className="w-3.5 h-3.5 text-cyan-400" /> Camera Motion:
            </span>
            <span className="font-bold text-cyan-300">{final.camera_motion}</span>
          </div>

          <div className="flex justify-between bg-surface-900/90 p-2 rounded border border-surface-750">
            <span className="text-slate-400 flex items-center gap-1">
              <SunMedium className="w-3.5 h-3.5 text-amber-400" /> Lighting:
            </span>
            <span className="font-bold text-amber-300">{final.lighting_change}</span>
          </div>

          <div className="flex justify-between bg-surface-900/90 p-2 rounded border border-surface-750">
            <span className="text-slate-400 flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5 text-rose-400" /> Cut Decision:
            </span>
            <span
              className={`font-bold px-1.5 py-0.5 rounded text-[10.5px] ${
                p2.cutDecisionType === 'SOFT_CUT'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : p2.cutDecisionType === 'HARD_FORCE_CUT'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : p2.cutDecisionType === 'CUT_SUPPRESSED'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-surface-800 text-slate-300'
              }`}
            >
              {p2.cutDecisionType}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 select-none font-mono">
      {/* Top Banner */}
      <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <SplitSquareVertical className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              Compare Engines: Side-by-Side Dual Execution
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              MockDirectorEngine vs JevDirectorEngine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simultaneously evaluates identical music state inputs to test consensus, latency, and framing.
          </p>
        </div>

        <button
          onClick={() => runDualComparison(selectedPointIndex)}
          disabled={isComparing}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded transition shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isComparing ? 'Executing Dual Engines...' : 'Execute Dual Comparison'}</span>
        </button>
      </div>

      {/* Warning if JEV is simulated */}
      {isSimulated && (
        <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>NOTICE: SIMULATED JEV ACTIVE</strong> — The JEV column is currently running in local simulation mode and is NOT a live remote comparison.
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40 font-semibold">
            SIMULATED
          </span>
        </div>
      )}

      {/* Point Selector */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        <span className="text-xs text-slate-400 whitespace-nowrap">Select Cue:</span>
        {timeline.map((pt, idx) => (
          <button
            key={pt.id}
            onClick={() => {
              setSelectedPointIndex(idx);
              runDualComparison(idx);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs transition border ${
              selectedPointIndex === idx
                ? 'bg-indigo-600 text-white border-indigo-500 font-semibold'
                : 'bg-surface-850 text-slate-400 border-surface-700/60 hover:text-slate-200'
            }`}
          >
            {pt.time.toFixed(2)}s ({pt.musicState.section || `P${idx + 1}`})
          </button>
        ))}
      </div>

      {/* Consensus Summary Ribbon */}
      <div className="bg-surface-900 border border-surface-750 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-4">
          <span className="text-slate-400">Consensus Metrics:</span>

          <div className="flex items-center space-x-1.5">
            {strategyConsensus ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
            <span className={strategyConsensus ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              Strategy: {strategyConsensus ? 'MATCH' : 'DIVERGENCE'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            {cutConsensus ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
            <span className={cutConsensus ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              Cut Type: {cutConsensus ? 'MATCH' : 'DIVERGENCE'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            {shotConsensus ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
            <span className={shotConsensus ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              Framing: {shotConsensus ? 'MATCH' : 'DIVERGENCE'}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          Target State: Energy {activePoint.musicState.energy.toFixed(2)} &bull; Trend{' '}
          {activePoint.musicState.energyTrend} &bull; Onset {activePoint.musicState.onsetStrength.toFixed(2)}
        </div>
      </div>

      {/* 2-Column Side-by-Side Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {renderEngineColumn('MockDirectorEngine', 'bg-indigo-400', mockResult, false)}
        {renderEngineColumn('JevDirectorEngine', 'bg-purple-400', jevResult, true)}
      </div>
    </div>
  );
};
