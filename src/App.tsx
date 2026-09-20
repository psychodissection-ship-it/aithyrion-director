import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDirectorWorkflow } from './hooks/useDirectorWorkflow';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { Header, AppMode } from './components/Header';
import { MusicTimeline } from './components/MusicTimeline';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AudioDropzone } from './components/AudioDropzone';
import { MusicStateCard } from './components/MusicStateCard';
import { DirectorDecisionCard } from './components/DirectorDecisionCard';
import { ShotDirectionCard } from './components/ShotDirectionCard';
import { HistoryList } from './components/HistoryList';
import { ShotTimelineVisualizer, StoryboardKeyframeInfo, BatchGenerationProgress } from './components/ShotTimelineVisualizer';
import { CompareEnginesView } from './components/CompareEnginesView';
import { BenchmarkComparisonView } from './components/BenchmarkComparisonView';
import { AntiFixtureValidatorView } from './components/AntiFixtureValidatorView';
import { JevInspectorModal } from './components/JevInspectorModal';
import { KeyframeJobModal } from './components/codex/KeyframeJobModal';
import { KeyframeReviewModal } from './components/codex/KeyframeReviewModal';
import { ReferenceManagerModal } from './components/codex/ReferenceManagerModal';
import { StoryboardReelModal } from './components/codex/StoryboardReelModal';
import { MVConceptAnalysisModal } from './components/director/MVConceptAnalysisModal';
import { mvConceptService, MVConcept } from './services/director/MVConceptService';
import { AlertCircle, Terminal, AlertOctagon, Sparkles, Compass, Music2, Upload } from 'lucide-react';
import { createDirectorEngine, JevDirectorEngine } from './services/engine';
import { JevHealthStatus } from './types/director';
import { KeyframeJob, CodexCliStatus, CharacterProfile } from './types/codexBridge';
import { codexBridgeService } from './services/codex/CodexBridgeService';
import { continuityManager } from './services/codex/ContinuityManager';
import { mvMasterService } from './services/video/MvMasterService';
import { hailuoVideoService } from './services/video/HailuoVideoService';

export const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('STUDIO');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isDropzoneOpen, setIsDropzoneOpen] = useState<boolean>(false);
  const [jevHealth, setJevHealth] = useState<JevHealthStatus | null>(null);

  // Codex Bridge States
  const [codexStatus, setCodexStatus] = useState<CodexCliStatus | null>(null);
  const [keyframeJobs, setKeyframeJobs] = useState<Record<number, KeyframeJob>>({});
  const [activeJob, setActiveJob] = useState<KeyframeJob | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState<boolean>(false);
  const [isReelModalOpen, setIsReelModalOpen] = useState<boolean>(false);
  const [activeCharacter, setActiveCharacter] = useState<CharacterProfile>(continuityManager.getActiveCharacter());
  const [batchProgress, setBatchProgress] = useState<BatchGenerationProgress | null>(null);

  const {
    engineType,
    setEngineType,
    activeTrack,
    timeline,
    currentIndex,
    currentPoint,
    stage,
    pass1Decision,
    diagnosticResolution,
    pass2Decision,
    history,
    isAutoDirecting,
    selectPoint,
    evaluateCurrentPoint,
    stepNext,
    autoDirectAll,
    resetSession,
    loadCustomTrack,
    resetToPreset,
  } = useDirectorWorkflow();

  const audioPlayer = useAudioPlayer();

  const [isConceptModalOpen, setIsConceptModalOpen] = useState<boolean>(false);
  const [activeMVConcept, setActiveMVConcept] = useState<MVConcept | null>(null);

  const isEvaluating = stage.includes('ANALYZING');
  const canStepNext = currentIndex + 1 < timeline.length;
  const currentEngine = createDirectorEngine(engineType);
  const jevEngineInstance = useMemo(() => new JevDirectorEngine(), []);

  const refreshJevHealth = useCallback(async () => {
    try {
      const h = await jevEngineInstance.checkHealth();
      setJevHealth(h);
    } catch {
      setJevHealth({
        configured: false,
        mode: 'ERROR',
        endpointConfigured: false,
        apiKeyConfigured: false,
      });
    }
  }, [jevEngineInstance]);

  const checkCodexCliStatus = useCallback(async () => {
    const status = await codexBridgeService.checkCliStatus();
    setCodexStatus(status);
  }, []);

  // Query JEV and Codex status on mount and when engineType changes
  useEffect(() => {
    refreshJevHealth();
    checkCodexCliStatus();
  }, [refreshJevHealth, checkCodexCliStatus, engineType]);

  // Spacebar shortcut to toggle audio playback in Studio mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextInput =
        (target instanceof HTMLInputElement &&
          target.type !== 'range' &&
          target.type !== 'checkbox' &&
          target.type !== 'radio') ||
        target instanceof HTMLTextAreaElement;
      const isInteractiveElement =
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement ||
        target.closest?.('button, a, [role="button"]') != null;

      if (isTextInput || isInteractiveElement) return;

      if (
        (e.code === 'Space' || e.key === ' ') &&
        !isDropzoneOpen &&
        !isInspectorOpen &&
        !isJobModalOpen &&
        !isReviewModalOpen &&
        !isReferenceModalOpen &&
        appMode === 'STUDIO'
      ) {
        e.preventDefault();
        audioPlayer.togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isDropzoneOpen,
    isInspectorOpen,
    isJobModalOpen,
    isReviewModalOpen,
    isReferenceModalOpen,
    appMode,
    audioPlayer,
  ]);

  const handleResetPreset = () => {
    resetToPreset();
    audioPlayer.clearAudio();
    continuityManager.reset();
    mvMasterService.resetProject();
    hailuoVideoService.resetVideos();
    setKeyframeJobs({});
    setActiveJob(null);
    setActiveMVConcept(null);
  };

  // Prepare Codex Job for Current Shot
  const handlePrepareCodexJob = async () => {
    if (!pass2Decision || !currentPoint) return;
    const shotIndex = currentIndex + 1;
    const nextPoint = timeline[currentIndex + 1];
    const endSec = nextPoint
      ? nextPoint.time
      : Math.min(activeTrack.duration, +(currentPoint.time + 4.5).toFixed(2));

    const job = await codexBridgeService.prepareJob({
      trackId: activeTrack.title.toLowerCase().replace(/\s+/g, '-'),
      shotIndex,
      startSec: currentPoint.time,
      endSec,
      pass1: pass1Decision!,
      pass2: pass2Decision,
      effectiveStrategy: diagnosticResolution
        ? diagnosticResolution.resolvedStrategy
        : pass1Decision!.strategy,
    });

    setKeyframeJobs((prev) => ({ ...prev, [shotIndex]: job }));
    setActiveJob(job);
    setIsJobModalOpen(true);
  };

  const handleOpenReviewForCurrent = () => {
    const shotIndex = currentIndex + 1;
    let job = keyframeJobs[shotIndex];
    if (!job && pass2Decision && currentPoint) {
      // Auto-prepare if not yet created
      handlePrepareCodexJob();
      return;
    }
    if (job) {
      setActiveJob(job);
      setIsReviewModalOpen(true);
    }
  };

  const handleJobUpdated = (updatedJob: KeyframeJob) => {
    setKeyframeJobs((prev) => ({ ...prev, [updatedJob.timeline.shot_index]: updatedJob }));
    setActiveJob(updatedJob);
  };

  // Tracking which shots are actively generating via Codex
  const [generatingShots, setGeneratingShots] = useState<Record<number, boolean>>({});
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);

  /**
   * One-click Codex Keyframe Generation for a specific shot
   */
  const generateKeyframeForShot = async (shotIndex: number) => {
    const sorted = [...history].sort((a, b) => a.time - b.time);
    const item = sorted[shotIndex - 1];
    if (!item) return;

    setGeneratingShots((prev) => ({ ...prev, [shotIndex]: true }));

    try {
      const nextItem = sorted[shotIndex];
      const totalDur = audioPlayer.duration || activeTrack.duration || 32.0;
      const endSec = nextItem ? nextItem.time : Math.min(totalDur, +(item.time + 4.5).toFixed(2));
      const trackId = (activeTrack as any).id || activeTrack.title.toLowerCase().replace(/\s+/g, '-') || 'custom-track';

      const job = await codexBridgeService.prepareJob({
        trackId,
        shotIndex,
        startSec: item.time,
        endSec,
        pass1: item.pass1,
        pass2: item.pass2,
        effectiveStrategy: item.effectiveStrategy,
      });

      const keyframePath = await codexBridgeService.generateKeyframeViaCodex(job);

      const updatedJob: KeyframeJob = {
        ...job,
        status: 'APPROVED',
        output: { ...job.output, actual_path: keyframePath },
      };
      handleJobUpdated(updatedJob);
    } catch (err) {
      console.error(`Failed to generate keyframe for shot #${shotIndex}:`, err);
    } finally {
      setGeneratingShots((prev) => ({ ...prev, [shotIndex]: false }));
    }
  };

  /**
   * Batch generate all shots sequentially via Codex
   */
  const generateAllKeyframes = async () => {
    setIsBatchGenerating(true);
    const sorted = [...history].sort((a, b) => a.time - b.time);
    const total = sorted.length;
    const charName = activeCharacter?.name || 'Character';

    for (let i = 1; i <= total; i++) {
      const item = sorted[i - 1];
      setBatchProgress({
        currentShot: i,
        totalShots: total,
        shotTime: item.time,
        characterName: charName,
        strategy: item.effectiveStrategy,
      });
      await generateKeyframeForShot(i);
    }
    setIsBatchGenerating(false);
    setBatchProgress(null);
    setIsReelModalOpen(true);
  };

  // Storyboard Keyframes Map
  const storyboardKeyframes = useMemo(() => {
    const map: Record<number, StoryboardKeyframeInfo> = {};
    const contState = continuityManager.getState();
    contState.shot_sequence.forEach((s) => {
      map[s.shot_index] = {
        path: s.keyframe_path,
        status: 'APPROVED',
      };
    });
    Object.values(keyframeJobs).forEach((job) => {
      if (!map[job.timeline.shot_index] || map[job.timeline.shot_index].status !== 'APPROVED') {
        map[job.timeline.shot_index] = {
          path: job.output.actual_path,
          status:
            job.status === 'APPROVED'
              ? 'APPROVED'
              : job.output.actual_path
              ? 'REVIEW'
              : 'NO_KEYFRAME',
        };
      }
    });
    return map;
  }, [keyframeJobs]);

  const currentJobForSelectedShot = keyframeJobs[currentIndex + 1] || null;
  const isJevUnconfigured = engineType === 'jev' && jevHealth?.mode === 'NOT_CONFIGURED';

  return (
    <div className="min-h-screen bg-surface-900 text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white font-mono">
      {/* App Header & Mode Switcher */}
      <Header
        appMode={appMode}
        onModeChange={setAppMode}
        engineType={engineType}
        onEngineChange={setEngineType}
        jevHealth={jevHealth}
        codexStatus={codexStatus}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onOpenReferences={() => setIsReferenceModalOpen(true)}
        onEvaluate={evaluateCurrentPoint}
        onStepNext={stepNext}
        onAutoDirect={autoDirectAll}
        onReset={resetSession}
        isEvaluating={isEvaluating}
        isAutoDirecting={isAutoDirecting}
        canStepNext={canStepNext}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 max-w-[1700px] w-full mx-auto space-y-5">
        {/* Fail-Closed Banner if Live JEV unconfigured */}
        {isJevUnconfigured && (
          <div className="bg-rose-950/40 border border-rose-600/60 p-4 rounded-xl flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center space-x-3">
              <AlertOctagon className="w-5 h-5 text-rose-400 flex-shrink-0 animate-pulse" />
              <div>
                <span className="font-bold text-sm tracking-wide">
                  LIVE JEV NOT CONFIGURED (FAIL-CLOSED)
                </span>
                <p className="text-slate-400 mt-0.5 text-[11px]">
                  JevDirectorEngine is in Live Remote mode. Silent fallback to simulation is
                  prohibited. Configure JEV_API_ENDPOINT and JEV_API_KEY in server environment (.env)
                  to execute.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODE 1: DIRECTOR STUDIO */}
        {appMode === 'STUDIO' && (
          <>
            {/* Audio Player Transport & Waveform Bar */}
            <AudioPlayerBar
              isPlaying={audioPlayer.isPlaying}
              currentTime={audioPlayer.currentTime}
              duration={audioPlayer.duration || activeTrack.duration}
              volume={audioPlayer.volume}
              trackTitle={activeTrack.title}
              artist={activeTrack.artist}
              bpm={activeTrack.bpm}
              waveform={activeTrack.waveform}
              cuePoints={timeline}
              onTogglePlay={audioPlayer.togglePlay}
              onSeek={audioPlayer.seek}
              onSetVolume={audioPlayer.setVolume}
              onOpenUpload={() => setIsDropzoneOpen(true)}
              isCustomTrack={activeTrack.isCustomTrack}
              onResetPreset={handleResetPreset}
            />

            {/* AntiGravity Active MV Concept & Direction Banner */}
            {activeMVConcept && (
              <div className="bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-surface-850 border border-indigo-500/40 rounded-xl p-3 sm:p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
                <div className="flex items-start space-x-3 min-w-0">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex-shrink-0 mt-0.5 shadow-inner">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-500/50">
                        {activeMVConcept.genre}
                      </span>
                      <h3 className="text-sm font-bold text-white tracking-wide">
                        {activeMVConcept.title}
                      </h3>
                      <span className="text-xs text-slate-400 italic hidden lg:inline">
                        ({activeMVConcept.englishTitle})
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-1">
                      <strong className="text-indigo-300">舞台設定:</strong> {activeMVConcept.stageSetting}
                    </p>
                    <div className="flex items-center space-x-2 pt-0.5 text-[10.5px] text-slate-400 flex-wrap">
                      <span className="text-slate-400">カラースキーム:</span>
                      <div className="flex items-center space-x-1">
                        {activeMVConcept.colorPalette.map((col, idx) => (
                          <span
                            key={idx}
                            className="w-3 h-3 rounded-full border border-white/20 inline-block"
                            style={{ backgroundColor: col }}
                            title={col}
                          />
                        ))}
                      </div>
                      <span>&bull;</span>
                      <span className="truncate max-w-[320px]">演出トーン: {activeMVConcept.moodTone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0 self-end md:self-center">
                  <button
                    onClick={() => setIsConceptModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center space-x-1.5 shadow transition active:scale-95"
                    title="AntiGravityによるMV演出コンセプトの再解析・変更"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AntiGravityで演出コンセプトを変更</span>
                  </button>
                </div>
              </div>
            )}

            {/* Empty State / Welcome Banner if no track is loaded */}
            {timeline.length === 0 ? (
              <div className="bg-surface-850/80 border border-dashed border-surface-700/80 rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4 my-6">
                <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Music2 className="w-10 h-10 animate-pulse" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    楽曲ファイルをインポートしてください
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    WAVやMP3音声ファイルをインポートすると、ビート・エネルギー・オンセットがDSP解析され、JEV AIによるカット割りとカメラワーク演出が可能になります。
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setIsDropzoneOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2 active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>音声ファイルをインポート</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Quick Jumps Bar */}
                <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center space-x-2 text-slate-400">
                    {activeTrack.isCustomTrack ? (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300 font-semibold">Analyzed Track Cues:</span>
                        <span className="text-slate-500">
                          Jump directly to DSP-extracted inflection points:
                        </span>
                      </>
                    ) : (
                      <>
                        <Terminal className="w-4 h-4 text-indigo-400" />
                        <span className="text-slate-300 font-semibold">Benchmark Scenarios:</span>
                        <span className="text-slate-500">
                          Jump directly to specified benchmark cues:
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {timeline.map((pt, idx) => (
                      <button
                        key={pt.id}
                        onClick={() => selectPoint(idx)}
                        className={`px-2.5 py-1 rounded border transition flex items-center gap-1.5 ${
                          currentIndex === idx
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-surface-800 text-slate-300 border-surface-700 hover:border-slate-500'
                        }`}
                      >
                        <span>
                          {pt.time.toFixed(2)}s ({pt.musicState.section || `P${idx + 1}`})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

            {/* 1. Music Timeline Component */}
            <MusicTimeline
              timeline={timeline}
              currentIndex={currentIndex}
              history={history}
              trackTitle={activeTrack.title}
              artist={activeTrack.artist}
              bpm={activeTrack.bpm}
              onSelectPoint={selectPoint}
              isCustomTrack={activeTrack.isCustomTrack}
              onOpenUpload={() => setIsDropzoneOpen(true)}
              onResetPreset={handleResetPreset}
              currentTime={audioPlayer.currentTime}
              duration={audioPlayer.duration || activeTrack.duration}
            />

            {/* Core Decision Engine Grid: 3 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: 2. Current Music State (3 Cols) */}
              <div className="lg:col-span-3 flex flex-col">
                <MusicStateCard
                  state={currentPoint.musicState}
                  pointDescription={currentPoint.description}
                />
              </div>

              {/* Middle Column: 3. Director Decision & 4. Shot Direction (6 Cols) */}
              <div className="lg:col-span-6 flex flex-col space-y-5">
                <DirectorDecisionCard
                  decision={pass1Decision}
                  diagnostic={diagnosticResolution}
                  isEvaluating={isEvaluating}
                />

                <ShotDirectionCard
                  decision={pass2Decision}
                  isEvaluating={isEvaluating}
                  currentJob={currentJobForSelectedShot}
                  onPrepareJob={handlePrepareCodexJob}
                  onOpenJobModal={() => {
                    setActiveJob(currentJobForSelectedShot);
                    setIsJobModalOpen(true);
                  }}
                  onOpenReviewModal={handleOpenReviewForCurrent}
                />
              </div>

              {/* Right Column: 5. History (3 Cols) */}
              <div className="lg:col-span-3 flex flex-col">
                <HistoryList
                  history={history}
                  selectedTime={currentPoint?.time}
                  onSelectHistoryItem={(item) => {
                    const targetIdx = timeline.findIndex(
                      (p) => Math.abs(p.time - item.time) < 0.05
                    );
                    if (targetIdx !== -1) {
                      selectPoint(targetIdx);
                    }
                  }}
                />
              </div>
            </div>

            {/* 6. Shot Timeline & Storyboard Visualizer */}
            <ShotTimelineVisualizer
              history={history}
              totalDuration={audioPlayer.duration || activeTrack.duration}
              activeCharacter={activeCharacter}
              activeMVConcept={activeMVConcept}
              keyframes={storyboardKeyframes}
              generatingShots={generatingShots}
              isBatchGenerating={isBatchGenerating}
              batchProgress={batchProgress}
              onGenerateKeyframe={generateKeyframeForShot}
              onGenerateAllKeyframes={generateAllKeyframes}
              onOpenReelModal={() => setIsReelModalOpen(true)}
              onSelectShot={(time) => {
                const targetIdx = timeline.findIndex((p) => Math.abs(p.time - time) < 0.05);
                if (targetIdx !== -1) {
                  selectPoint(targetIdx);
                }
              }}
            />
            </>
            )}
          </>
        )}

        {/* VIEW MODE 2: COMPARE ENGINES (SIDE-BY-SIDE) */}
        {appMode === 'COMPARE' && <CompareEnginesView />}

        {/* VIEW MODE 3: BENCHMARK VALIDATOR (EXPECTED VS ACTUAL VS DIFF) */}
        {appMode === 'BENCHMARK' && (
          <BenchmarkComparisonView
            engine={currentEngine}
            engineName={currentEngine.engineName}
          />
        )}

        {/* VIEW MODE 4: ANTI-FIXTURE VALIDATOR (ENERGY MODULATION SUITE) */}
        {appMode === 'ANTI_FIXTURE' && (
          <AntiFixtureValidatorView jevEngine={jevEngineInstance} />
        )}

        {/* Footer Info & Architecture Principle */}
        <footer className="border-t border-surface-800/80 pt-4 pb-6 text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Phase 5 Codex Keyframe Bridge: Separation of Director & Image Worker &bull; Human-in-the-Loop Continuity &bull; Traceability
            </span>
          </div>

          <div className="flex items-center space-x-3 text-slate-400">
            <span className="text-indigo-400 font-semibold">
              Bridge: {codexStatus?.mode || 'MANUAL_HANDOFF'}
            </span>
            <span>&bull;</span>
            <span className="text-emerald-400 font-semibold">
              JEV: {jevHealth?.mode || 'LIVE_REMOTE'}
            </span>
          </div>
        </footer>
      </main>

      {/* Audio File Dropzone Modal */}
      <AudioDropzone
        isOpen={isDropzoneOpen}
        onClose={() => setIsDropzoneOpen(false)}
        onTrackAnalyzed={async (track, file, character) => {
          if (character) {
            continuityManager.setActiveCharacterProfile(character);
            setActiveCharacter(character);
          }

          // 1. Reset all prior shot sequence & old generated videos
          continuityManager.reset();
          await mvMasterService.resetProject();
          await hailuoVideoService.resetVideos();

          // 2. Upload audio to server for master MV ffmpeg rendering
          let serverAudioUrl = '';
          try {
            const uploadRes = await mvMasterService.uploadAudioFile(file);
            serverAudioUrl = uploadRes.publicUrl;
          } catch (err) {
            console.warn('Audio upload warning:', err);
          }

          // 3. Load track into workflow with server audio url
          const trackWithAudio: any = {
            ...track,
            audioUrl: serverAudioUrl || '',
          };
          loadCustomTrack(trackWithAudio);
          audioPlayer.loadAudioFile(file);
          setKeyframeJobs({});
          setActiveJob(null);

          // 4. Immediately generate fresh MV Concept for THIS imported track
          const newConceptResult = mvConceptService.analyzeAndGenerateConcepts({
            trackTitle: track.title,
            bpm: track.bpm,
            duration: track.duration,
            character: character || continuityManager.getActiveCharacter(),
          });
          const initialConcept = newConceptResult.concepts[0] || null;
          setActiveMVConcept(initialConcept);

          // 5. Open AntiGravity MV Concept Analysis Phase for customization
          setIsConceptModalOpen(true);
        }}
      />

      {/* Developer Raw Request / Response Inspector Modal */}
      <JevInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        jevEngine={jevEngineInstance}
      />

      {/* Codex Keyframe Job Spec Modal */}
      <KeyframeJobModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        job={activeJob}
        cliStatus={codexStatus}
        onOpenReview={() => setIsReviewModalOpen(true)}
      />

      {/* Codex Keyframe Review & Approval Modal */}
      <KeyframeReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        job={activeJob}
        onJobUpdated={handleJobUpdated}
      />

      {/* Character & Scene Reference Manager Modal */}
      <ReferenceManagerModal
        isOpen={isReferenceModalOpen}
        onClose={() => setIsReferenceModalOpen(false)}
        onCharacterChanged={(char) => setActiveCharacter(char)}
      />

      {/* Storyboard Reel & Narrative Sequence Modal */}
      <StoryboardReelModal
        isOpen={isReelModalOpen}
        onClose={() => setIsReelModalOpen(false)}
        history={history}
        keyframes={storyboardKeyframes}
        totalDuration={audioPlayer.duration || activeTrack.duration}
        activeCharacter={activeCharacter}
        activeMVConcept={activeMVConcept}
        trackTitle={activeTrack.title}
        artist={activeTrack.artist}
        audioPlayer={audioPlayer}
        onRegenerateShot={generateKeyframeForShot}
      />

      {/* AntiGravity AI Director: MV Concept & Direction Analysis Phase Modal */}
      <MVConceptAnalysisModal
        isOpen={isConceptModalOpen}
        onClose={() => setIsConceptModalOpen(false)}
        trackTitle={activeTrack.title}
        bpm={activeTrack.bpm}
        duration={audioPlayer.duration || activeTrack.duration}
        character={activeCharacter}
        currentConcept={activeMVConcept}
        onConceptApplied={(concept) => {
          setActiveMVConcept(concept);
        }}
      />
    </div>
  );
};

export default App;
