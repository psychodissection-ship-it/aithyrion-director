import React, { useState, useEffect } from 'react';
import { ShotHistoryItem } from '../../types/director';
import { StoryboardKeyframeInfo } from '../ShotTimelineVisualizer';
import { CharacterProfile } from '../../types/codexBridge';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Clapperboard,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Layers,
  Clock,
  Film,
  Volume2,
  Copy,
  Check,
  Video,
  Zap,
  Loader2,
} from 'lucide-react';
import { videoPromptCompiler } from '../../services/codex/VideoPromptCompiler';
import { MVConcept } from '../../services/director/MVConceptService';
import { HailuoGenerationModal } from '../video/HailuoGenerationModal';
import { hailuoVideoService, HailuoBatchState } from '../../services/video/HailuoVideoService';
import { mvMasterService } from '../../services/video/MvMasterService';
import { MasterMvModal } from '../video/MasterMvModal';

export interface StoryboardReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: ShotHistoryItem[];
  keyframes: Record<number, StoryboardKeyframeInfo>;
  totalDuration: number;
  activeCharacter?: CharacterProfile | null;
  activeMVConcept?: MVConcept | null;
  trackTitle?: string;
  artist?: string;
  audioPlayer?: {
    isPlaying: boolean;
    currentTime: number;
    play: () => Promise<void>;
    pause: () => void;
    seek: (time: number) => void;
  };
  onRegenerateShot?: (shotIndex: number) => void;
}

export const StoryboardReelModal: React.FC<StoryboardReelModalProps> = ({
  isOpen,
  onClose,
  history,
  keyframes,
  totalDuration,
  activeCharacter,
  activeMVConcept,
  trackTitle = 'Track',
  artist = 'Artist',
  audioPlayer,
  onRegenerateShot,
}) => {
  const sortedHistory = [...history].sort((a, b) => a.time - b.time);
  const totalShots = sortedHistory.length;

  const [activeShotIndex, setActiveShotIndex] = useState<number>(1);
  const [isPlayingReel, setIsPlayingReel] = useState<boolean>(false);
  const [syncWithAudio, setSyncWithAudio] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'prompt' | 'continuity'>('prompt');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Hailuo AI Video Generation Modal State
  const [isHailuoModalOpen, setIsHailuoModalOpen] = useState<boolean>(false);
  const [hailuoTargetShotIndex, setHailuoTargetShotIndex] = useState<number>(1);
  const [generatedVideos, setGeneratedVideos] = useState<Record<number, string>>({});

  // Batch Video Generation State
  const [batchState, setBatchState] = useState<HailuoBatchState | null>(null);
  const [isBatchPolling, setIsBatchPolling] = useState<boolean>(false);

  // MV Master Build State
  const [isMasterBuilding, setIsMasterBuilding] = useState<boolean>(false);
  const [masterBuildStatus, setMasterBuildStatus] = useState<string>('');
  const [masterVideoUrl, setMasterVideoUrl] = useState<string | null>(null);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      hailuoVideoService.listVideos().then((videos) => {
        if (!isMounted) return;
        const map: Record<number, string> = {};
        videos.forEach((v) => {
          map[v.shotIndex] = v.url;
        });
        setGeneratedVideos(map);
      });

      // Check if master MV exists
      fetch('/api/mv/video')
        .then((res) => {
          if (isMounted && res.ok) setMasterVideoUrl(`/master_mv.mp4?t=${Date.now()}`);
        })
        .catch(() => {});

      // Check current batch status
      hailuoVideoService
        .getBatchStatus()
        .then((s) => {
          if (!isMounted) return;
          setBatchState(s);
          if (s.isRunning) setIsBatchPolling(true);
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [isOpen]);

  // Batch polling effect — uses recursive setTimeout to avoid overlapping requests (M-6 fix)
  useEffect(() => {
    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout>;

    async function pollBatch() {
      if (!isMounted || !isBatchPolling) return;
      try {
        const state = await hailuoVideoService.getBatchStatus();
        if (!isMounted) return;
        setBatchState(state);
        if (!state.isRunning) {
          setIsBatchPolling(false);
          const videos = await hailuoVideoService.listVideos();
          if (!isMounted) return;
          const map: Record<number, string> = {};
          videos.forEach((v) => {
            map[v.shotIndex] = v.url;
          });
          setGeneratedVideos(map);
          return; // Stop polling
        }
      } catch {
        if (isMounted) setIsBatchPolling(false);
        return;
      }
      if (isMounted) {
        timerId = setTimeout(pollBatch, 4000);
      }
    }

    if (isBatchPolling) {
      pollBatch();
    }

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [isBatchPolling]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Compute shot timeline intervals
  const shotIntervals = sortedHistory.map((item, idx) => {
    const nextItem = sortedHistory[idx + 1];
    const startTime = item.time;
    const endTime = nextItem ? nextItem.time : totalDuration || +(startTime + 4.5).toFixed(2);
    const duration = +(endTime - startTime).toFixed(2);
    return {
      shotIndex: idx + 1,
      item,
      startTime,
      endTime,
      duration,
    };
  });

  // Current active interval
  const activeInterval =
    shotIntervals.find((s) => s.shotIndex === activeShotIndex) || shotIntervals[0];
  const activeKfInfo = keyframes[activeShotIndex] || { status: 'NO_KEYFRAME' };
  const approvedCount = Object.values(keyframes).filter((k) => k.status === 'APPROVED').length;

  // Compiled video prompt for active shot
  const compiledVideoPrompt = activeInterval
    ? videoPromptCompiler.compilePrompt({
        shotIndex: activeInterval.shotIndex,
        direction: activeInterval.item.pass2.final,
        strategy: activeInterval.item.effectiveStrategy,
        musicState: activeInterval.item.musicState,
        durationSec: activeInterval.duration,
        character: activeCharacter,
        concept: activeMVConcept,
      })
    : null;

  // Sync with audio playback if active
  useEffect(() => {
    if (!isOpen || !syncWithAudio || !audioPlayer?.isPlaying) return;

    const t = audioPlayer.currentTime;
    const current = shotIntervals.find((s) => t >= s.startTime && t < s.endTime);
    if (current && current.shotIndex !== activeShotIndex) {
      setActiveShotIndex(current.shotIndex);
    }
  }, [audioPlayer?.currentTime, audioPlayer?.isPlaying, isOpen, syncWithAudio, shotIntervals, activeShotIndex]);

  // Slideshow auto-advance timer when playing without audio
  useEffect(() => {
    if (!isOpen || !isPlayingReel || (syncWithAudio && audioPlayer?.isPlaying)) return;

    const dur = (activeInterval?.duration || 3) * 1000;
    const timer = setTimeout(() => {
      setActiveShotIndex((prev) => (prev >= totalShots ? 1 : prev + 1));
    }, Math.min(dur, 4000));

    return () => clearTimeout(timer);
  }, [isOpen, isPlayingReel, syncWithAudio, audioPlayer?.isPlaying, activeShotIndex, totalShots, activeInterval]);

  if (!isOpen || totalShots === 0) return null;

  const handleTogglePlay = async () => {
    if (syncWithAudio && audioPlayer) {
      if (audioPlayer.isPlaying) {
        audioPlayer.pause();
        setIsPlayingReel(false);
      } else {
        if (activeInterval) {
          audioPlayer.seek(activeInterval.startTime);
        }
        await audioPlayer.play();
        setIsPlayingReel(true);
      }
    } else {
      setIsPlayingReel((prev) => !prev);
    }
  };

  const handlePrev = () => {
    const prevIdx = Math.max(1, activeShotIndex - 1);
    setActiveShotIndex(prevIdx);
    if (syncWithAudio && audioPlayer) {
      const prevInterval = shotIntervals[prevIdx - 1];
      if (prevInterval) audioPlayer.seek(prevInterval.startTime);
    }
  };

  const handleNext = () => {
    const nextIdx = Math.min(totalShots, activeShotIndex + 1);
    setActiveShotIndex(nextIdx);
    if (syncWithAudio && audioPlayer) {
      const nextInterval = shotIntervals[nextIdx - 1];
      if (nextInterval) audioPlayer.seek(nextInterval.startTime);
    }
  };

  const handleExportJson = () => {
    const data = {
      project: 'Aithyrion Director',
      track: { title: trackTitle, artist, duration: totalDuration },
      character: activeCharacter,
      mvConcept: activeMVConcept,
      exportedAt: new Date().toISOString(),
      shots: shotIntervals.map((s) => {
        const prompt = videoPromptCompiler.compilePrompt({
          shotIndex: s.shotIndex,
          direction: s.item.pass2.final,
          strategy: s.item.effectiveStrategy,
          musicState: s.item.musicState,
          durationSec: s.duration,
          character: activeCharacter,
          concept: activeMVConcept,
        });
        return {
          shotIndex: s.shotIndex,
          timeRange: { start: s.startTime, end: s.endTime, duration: s.duration },
          strategy: s.item.effectiveStrategy,
          section: s.item.musicState.section,
          direction: s.item.pass2.final,
          keyframe: keyframes[s.shotIndex] || { status: 'NO_KEYFRAME' },
          videoPrompt: prompt,
        };
      }),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyboard-${trackTitle.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartBatchGeneration = async () => {
    if (batchState?.isRunning) return;

    // Collect all shots with their compiled prompt and keyframe
    const batchShots = shotIntervals.map((s) => {
      const prompt = videoPromptCompiler.compilePrompt({
        shotIndex: s.shotIndex,
        direction: s.item.pass2.final,
        strategy: s.item.effectiveStrategy,
        musicState: s.item.musicState,
        durationSec: s.duration,
        character: activeCharacter,
        concept: activeMVConcept,
      });
      const kf = keyframes[s.shotIndex];
      return {
        shotIndex: s.shotIndex,
        prompt: prompt.englishPrompt,
        keyframePath: kf?.path,
        duration: s.duration >= 8 ? 10 : 6,
        model: 'MiniMax-Hailuo-2.3',
      };
    });

    try {
      const res = await hailuoVideoService.startBatchGeneration({
        shots: batchShots,
        model: 'MiniMax-Hailuo-2.3',
      });
      setBatchState(res.state);
      setIsBatchPolling(true);
    } catch (err: any) {
      alert(`一括動画生成の開始に失敗しました: ${err.message}`);
    }
  };

  const handleCancelBatch = async () => {
    try {
      const res = await hailuoVideoService.cancelBatch();
      setBatchState(res.state);
      setIsBatchPolling(false);
    } catch (err) {
      console.warn('Failed to cancel batch generation:', err);
    }
  };

  const handleBuildMasterMv = async () => {
    if (isMasterBuilding) return;

    const ungeneratedCount = shotIntervals.filter((s) => !generatedVideos[s.shotIndex]).length;
    if (ungeneratedCount > 0) {
      const proceed = window.confirm(
        `【確認】全${shotIntervals.length}カット中、${ungeneratedCount}カットはまだAI動画が生成されていません（静止画のままです）。\n\n『⚡ 全カット一括生成』を実行すると全カットを本格AI動画に変換できます。\nこのまま静止画を含む状態でMVマスターを書き出しますか？`
      );
      if (!proceed) return;
    }

    setIsMasterBuilding(true);
    setMasterBuildStatus('MVマスターの合成準備中...');

    try {
      const shots = shotIntervals.map((s) => ({
        shotIndex: s.shotIndex,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.duration,
        keyframePath: keyframes[s.shotIndex]?.path,
      }));

      await mvMasterService.buildMaster({
        shots,
        audioPath: 'generated/audio/active_track.wav',
        applyVjEffects: true,
        resolution: '720p',
      });

      const finalState = await mvMasterService.pollUntilComplete((state) => {
        setMasterBuildStatus(state.statusMessage);
      });

      if (finalState.outputVideoUrl) {
        setMasterVideoUrl(finalState.outputVideoUrl);
        setIsMasterModalOpen(true);
      }
    } catch (err: any) {
      alert(`MVマスター書き出しエラー: ${err.message}`);
    } finally {
      setIsMasterBuilding(false);
    }
  };

  const activeSrc = activeKfInfo.path
    ? `/api/codex/image?path=${encodeURIComponent(activeKfInfo.path)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden font-mono text-slate-100">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-surface-800 flex items-center justify-between bg-surface-950/60 flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  MV Storyboard Reel & Narrative Sequence
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                  {approvedCount} / {totalShots} Keyframes Generated
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {trackTitle} &bull; {artist} &bull; Character:{' '}
                <span className="text-indigo-300 font-semibold">{activeCharacter?.name || 'Default'}</span>
                {activeMVConcept && (
                  <>
                    {' '}&bull; Concept:{' '}
                    <span className="text-amber-300 font-semibold">{activeMVConcept.title}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-2">
            {/* Batch Video Generation Button */}
            <button
              onClick={handleStartBatchGeneration}
              disabled={batchState?.isRunning}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                batchState?.isRunning
                  ? 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-500/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white shadow-md shadow-fuchsia-950/30'
              }`}
              title="全ショットのキーフレームからMiniMax Hailuo 2.3で一括全自動動画生成"
            >
              {batchState?.isRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-fuchsia-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{batchState?.isRunning ? `一括生成中 (${batchState.completed}/${batchState.total})` : '⚡ 全カット一括生成'}</span>
            </button>

            {/* Master MV Export Button */}
            <button
              onClick={handleBuildMasterMv}
              disabled={isMasterBuilding}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                isMasterBuilding
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/30'
              }`}
              title="全カット動画を連結し、楽曲とビート同期VJエフェクトを適用して完成版マスターMVを出力"
            >
              {isMasterBuilding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Film className="w-3.5 h-3.5 text-cyan-300" />
              )}
              <span>{isMasterBuilding ? 'マスター書き出し中...' : '🎬 完成MVマスター書き出し'}</span>
            </button>

            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-200 border border-surface-700 text-xs flex items-center space-x-1.5 transition"
              title="Download Storyboard JSON manifest"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Batch Progress Bar Banner */}
        {batchState?.isRunning && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-fuchsia-950/70 via-purple-950/70 to-indigo-950/70 border-b border-fuchsia-500/30 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center space-x-3 flex-1 mr-4">
              <Loader2 className="w-4 h-4 animate-spin text-fuchsia-400 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-fuchsia-200">
                    全カット一括生成中: {batchState.statusMessage}
                  </span>
                  <span className="text-fuchsia-300 font-mono">
                    {batchState.completed} / {batchState.total} 完了 ({Math.round((batchState.completed / (batchState.total || 1)) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${(batchState.completed / (batchState.total || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleCancelBatch}
              className="px-2.5 py-1 rounded bg-surface-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-surface-700 text-[11px] transition"
            >
              中断
            </button>
          </div>
        )}

        {/* Master MV Building Progress Banner */}
        {isMasterBuilding && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-emerald-950/70 via-teal-950/70 to-cyan-950/70 border-b border-emerald-500/30 flex items-center space-x-3 text-xs animate-in fade-in">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-emerald-200">
                MVマスター書き出し中: {masterBuildStatus}
              </div>
              <p className="text-[10px] text-emerald-400/80 mt-0.5">
                全カットクリップの尺調整・連結・楽曲ビートシンク・ホワイトフラッシュ・サイバーネオン調色を合成中
              </p>
            </div>
          </div>
        )}

        {/* Master MV Ready Banner */}
        {masterVideoUrl && !isMasterBuilding && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border-b border-emerald-500/40 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center space-x-2 text-emerald-300">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="font-bold">🎬 完成版MVマスターの生成が完了しています！</span>
            </div>
            <button
              onClick={() => setIsMasterModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow"
            >
              <Film className="w-3.5 h-3.5" />
              <span>マスターMVを再生・確認</span>
            </button>
          </div>
        )}

        {/* Modal Body: Two-Section Cinematic Layout */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col space-y-4">
          
          {/* Top Cinema Display */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            
            {/* 16:9 Screen */}
            <div className="min-w-0 w-full md:col-span-7 xl:col-span-7 bg-surface-950 border border-surface-800 rounded-xl overflow-hidden relative flex flex-col shadow-inner aspect-video">
              {generatedVideos[activeShotIndex] ? (
                <div className="relative w-full h-full">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    src={generatedVideos[activeShotIndex]}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-12 right-3 px-2 py-0.5 rounded bg-fuchsia-950/80 backdrop-blur-sm text-fuchsia-300 border border-fuchsia-500/40 text-[10px] font-bold flex items-center space-x-1 shadow">
                    <Video className="w-3 h-3 text-fuchsia-400" />
                    <span>Hailuo AI Video Playing</span>
                  </div>
                </div>
              ) : activeSrc ? (
                <img
                  src={activeSrc}
                  alt={`Shot #${activeShotIndex}`}
                  className="w-full h-full object-cover select-none"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 space-y-2">
                  <Film className="w-10 h-10 stroke-1 text-slate-600" />
                  <span className="text-xs font-semibold">Keyframe Not Yet Generated</span>
                  {onRegenerateShot && (
                    <button
                      onClick={() => onRegenerateShot(activeShotIndex)}
                      className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                    >
                      Generate via Codex
                    </button>
                  )}
                </div>
              )}

              {/* Screen Top HUD Overlay */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-white/20 text-white font-bold text-xs shadow-lg">
                    SHOT {String(activeShotIndex).padStart(2, '0')} / {String(totalShots).padStart(2, '0')}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-950/80 backdrop-blur-md border border-indigo-500/40 text-indigo-300 text-[11px] font-semibold">
                    {activeInterval?.startTime.toFixed(2)}s &rarr; {activeInterval?.endTime.toFixed(2)}s ({activeInterval?.duration}s)
                  </span>
                </div>

                <div className="flex items-center space-x-2 pointer-events-auto">
                  <button
                    onClick={() => {
                      setHailuoTargetShotIndex(activeShotIndex);
                      setIsHailuoModalOpen(true);
                    }}
                    className={`px-2.5 py-1 rounded-md backdrop-blur-md border text-[11px] font-bold flex items-center space-x-1 shadow-lg transition active:scale-95 ${
                      generatedVideos[activeShotIndex]
                        ? 'bg-fuchsia-950/80 border-fuchsia-500/60 text-fuchsia-200 hover:bg-fuchsia-900'
                        : 'bg-gradient-to-r from-indigo-600/90 to-fuchsia-600/90 border-fuchsia-400/50 text-white hover:from-indigo-500 hover:to-fuchsia-500'
                    }`}
                    title="Hailuo AI (MiniMax) で動画を生成"
                  >
                    <Film className="w-3 h-3 text-fuchsia-300" />
                    <span>{generatedVideos[activeShotIndex] ? '動画再生成 (Hailuo)' : '動画生成 (Hailuo AI)'}</span>
                  </button>

                  <span className="px-2 py-0.5 rounded-md bg-amber-950/80 backdrop-blur-md border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                    {activeInterval?.item.effectiveStrategy}
                  </span>
                  {activeKfInfo.status === 'APPROVED' && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>APPROVED</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Screen Bottom HUD Overlay: Shot Parameters */}
              <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
                <div className="bg-black/75 backdrop-blur-md border border-white/10 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-3 text-slate-200">
                    <span>
                      <strong className="text-slate-400 text-[10px]">SCALE:</strong>{' '}
                      <span className="text-white font-bold">{activeInterval?.item.pass2.final.shot_scale}</span>
                    </span>
                    <span>
                      <strong className="text-slate-400 text-[10px]">CAMERA:</strong>{' '}
                      <span className="text-cyan-300 font-bold">{activeInterval?.item.pass2.final.camera_motion}</span>
                    </span>
                    <span>
                      <strong className="text-slate-400 text-[10px]">ACTION:</strong>{' '}
                      <span className="text-indigo-300 font-bold">{activeInterval?.item.pass2.final.character_motion}</span>
                    </span>
                    <span>
                      <strong className="text-slate-400 text-[10px]">LIGHT:</strong>{' '}
                      <span className="text-amber-300 font-bold">{activeInterval?.item.pass2.final.lighting_change}</span>
                    </span>
                  </div>

                  <span className="text-slate-400 text-[11px]">
                    Section: <strong className="text-slate-200">{activeInterval?.item.musicState.section || 'Pass'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Panel: Shot Narrative, Continuity & I2V Motion Prompts */}
            <div className="min-w-0 w-full md:col-span-5 xl:col-span-5 bg-surface-850 border border-surface-700/60 rounded-xl p-3 sm:p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                {/* Tab Navigation */}
                <div className="flex items-center justify-between border-b border-surface-750 pb-2">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setActiveTab('prompt')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 transition ${
                        activeTab === 'prompt'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5 text-amber-300" />
                      <span>🎬 動画プロンプト</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('continuity')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 transition ${
                        activeTab === 'continuity'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>演出・文脈</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Shot #{activeShotIndex}
                  </span>
                </div>

                {/* TAB 1: I2V Video Prompt */}
                {activeTab === 'prompt' && compiledVideoPrompt && (
                  <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5 text-xs">
                    {/* Target Video Models */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-semibold mr-1">適用AI:</span>
                      <span className="px-1.5 py-0.5 rounded bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-500/40 text-[9px] font-bold">
                        Hailuo AI (MiniMax)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold">Kling AI (I2V)</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold">Runway Gen-3</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold">Wan 2.1</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold">Luma</span>
                    </div>

                    {/* Hailuo AI Video Generation Action Button */}
                    <button
                      onClick={() => {
                        setHailuoTargetShotIndex(activeShotIndex);
                        setIsHailuoModalOpen(true);
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition active:scale-98"
                    >
                      <Film className="w-4 h-4 text-fuchsia-200" />
                      <span>🎬 Hailuo AI (MiniMax) で動画を生成する</span>
                    </button>

                    {/* English Motion Prompt */}
                    <div className="bg-surface-900/90 border border-indigo-500/40 rounded-lg p-2.5 space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          I2V 英語動画プロンプト
                        </span>
                        <button
                          onClick={() => handleCopy(compiledVideoPrompt.englishPrompt, 'en')}
                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center space-x-1 shadow transition active:scale-95"
                        >
                          {copiedType === 'en' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-300" />
                              <span className="text-emerald-300">コピー完了！</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>プロンプトをコピー</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-200 leading-relaxed font-mono bg-black/40 p-2 rounded border border-white/5 select-all max-h-28 overflow-y-auto">
                        {compiledVideoPrompt.englishPrompt}
                      </div>
                    </div>

                    {/* Motion Settings / Parameters */}
                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                      <div className="bg-surface-900/80 border border-surface-750 p-1.5 rounded">
                        <div className="text-[9px] text-slate-400">DURATION</div>
                        <div className="text-[11px] font-bold text-amber-300">{compiledVideoPrompt.recommendedDurationSec}s</div>
                      </div>
                      <div className="bg-surface-900/80 border border-surface-750 p-1.5 rounded">
                        <div className="text-[9px] text-slate-400">FRAME RATE</div>
                        <div className="text-[11px] font-bold text-cyan-300">24 fps</div>
                      </div>
                      <div className="bg-surface-900/80 border border-surface-750 p-1.5 rounded">
                        <div className="text-[9px] text-slate-400">MOTION INTENSITY</div>
                        <div className="text-[11px] font-bold text-emerald-300">{compiledVideoPrompt.motionScale}</div>
                      </div>
                    </div>

                    {/* Japanese Director Notes */}
                    <div className="bg-surface-900/80 border border-surface-750 rounded-lg p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-300">日本語演出メモ</span>
                        <button
                          onClick={() => handleCopy(compiledVideoPrompt.japanesePrompt, 'ja')}
                          className="text-[9px] text-slate-400 hover:text-white flex items-center space-x-1"
                        >
                          {copiedType === 'ja' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                          <span>{copiedType === 'ja' ? 'コピー済' : 'コピー'}</span>
                        </button>
                      </div>
                      <pre className="text-[10px] text-slate-300 whitespace-pre-wrap font-mono bg-black/30 p-1.5 rounded leading-relaxed">
                        {compiledVideoPrompt.japanesePrompt}
                      </pre>
                    </div>

                    {/* Negative Prompt */}
                    <div className="bg-surface-900/80 border border-surface-750 rounded-lg p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400">ネガティブプロンプト</span>
                        <button
                          onClick={() => handleCopy(compiledVideoPrompt.negativePrompt, 'neg')}
                          className="text-[9px] text-slate-400 hover:text-white flex items-center space-x-1"
                        >
                          {copiedType === 'neg' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                          <span>{copiedType === 'neg' ? 'コピー済' : 'コピー'}</span>
                        </button>
                      </div>
                      <p className="text-[9.5px] text-slate-400 font-mono truncate">
                        {compiledVideoPrompt.negativePrompt}
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 2: Shot Continuity & Context */}
                {activeTab === 'continuity' && (
                  <div className="space-y-3 flex-1 overflow-y-auto pr-0.5 text-xs">
                    {/* Identity Source */}
                    <div className="bg-surface-900/80 border border-surface-750 rounded-lg p-2.5 text-xs space-y-1">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        キャラクター原案 (Identity Reference)
                      </div>
                      <div className="flex items-center space-x-2">
                        {activeCharacter?.identity_reference ? (
                          <img
                            src={`/api/codex/image?path=${encodeURIComponent(activeCharacter.identity_reference)}`}
                            alt="Character"
                            className="w-8 h-8 rounded-md object-cover border border-surface-700 flex-shrink-0"
                          />
                        ) : null}
                        <div>
                          <div className="text-xs font-bold text-white">
                            {activeCharacter?.name || 'SaraLex Character'}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                            {activeCharacter?.identity_reference || 'references/characters/default/identity.png'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Continuity Source */}
                    <div className="bg-surface-900/80 border border-surface-750 rounded-lg p-2.5 text-xs space-y-1">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        構図・絵柄の継承元 (Continuity Origin)
                      </div>
                      <div className="text-xs text-slate-300">
                        {activeShotIndex === 1 ? (
                          <span className="text-amber-400 font-semibold">&bull; 第1カット（キャラクター原案から直接生成）</span>
                        ) : (
                          <span className="text-cyan-400 font-semibold">
                            &bull; 直前のカット (Shot #{activeShotIndex - 1}) の構図・作風を継承
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rationale & Music State */}
                    <div className="bg-surface-900/80 border border-surface-750 rounded-lg p-2.5 text-xs space-y-1.5">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        音楽エネルギー & 演出意図
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
                        <span>Energy: {Math.round((activeInterval?.item.musicState.energy || 0) * 100)}%</span>
                        <span>Trend: {activeInterval?.item.musicState.energyTrend}</span>
                        <span>Onset: {activeInterval?.item.musicState.onsetStrength.toFixed(2)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Confidence: <strong className="text-amber-300">{Math.round((activeInterval?.item.pass1.confidence || 0) * 100)}%</strong> &bull; Status: <strong className="text-emerald-300">{activeInterval?.item.pass1.status}</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button to regenerate if needed */}
              {onRegenerateShot && (
                <button
                  onClick={() => onRegenerateShot(activeShotIndex)}
                  className="w-full py-2 rounded-lg bg-surface-800 hover:bg-surface-750 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>CodexでShot #{activeShotIndex} を再作画 (Regenerate)</span>
                </button>
              )}
            </div>
          </div>

          {/* Playback & Scrubbing Transport Bar */}
          <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrev}
                disabled={activeShotIndex <= 1}
                className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 disabled:opacity-30 border border-surface-700 transition"
                title="Previous Shot"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={handleTogglePlay}
                className={`px-4 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition ${
                  (syncWithAudio && audioPlayer?.isPlaying) || isPlayingReel
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {(syncWithAudio && audioPlayer?.isPlaying) || isPlayingReel ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause Reel</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Play MV Reel</span>
                  </>
                )}
              </button>

              <button
                onClick={handleNext}
                disabled={activeShotIndex >= totalShots}
                className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 disabled:opacity-30 border border-surface-700 transition"
                title="Next Shot"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {audioPlayer && (
                <button
                  onClick={() => setSyncWithAudio((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center space-x-1 ${
                    syncWithAudio
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                      : 'bg-surface-800 text-slate-400 border-surface-700'
                  }`}
                  title="Toggle Music Audio Sync"
                >
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sync with Music: {syncWithAudio ? 'ON' : 'OFF'}</span>
                </button>
              )}
            </div>

            {/* Time Display */}
            <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Reel Time:{' '}
                <strong className="text-white">
                  {audioPlayer && syncWithAudio
                    ? audioPlayer.currentTime.toFixed(2)
                    : activeInterval?.startTime.toFixed(2)}
                  s
                </strong>{' '}
                / {totalDuration.toFixed(2)}s
              </span>
            </div>
          </div>

          {/* Filmstrip Sequence Carousel */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Shot Sequence Filmstrip ({totalShots} Cuts)</span>
              <span className="text-[10px] text-slate-500">Click any shot to inspect</span>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="flex items-stretch space-x-3 min-w-[700px]">
                {shotIntervals.map((s) => {
                  const isCurrent = s.shotIndex === activeShotIndex;
                  const kf = keyframes[s.shotIndex];
                  const thumbSrc = kf?.path
                    ? `/api/codex/image?path=${encodeURIComponent(kf.path)}`
                    : null;

                  return (
                    <div
                      key={s.shotIndex}
                      onClick={() => {
                        setActiveShotIndex(s.shotIndex);
                        if (syncWithAudio && audioPlayer) {
                          audioPlayer.seek(s.startTime);
                        }
                      }}
                      className={`w-44 rounded-xl border p-2 flex flex-col justify-between cursor-pointer transition-all flex-shrink-0 ${
                        isCurrent
                          ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-2 ring-indigo-500/50 scale-[1.02]'
                          : 'bg-surface-850 border-surface-700/60 hover:border-slate-500 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-video bg-surface-950 rounded-lg overflow-hidden relative border border-surface-800 mb-2 flex items-center justify-center">
                        {thumbSrc ? (
                          <img
                            src={thumbSrc}
                            alt={`Shot #${s.shotIndex}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-5 h-5 text-slate-600" />
                        )}
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-white font-bold text-[9px]">
                          #{s.shotIndex}
                        </span>
                        <div className="absolute top-1 right-1 flex items-center space-x-1">
                          {generatedVideos[s.shotIndex] && (
                            <span className="px-1 py-0.5 rounded bg-fuchsia-600 text-white font-bold text-[8px] flex items-center space-x-0.5 shadow" title="Hailuo AI Video Ready">
                              <Video className="w-2.5 h-2.5" />
                              <span>MP4</span>
                            </span>
                          )}
                          {kf?.status === 'APPROVED' && (
                            <span className="px-1 py-0.5 rounded bg-emerald-500 text-white font-bold text-[8px] flex items-center space-x-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="text-[10px] space-y-0.5">
                        <div className="flex items-center justify-between font-bold text-slate-300">
                          <span>{s.startTime.toFixed(2)}s &bull; {s.duration}s</span>
                          <span className="text-amber-400">{s.item.effectiveStrategy}</span>
                        </div>
                        <div className="text-slate-400 truncate">
                          {s.item.pass2.final.shot_scale} &bull; {s.item.pass2.final.camera_motion}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-surface-800 flex items-center justify-between bg-surface-950/60 text-xs text-slate-400 font-mono">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              All keyframes generated via Codex &bull; Visual continuity verified & approved
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-white border border-surface-700 text-xs font-semibold transition"
          >
            Close Viewer
          </button>
        </div>

      </div>

      {/* Hailuo AI Video Generation Modal */}
      {isHailuoModalOpen && (
        <HailuoGenerationModal
          isOpen={isHailuoModalOpen}
          onClose={() => setIsHailuoModalOpen(false)}
          shotIndex={hailuoTargetShotIndex}
          timeRange={`${shotIntervals[hailuoTargetShotIndex - 1]?.startTime.toFixed(2)}s - ${shotIntervals[hailuoTargetShotIndex - 1]?.endTime.toFixed(2)}s`}
          durationSec={shotIntervals[hailuoTargetShotIndex - 1]?.duration || 4.5}
          prompt={compiledVideoPrompt?.englishPrompt || ''}
          keyframePath={keyframes[hailuoTargetShotIndex]?.path}
          characterName={activeCharacter?.name}
          onVideoGenerated={(shotIdx, videoUrl) => {
            setGeneratedVideos((prev) => ({ ...prev, [shotIdx]: videoUrl }));
          }}
        />
      )}

      {/* Master MV Playback and Download Modal */}
      {isMasterModalOpen && masterVideoUrl && (
        <MasterMvModal
          isOpen={isMasterModalOpen}
          onClose={() => setIsMasterModalOpen(false)}
          videoUrl={masterVideoUrl}
          trackTitle={trackTitle}
          artist={artist}
          onRebuild={handleBuildMasterMv}
          isRebuilding={isMasterBuilding}
        />
      )}
    </div>
  );
};
