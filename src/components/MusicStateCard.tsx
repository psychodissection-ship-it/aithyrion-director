import React, { useState } from 'react';
import { MusicState } from '../types/director';
import { Radio, TrendingUp, Zap, Clock, Code2, LayoutDashboard } from 'lucide-react';

interface MusicStateCardProps {
  state: MusicState;
  pointDescription?: string;
}

export const MusicStateCard: React.FC<MusicStateCardProps> = ({ state, pointDescription }) => {
  const [viewMode, setViewMode] = useState<'card' | 'json'>('card');

  return (
    <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-4 flex flex-col h-full shadow-sm">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-700/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
              2. Current Music State
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">Real-time acoustic telemetry</p>
          </div>
        </div>

        {/* View Toggle (Card vs JSON) */}
        <div className="flex items-center space-x-1 bg-surface-900 border border-surface-700/60 rounded p-0.5">
          <button
            onClick={() => setViewMode('card')}
            className={`p-1 rounded text-xs transition ${
              viewMode === 'card' ? 'bg-surface-750 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Card View"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`p-1 rounded text-xs transition ${
              viewMode === 'json' ? 'bg-surface-750 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Raw JSON View"
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {pointDescription && (
        <div className="mt-2.5 px-2.5 py-1.5 rounded bg-surface-900/80 border border-surface-700/40 text-[11px] font-mono text-indigo-300/90 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
          <span>{pointDescription}</span>
        </div>
      )}

      {/* Content */}
      <div className="mt-3 flex-1 flex flex-col justify-between">
        {viewMode === 'card' ? (
          <div className="grid grid-cols-2 gap-2.5 font-mono">
            {/* Time */}
            <div className="bg-surface-900/90 border border-surface-750 p-2.5 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-[10.5px]">
                <span>Time</span>
                <Clock className="w-3 h-3 text-slate-500" />
              </div>
              <div className="text-base font-semibold text-white mt-1">
                {state.time.toFixed(2)}{' '}
                <span className="text-xs text-slate-500 font-normal">sec</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {Math.floor(state.time / 60)}:{(state.time % 60).toFixed(2).padStart(5, '0')}
              </div>
            </div>

            {/* Energy */}
            <div className="bg-surface-900/90 border border-surface-750 p-2.5 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-[10.5px]">
                <span>Energy</span>
                <span className="text-indigo-400 text-xs font-semibold">
                  {(state.energy * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-base font-semibold text-white mt-1">
                {state.energy.toFixed(2)}
              </div>
              {/* Progress bar */}
              <div className="w-full bg-surface-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, state.energy * 100)}%` }}
                />
              </div>
            </div>

            {/* Trend */}
            <div className="bg-surface-900/90 border border-surface-750 p-2.5 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-[10.5px]">
                <span>Trend</span>
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="text-sm font-semibold text-emerald-300 mt-1 capitalize truncate">
                {state.energyTrend.replace('_', ' ')}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Momentum vector</div>
            </div>

            {/* Onset Strength */}
            <div className="bg-surface-900/90 border border-surface-750 p-2.5 rounded-lg">
              <div className="flex items-center justify-between text-slate-500 text-[10.5px]">
                <span>Onset</span>
                <Zap className="w-3 h-3 text-amber-400" />
              </div>
              <div className="text-base font-semibold text-white mt-1">
                {state.onsetStrength.toFixed(2)}
              </div>
              {/* Onset mini gauge */}
              <div className="w-full bg-surface-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, state.onsetStrength * 100)}%` }}
                />
              </div>
            </div>

            {/* Next Major Change (Full Width) */}
            <div className="col-span-2 bg-surface-900/90 border border-surface-750 p-2.5 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[10.5px] text-slate-500">Next Major Change</span>
                <div className="text-sm font-semibold text-slate-200 mt-0.5">
                  +{state.nextMajorChange.toFixed(2)} sec
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500">Predicted Horizon</span>
                <div className="text-xs font-mono text-indigo-400">
                  @ {(state.time + state.nextMajorChange).toFixed(2)}s
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface-900 border border-surface-750 rounded-lg p-3 overflow-auto max-h-[220px]">
            <pre className="font-mono text-[11px] text-indigo-300 leading-relaxed">
              {JSON.stringify(
                {
                  time: Number(state.time.toFixed(2)),
                  energy: Number(state.energy.toFixed(2)),
                  energyTrend: state.energyTrend,
                  onsetStrength: Number(state.onsetStrength.toFixed(2)),
                  nextMajorChange: Number(state.nextMajorChange.toFixed(2)),
                  section: state.section,
                  bpm: state.bpm,
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
