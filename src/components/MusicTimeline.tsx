import React from 'react';
import { TimelinePoint, ShotHistoryItem } from '../types/director';
import { ChevronRight, Disc3, Upload, Sparkles, RotateCcw } from 'lucide-react';

interface MusicTimelineProps {
  timeline: TimelinePoint[];
  currentIndex: number;
  history: ShotHistoryItem[];
  trackTitle: string;
  artist: string;
  bpm: number;
  onSelectPoint: (index: number) => void;
  isCustomTrack?: boolean;
  onOpenUpload?: () => void;
  onResetPreset?: () => void;
  currentTime?: number;
  duration?: number;
}

export const MusicTimeline: React.FC<MusicTimelineProps> = ({
  timeline,
  currentIndex,
  history,
  trackTitle,
  artist,
  bpm,
  onSelectPoint,
  isCustomTrack = false,
  onOpenUpload,
  onResetPreset,
  currentTime,
  duration,
}) => {
  const getStrategyColor = (strategy?: string) => {
    switch (strategy) {
      case 'INTENSIFY':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'RELEASE':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'IMPACT_HOLD':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'CONTINUE_TENSION':
        return 'bg-violet-500/20 text-violet-400 border-violet-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(2).padStart(5, '0');
    return `${mins.toString().padStart(2, '0')}:${secs}`;
  };

  return (
    <section className="bg-surface-850 border-b border-surface-700/60 p-4">
      {/* Track Info Bar */}
      <div className="flex flex-wrap items-center justify-between mb-3 text-xs gap-2">
        <div className="flex items-center space-x-2">
          <Disc3 className="w-4 h-4 text-indigo-400 animate-[spin_10s_linear_infinite]" />
          <span className="text-slate-200 font-semibold font-mono tracking-tight">{trackTitle}</span>
          <span className="text-slate-500 font-mono">— {artist}</span>
          <span className="px-1.5 py-0.5 rounded bg-surface-750 text-slate-400 font-mono text-[11px] border border-surface-700">
            {bpm} BPM
          </span>
          {isCustomTrack && (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10.5px]">
              <Sparkles className="w-3 h-3" />
              <span>Auto-DSP Ingested</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition text-[11px]"
              title="Upload custom MP3/WAV audio"
            >
              <Upload className="w-3 h-3" />
              <span>Upload Custom Audio</span>
            </button>
          )}

          {isCustomTrack && onResetPreset && (
            <button
              onClick={onResetPreset}
              className="flex items-center space-x-1 px-2 py-1 rounded bg-surface-800 hover:bg-surface-750 text-slate-400 hover:text-slate-200 border border-surface-700 transition text-[11px]"
              title="Reset to Dark Wings preset"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Dark Wings</span>
            </button>
          )}

          <div className="text-slate-400 font-mono text-[11px] hidden sm:block">
            1. Music Timeline (Click points to inspect / direct)
          </div>
        </div>
      </div>

      {/* Horizontal Timeline Scrubber / Cue Nodes */}
      <div className="relative overflow-x-auto pb-2 pt-1">
        <div className="flex items-stretch space-x-3 min-w-[760px]">
          {timeline.map((point, index) => {
            const isSelected = index === currentIndex;
            const historyItem = history.find((h) => Math.abs(h.time - point.time) < 0.05);
            const strategy = historyItem
              ? historyItem.effectiveStrategy
              : point.expectedStrategy
              ? `? (${point.expectedStrategy})`
              : '?';
            const hasEvaluated = !!historyItem;
            const isCurrentPlayheadNear =
              currentTime !== undefined && Math.abs(currentTime - point.time) < 1.0;

            return (
              <div
                key={point.id}
                onClick={() => onSelectPoint(index)}
                className={`flex-1 min-w-[145px] p-3 rounded-lg cursor-pointer transition-all border text-left relative group ${
                  isSelected
                    ? 'bg-surface-750 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500'
                    : isCurrentPlayheadNear
                    ? 'bg-surface-800 border-amber-500/50'
                    : hasEvaluated
                    ? 'bg-surface-800/80 border-surface-700/80 hover:border-slate-500'
                    : 'bg-surface-900/60 border-surface-700/40 opacity-70 hover:opacity-100 hover:border-surface-600'
                }`}
              >
                {/* Active Indicator Pip */}
                {isSelected && (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-500 rounded-full ring-4 ring-surface-850 shadow-sm" />
                )}

                {/* Time & Section Tag */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-semibold text-white">
                    {formatTime(point.time)}
                  </span>
                  <span
                    className="text-[10px] font-mono text-slate-400 truncate max-w-[65px]"
                    title={point.musicState.section}
                  >
                    {point.musicState.section || `P${index + 1}`}
                  </span>
                </div>

                {/* Strategy Badge */}
                <div className="mb-2">
                  <span
                    className={`inline-block font-mono text-[11px] font-medium px-2 py-0.5 rounded border transition-colors ${getStrategyColor(
                      historyItem?.effectiveStrategy
                    )}`}
                  >
                    {hasEvaluated ? historyItem?.effectiveStrategy : isSelected ? 'ACTIVE' : strategy}
                  </span>
                </div>

                {/* Telemetry Snapshot */}
                <div className="space-y-1 font-mono text-[10.5px] text-slate-400 border-t border-surface-700/50 pt-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Energy</span>
                    <span className="text-slate-200 font-medium">
                      {(point.musicState.energy * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Tiny Energy Bar */}
                  <div className="w-full bg-surface-900 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-indigo-400 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, point.musicState.energy * 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">Trend</span>
                    <span className="text-slate-300 capitalize">
                      {point.musicState.energyTrend.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">Onset</span>
                    <span className="text-slate-300">{point.musicState.onsetStrength.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">Next Shift</span>
                    <span className="text-slate-300">+{point.musicState.nextMajorChange.toFixed(2)}s</span>
                  </div>
                </div>

                {/* Hover indicator */}
                <div className="mt-2 text-[10px] text-indigo-400/80 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Select</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
