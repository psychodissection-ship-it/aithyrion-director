import React, { useState } from 'react';
import { ShotHistoryItem } from '../types/director';
import { CharacterProfile } from '../types/codexBridge';
import { videoPromptCompiler } from '../services/codex/VideoPromptCompiler';
import { MVConcept } from '../services/director/MVConceptService';
import {
  Clapperboard,
  Scissors,
  Sparkles,
  Video,
  Film,
  Eye,
  Image as ImageIcon,
  ShieldCheck,
  Loader2,
  RotateCcw,
  Play,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

export interface StoryboardKeyframeInfo {
  path?: string;
  status: 'APPROVED' | 'REVIEW' | 'NO_KEYFRAME';
}

export interface BatchGenerationProgress {
  currentShot: number;
  totalShots: number;
  shotTime: number;
  characterName: string;
  strategy: string;
}

interface ShotTimelineVisualizerProps {
  history: ShotHistoryItem[];
  totalDuration?: number;
  activeCharacter?: CharacterProfile | null;
  activeMVConcept?: MVConcept | null;
  onSelectShot?: (time: number) => void;
  keyframes?: Record<number, StoryboardKeyframeInfo>;
  generatingShots?: Record<number, boolean>;
  isBatchGenerating?: boolean;
  batchProgress?: BatchGenerationProgress | null;
  onGenerateKeyframe?: (shotIndex: number) => Promise<void>;
  onGenerateAllKeyframes?: () => Promise<void>;
  onOpenReelModal?: () => void;
}

export const ShotTimelineVisualizer: React.FC<ShotTimelineVisualizerProps> = ({
  history,
  totalDuration = 32.0,
  activeCharacter,
  activeMVConcept,
  onSelectShot,
  keyframes = {},
  generatingShots = {},
  isBatchGenerating = false,
  batchProgress = null,
  onGenerateKeyframe,
  onGenerateAllKeyframes,
  onOpenReelModal,
}) => {
  const [copiedShotIndex, setCopiedShotIndex] = useState<number | null>(null);

  const handleCopyPrompt = (shotIndex: number, item: ShotHistoryItem, duration: number) => {
    const promptObj = videoPromptCompiler.compilePrompt({
      shotIndex,
      direction: item.pass2.final,
      strategy: item.effectiveStrategy,
      musicState: item.musicState,
      durationSec: duration,
      character: activeCharacter,
      concept: activeMVConcept,
    });
    navigator.clipboard.writeText(promptObj.englishPrompt);
    setCopiedShotIndex(shotIndex);
    setTimeout(() => setCopiedShotIndex(null), 2000);
  };
  if (history.length === 0) {
    return (
      <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-5 text-center shadow-sm">
        <div className="flex items-center space-x-2 pb-3 border-b border-surface-700/50 mb-3">
          <Clapperboard className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
            6. Shot Timeline & Storyboard Visualizer
          </h2>
        </div>
        <p className="text-xs text-slate-500 font-mono py-4">
          Direct points in the timeline above to compile the visual Shot Timeline.
        </p>
      </div>
    );
  }

  // Sort history chronologically so the timeline reads smoothly
  const sortedHistory = [...history].sort((a, b) => a.time - b.time);

  // Create contiguous shot blocks
  const shotBlocks = sortedHistory.map((item, index) => {
    const nextItem = sortedHistory[index + 1];
    const endTime = nextItem ? nextItem.time : Math.min(totalDuration, +(item.time + 4.5).toFixed(2));
    const duration = +(endTime - item.time).toFixed(2);
    return {
      item,
      shotIndex: index + 1,
      startTime: item.time,
      endTime,
      duration,
    };
  });

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'INTENSIFY':
        return {
          bar: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
          badge: 'bg-amber-500/30 text-amber-200 border-amber-400/40',
          header: 'border-b border-amber-500/30 bg-amber-500/10',
        };
      case 'RELEASE':
        return {
          bar: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
          badge: 'bg-cyan-500/30 text-cyan-200 border-cyan-400/40',
          header: 'border-b border-cyan-500/30 bg-cyan-500/10',
        };
      case 'IMPACT_HOLD':
        return {
          bar: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
          badge: 'bg-rose-500/30 text-rose-200 border-rose-400/40',
          header: 'border-b border-rose-500/30 bg-rose-500/10',
        };
      case 'CONTINUE_TENSION':
      default:
        return {
          bar: 'bg-violet-500/20 border-violet-500/50 text-violet-300',
          badge: 'bg-violet-500/30 text-violet-200 border-violet-400/40',
          header: 'border-b border-violet-500/30 bg-violet-500/10',
        };
    }
  };

  return (
    <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-700/50 mb-3 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clapperboard className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
              6. Shot Timeline & Storyboard
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Final compiled MV shot plan sequence & Codex Keyframes
            </p>
          </div>
        </div>

        {/* Action Controls & Legend */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-2">
          {onOpenReelModal && Object.values(keyframes).some((k) => k.status === 'APPROVED' || k.path) && (
            <button
              onClick={onOpenReelModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition ring-2 ring-emerald-500/30"
              title="Open the full cinematic Storyboard Reel and watch the MV animatic"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>View Storyboard Reel</span>
            </button>
          )}

          {onGenerateAllKeyframes && (
            <button
              onClick={onGenerateAllKeyframes}
              disabled={isBatchGenerating}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
              title="Sequence through all shots and generate keyframes via Codex automatically"
            >
              {isBatchGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating All Keyframes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Generate All via Codex</span>
                </>
              )}
            </button>
          )}

          <div className="text-[11px] font-mono text-slate-400 hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Cut Points
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> Shot Blocks
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Keyframes
            </span>
          </div>
        </div>
      </div>

      {/* Active Batch Generation Banner */}
      {isBatchGenerating && batchProgress && (
        <div className="mb-4 p-3.5 bg-indigo-950/70 border border-indigo-500/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-indigo-200 flex items-center gap-2">
                <span>Codex Batch Generating: Shot {batchProgress.currentShot} of {batchProgress.totalShots}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-800 text-indigo-200">
                  {Math.round((batchProgress.currentShot / batchProgress.totalShots) * 100)}%
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Target: {batchProgress.shotTime.toFixed(2)}s ({batchProgress.strategy}) &bull; Identity:{' '}
                <span className="text-indigo-300 font-semibold">{batchProgress.characterName}</span>
              </div>
            </div>
          </div>

          <div className="w-full sm:w-56 bg-surface-900 rounded-full h-2.5 overflow-hidden border border-surface-750 flex-shrink-0">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300"
              style={{ width: `${Math.round((batchProgress.currentShot / batchProgress.totalShots) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Completion Success Banner */}
      {!isBatchGenerating && Object.values(keyframes).filter((k) => k.status === 'APPROVED').length === shotBlocks.length && shotBlocks.length > 0 && (
        <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-emerald-200">
                All {shotBlocks.length} Keyframes Generated & Continuity Locked
              </span>
              <span className="text-[11px] text-slate-400 ml-2 hidden sm:inline">
                Sequence is ready to preview as a synchronized MV animatic reel.
              </span>
            </div>
          </div>

          {onOpenReelModal && (
            <button
              onClick={onOpenReelModal}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow flex items-center space-x-1.5 transition flex-shrink-0"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Open Storyboard Reel</span>
            </button>
          )}
        </div>
      )}

      {/* Horizontal Storyboard Blocks (Cards format) */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch space-x-3 min-w-[780px]">
          {shotBlocks.map(({ item, shotIndex, startTime, endTime, duration }, idx) => {
            const colors = getStrategyColor(item.effectiveStrategy);
            const final = item.pass2.final;
            const kfInfo = keyframes[shotIndex] || { status: 'NO_KEYFRAME' };
            const isGenerating = Boolean(generatingShots[shotIndex]);
            const imgSrc = kfInfo.path
              ? `/api/codex/image?path=${encodeURIComponent(kfInfo.path)}`
              : null;

            return (
              <div
                key={item.id}
                onClick={() => onSelectShot && onSelectShot(item.time)}
                className={`flex-1 min-w-[240px] rounded-xl border transition-all cursor-pointer bg-surface-900/90 hover:border-slate-500 flex flex-col justify-between overflow-hidden shadow-sm relative group ${colors.bar}`}
              >
                {/* 1. KEYFRAME DISPLAY BLOCK (Direct Codex Generation) */}
                <div className="aspect-video bg-surface-950 border-b border-surface-800 relative overflow-hidden flex items-center justify-center">
                  {imgSrc ? (
                    <>
                      <img
                        src={imgSrc}
                        alt={`Shot #${shotIndex} Keyframe`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* Hover Overlay with Regenerate Action */}
                      {onGenerateKeyframe && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition p-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onGenerateKeyframe(shotIndex);
                            }}
                            disabled={isGenerating}
                            className="px-2.5 py-1 rounded-lg bg-surface-900/90 hover:bg-surface-800 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold shadow flex items-center space-x-1 transition"
                          >
                            <RotateCcw className="w-3 h-3 text-indigo-400" />
                            <span>Regenerate (Codex)</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : isGenerating ? (
                    <div className="flex flex-col items-center space-y-1.5 p-3 text-center">
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                      <span className="text-[10px] text-indigo-300 font-semibold">Codex Drawing...</span>
                      <span className="text-[9px] text-slate-500">Applying character identity</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-3 text-center space-y-2">
                      <div className="flex items-center space-x-1 text-slate-500 text-[10px]">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>NO KEYFRAME</span>
                      </div>
                      {onGenerateKeyframe && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onGenerateKeyframe(shotIndex);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10.5px] shadow-md flex items-center space-x-1.5 transition transform hover:scale-105 active:scale-95"
                          title="Generate keyframe with Codex using character reference"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Generate (Codex)</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Keyframe Status Badge */}
                  <div className="absolute top-2 right-2">
                    {kfInfo.status === 'APPROVED' && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/90 text-white font-bold text-[9.5px] shadow flex items-center space-x-1 backdrop-blur-sm">
                        <ShieldCheck className="w-3 h-3" />
                        <span>APPROVED</span>
                      </span>
                    )}
                    {kfInfo.status === 'REVIEW' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-slate-950 font-bold text-[9.5px] shadow backdrop-blur-sm">
                        REVIEW
                      </span>
                    )}
                    {kfInfo.status === 'NO_KEYFRAME' && (
                      <span className="px-1.5 py-0.5 rounded bg-black/60 text-slate-400 text-[9.5px] backdrop-blur-sm">
                        UNGENERATED
                      </span>
                    )}
                  </div>

                  {/* Shot Tag */}
                  <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-slate-300 backdrop-blur-sm">
                    Shot #{shotIndex}
                  </div>
                </div>

                {/* Top Bar: Time Range & Duration */}
                <div className={`px-3 py-1.5 flex items-center justify-between font-mono text-xs ${colors.header}`}>
                  <span className="font-bold text-white tracking-tight">
                    {startTime.toFixed(2)}s ───── {endTime.toFixed(2)}s
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {duration.toFixed(2)}s
                  </span>
                </div>

                {/* Body Content */}
                <div className="p-3 space-y-2.5 font-mono flex-1">
                  {/* Strategy Banner */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border ${colors.badge}`}
                    >
                      {item.effectiveStrategy}
                    </span>
                    {item.pass2.cutDecisionType === 'SOFT_CUT' && (
                      <span className="flex items-center gap-1 text-[9.5px] text-emerald-300 font-semibold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        <Scissors className="w-3 h-3 text-emerald-400" />
                        AI SOFT CUT
                      </span>
                    )}
                    {item.pass2.cutDecisionType === 'HARD_FORCE_CUT' && (
                      <span className="flex items-center gap-1 text-[9.5px] text-rose-300 font-semibold bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                        <Scissors className="w-3 h-3 text-rose-400" />
                        HARD CUT
                      </span>
                    )}
                    {item.pass2.cutDecisionType === 'CUT_SUPPRESSED' && (
                      <span className="flex items-center gap-1 text-[9.5px] text-amber-300 font-semibold bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                        CUT SUPPRESSED
                      </span>
                    )}
                  </div>

                  {/* Visual Shot Directions List */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between bg-surface-850/80 px-2 py-1 rounded border border-surface-750">
                      <span className="text-slate-500 text-[10px] flex items-center gap-1">
                        <Film className="w-3 h-3 text-indigo-400" /> SCALE
                      </span>
                      <span className="font-semibold text-white text-[11px]">{final.shot_scale}</span>
                    </div>

                    <div className="flex items-center justify-between bg-surface-850/80 px-2 py-1 rounded border border-surface-750">
                      <span className="text-slate-500 text-[10px] flex items-center gap-1">
                        <Video className="w-3 h-3 text-cyan-400" /> CAMERA
                      </span>
                      <span className="font-semibold text-cyan-300 text-[11px]">{final.camera_motion}</span>
                    </div>

                    <div className="flex items-center justify-between bg-surface-850/80 px-2 py-1 rounded border border-surface-750">
                      <span className="text-slate-500 text-[10px] flex items-center gap-1">
                        <Eye className="w-3 h-3 text-purple-400" /> CHAR
                      </span>
                      <span className="font-semibold text-purple-300 text-[11px]">{final.character_motion}</span>
                    </div>

                    <div className="flex items-center justify-between bg-surface-850/80 px-2 py-1 rounded border border-surface-750">
                      <span className="text-slate-500 text-[10px] flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" /> LIGHT
                      </span>
                      <span className="font-semibold text-amber-300 text-[11px]">{final.lighting_change}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Timeline Span Visual Bar */}
                <div className="bg-surface-800/80 border-t border-surface-700/50 px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <span>Shot #{shotIndex}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyPrompt(shotIndex, item, duration);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] flex items-center space-x-1 transition border ${
                        copiedShotIndex === shotIndex
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-surface-900/90 text-indigo-300 border-indigo-500/30 hover:bg-indigo-950 hover:text-white'
                      }`}
                      title="動画AI用プロンプト (Kling / Runway / Wan2.1) をコピー"
                    >
                      {copiedShotIndex === shotIndex ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                          <span>コピー済</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-2.5 h-2.5 text-indigo-400" />
                          <span>動画Prompt</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    {onOpenReelModal && kfInfo.path && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReelModal();
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        Reel &rarr;
                      </button>
                    )}
                    <span className="text-indigo-400 group-hover:underline">Select</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
