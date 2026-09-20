import { useState, useCallback, useRef, useEffect } from 'react';
import {
  TimelinePoint,
  StrategyDecision,
  DiagnosticResolution,
  ShotDirectionDecision,
  ShotHistoryItem,
} from '../types/director';
import { createDirectorEngine, EngineType } from '../services/engine';
import { AnalyzedTrackData } from '../services/audio/AudioAnalyzer';

export type WorkflowStage =
  | 'IDLE'
  | 'PASS1_ANALYZING'
  | 'PASS1_DONE'
  | 'DIAGNOSTIC_ANALYZING'
  | 'PASS2_ANALYZING'
  | 'POINT_FINALIZED';

export interface ActiveTrackInfo {
  title: string;
  artist: string;
  bpm: number;
  duration: number;
  timeline: TimelinePoint[];
  waveform?: number[];
  audioUrl?: string;
  isCustomTrack: boolean;
}

export const EMPTY_TRACK: ActiveTrackInfo = {
  title: '楽曲未読み込み',
  artist: '音声ファイルをインポートしてください',
  bpm: 120,
  duration: 0,
  timeline: [],
  waveform: [],
  audioUrl: '',
  isCustomTrack: false,
};

export function useDirectorWorkflow() {
  const [engineType, setEngineType] = useState<EngineType>('jev');
  const engineRef = useRef(createDirectorEngine('jev'));

  const [activeTrack, setActiveTrack] = useState<ActiveTrackInfo>(EMPTY_TRACK);

  const timeline = activeTrack.timeline;
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [stage, setStage] = useState<WorkflowStage>('IDLE');

  const [pass1Decision, setPass1Decision] = useState<StrategyDecision | null>(null);
  const [diagnosticResolution, setDiagnosticResolution] = useState<DiagnosticResolution | null>(null);
  const [pass2Decision, setPass2Decision] = useState<ShotDirectionDecision | null>(null);

  const [history, setHistory] = useState<ShotHistoryItem[]>([]);
  const [isAutoDirecting, setIsAutoDirecting] = useState<boolean>(false);
  const historyRef = useRef<ShotHistoryItem[]>([]);
  historyRef.current = history;

  // Sync engine when engineType changes
  useEffect(() => {
    engineRef.current = createDirectorEngine(engineType);
  }, [engineType]);

  const currentPoint = timeline[currentIndex] || null;

  /**
   * Evaluates a timeline point at the specified index using current accumulated history
   */
  const evaluatePointAtIndex = useCallback(
    async (index: number, targetTimeline = timeline) => {
      if (index < 0 || index >= targetTimeline.length) return;
      const targetPoint = targetTimeline[index];
      const engine = engineRef.current;
      const currentHistory = historyRef.current;

      try {
        setStage('PASS1_ANALYZING');
        const p1 = await engine.selectStrategy(targetPoint.musicState, currentHistory);
        setPass1Decision(p1);
        setStage('PASS1_DONE');

        let effectiveStrategy = p1.strategy;
        let diagRes: DiagnosticResolution | undefined = undefined;

        // Diagnostic Pass if ambiguous / confidence < 0.30
        if (p1.requiresDiagnostic) {
          setStage('DIAGNOSTIC_ANALYZING');
          diagRes = await engine.diagnoseStrategy(targetPoint.musicState, currentHistory, p1);
          setDiagnosticResolution(diagRes);
          effectiveStrategy = diagRes.resolvedStrategy;
        } else {
          setDiagnosticResolution(null);
        }

        // Pass 2: Shot Direction
        setStage('PASS2_ANALYZING');
        const p2 = await engine.selectShotDirection(targetPoint.musicState, effectiveStrategy, currentHistory);
        setPass2Decision(p2);

        // Calculate delta duration
        const prevTime = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1].time : 0;
        const historyItem: ShotHistoryItem = {
          id: `shot-${targetPoint.id}-${Date.now()}`,
          time: targetPoint.time,
          duration: Math.max(0.1, +(targetPoint.time - prevTime).toFixed(2)),
          musicState: targetPoint.musicState,
          pass1: p1,
          diagnostic: diagRes,
          effectiveStrategy,
          pass2: p2,
        };

        setHistory((prev) => {
          const existingIdx = prev.findIndex((h) => Math.abs(h.time - targetPoint.time) < 0.05);
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = historyItem;
            return updated;
          }
          return [...prev, historyItem];
        });

        setStage('POINT_FINALIZED');
      } catch (err) {
        console.error('Director workflow error at index', index, err);
        setStage('IDLE');
      }
    },
    [timeline]
  );

  /**
   * Jump to a specific timeline point
   */
  const selectPoint = useCallback(
    (index: number) => {
      if (index < 0 || index >= timeline.length) return;
      setCurrentIndex(index);

      const targetPoint = timeline[index];
      const existing = historyRef.current.find((h) => Math.abs(h.time - targetPoint.time) < 0.05);
      if (existing) {
        setPass1Decision(existing.pass1);
        setDiagnosticResolution(existing.diagnostic || null);
        setPass2Decision(existing.pass2);
        setStage('POINT_FINALIZED');
      } else {
        // Automatically evaluate if not yet evaluated
        evaluatePointAtIndex(index);
      }
    },
    [timeline, evaluatePointAtIndex]
  );

  /**
   * Step to next point
   */
  const stepNext = useCallback(async () => {
    if (currentIndex + 1 < timeline.length) {
      selectPoint(currentIndex + 1);
    }
  }, [currentIndex, timeline.length, selectPoint]);

  /**
   * Auto Direct all points across the timeline sequentially
   */
  const autoDirectAll = useCallback(async () => {
    setIsAutoDirecting(true);
    for (let i = 0; i < timeline.length; i++) {
      setCurrentIndex(i);
      await evaluatePointAtIndex(i);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    setIsAutoDirecting(false);
  }, [timeline.length, evaluatePointAtIndex]);

  /**
   * Load custom analyzed track data
   */
  const loadCustomTrack = useCallback(
    (analyzed: AnalyzedTrackData) => {
      setHistory([]);
      setCurrentIndex(0);
      setPass1Decision(null);
      setDiagnosticResolution(null);
      setPass2Decision(null);
      setStage('IDLE');

      const newTrack: ActiveTrackInfo = {
        title: analyzed.title,
        artist: analyzed.artist,
        bpm: analyzed.bpm,
        duration: analyzed.duration,
        timeline: analyzed.timeline,
        waveform: analyzed.waveform,
        audioUrl: analyzed.audioUrl || '',
        isCustomTrack: true,
      };

      setActiveTrack(newTrack);

      setTimeout(() => {
        evaluatePointAtIndex(0, analyzed.timeline);
      }, 50);
    },
    [evaluatePointAtIndex]
  );

  /**
   * Reset track to empty state
   */
  const resetToPreset = useCallback(() => {
    setHistory([]);
    setCurrentIndex(0);
    setPass1Decision(null);
    setDiagnosticResolution(null);
    setPass2Decision(null);
    setStage('IDLE');
    setActiveTrack(EMPTY_TRACK);
  }, []);

  /**
   * Reset session back to beginning
   */
  const resetSession = useCallback(() => {
    setHistory([]);
    setCurrentIndex(0);
    setPass1Decision(null);
    setDiagnosticResolution(null);
    setPass2Decision(null);
    setStage('IDLE');
    if (timeline.length > 0) {
      setTimeout(() => {
        evaluatePointAtIndex(0);
      }, 50);
    }
  }, [evaluatePointAtIndex, timeline.length]);

  // Initial evaluation on mount only if track exists
  useEffect(() => {
    if (timeline.length > 0) {
      evaluatePointAtIndex(0);
    }
  }, [evaluatePointAtIndex, timeline.length]);

  return {
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
    evaluateCurrentPoint: () => evaluatePointAtIndex(currentIndex),
    stepNext,
    autoDirectAll,
    resetSession,
    loadCustomTrack,
    resetToPreset,
  };
}
