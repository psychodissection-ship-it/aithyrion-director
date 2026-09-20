export type Strategy = 'INTENSIFY' | 'RELEASE' | 'IMPACT_HOLD' | 'CONTINUE_TENSION';

export type EnergyTrend = 'rising' | 'rapidly_rising' | 'falling' | 'stable' | 'plateau';

export interface MusicState {
  time: number; // in seconds
  energy: number; // 0.0 to 1.0
  energyTrend: EnergyTrend;
  onsetStrength: number; // 0.0 to 1.0
  nextMajorChange: number; // seconds to next major shift
  bpm?: number;
  section?: string;
}

export interface StrategyProbability {
  strategy: Strategy;
  probability: number;
}

export interface StrategyDecision {
  strategy: Strategy;
  probability: number;
  confidence: number;
  alternatives: StrategyProbability[];
  requiresDiagnostic: boolean;
  status: 'ACCEPTED' | 'ACCEPTED_WITH_ALTERNATIVES' | 'DIAGNOSTIC_REQUIRED';
}

export interface DiagnosticResult {
  impact_arrival: number;
  tension_should_continue: number;
  release_is_appropriate: number;
}

export interface DiagnosticResolution {
  diagnostic: DiagnosticResult;
  resolvedStrategy: Strategy;
  reasoning: string;
}

export type ShotScale = 'CLOSE' | 'MEDIUM' | 'WIDE' | 'EXTREME_WIDE';
export type CameraMotion = 'STATIC' | 'PUSH_IN' | 'PULL_BACK' | 'PAN' | 'ORBIT';
export type CharacterMotion = 'STILL' | 'LOOK' | 'TURN' | 'STEP_FORWARD' | 'GESTURE';
export type LightingChange = 'HOLD' | 'BRIGHTEN' | 'DARKEN' | 'PULSE' | 'COLOR_SHIFT';
export type TransitionType = 'HARD_CUT' | 'MATCH_CUT' | 'DISSOLVE' | 'FLASH_CUT' | 'NONE';

/**
 * Cut Decision Taxonomy:
 * - SOFT_CUT: Decided by Director based on musical phrasing/accents.
 * - HARD_FORCE_CUT: Enforced by rule engine (e.g. shot duration exceeded max 8.0s).
 * - CUT_SUPPRESSED: Suppressed by rule engine (e.g. shot duration under min 2.0s).
 * - NO_CUT: Director held current shot without cut.
 */
export type CutDecisionType = 'SOFT_CUT' | 'HARD_FORCE_CUT' | 'CUT_SUPPRESSED' | 'NO_CUT';

export interface ShotDirection {
  cut_now: boolean;
  cut_type?: CutDecisionType;
  shot_scale: ShotScale;
  camera_motion: CameraMotion;
  character_motion: CharacterMotion;
  lighting_change: LightingChange;
  transition_type: TransitionType;
}

export interface ShotDirectionConfidence {
  shot_scale: number;
  camera_motion: number;
  character_motion: number;
  lighting_change: number;
  cut: number;
}

export interface ShotDirectionDecision {
  raw: ShotDirection;
  confidences: ShotDirectionConfidence;
  final: ShotDirection;
  cutDecisionType: CutDecisionType;
  appliedConstraints: string[];
}

export interface ShotHistoryItem {
  id: string;
  time: number;
  duration: number;
  musicState: MusicState;
  pass1: StrategyDecision;
  diagnostic?: DiagnosticResolution;
  effectiveStrategy: Strategy;
  pass2: ShotDirectionDecision;
  engineId?: string;
}

export interface TimelinePoint {
  id: string;
  time: number;
  musicState: MusicState;
  expectedStrategy?: Strategy;
  description?: string;
}

/**
 * JEV Engine Operational States
 */
export type JevEngineMode = 'LIVE_REMOTE' | 'LOCAL_GEMMA' | 'SIMULATED' | 'NOT_CONFIGURED' | 'ERROR';

export interface LocalGemmaStatus {
  ollamaOnline: boolean;
  gemmaAvailable: boolean;
  modelName?: string;
  availableModels: string[];
  ollamaVersion?: string;
}

export interface JevHealthStatus {
  configured: boolean;
  mode: JevEngineMode;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  endpointUrl?: string;
  gemmaStatus?: LocalGemmaStatus;
}

export interface JevInspectorTelemetry {
  timestamp: string;
  endpoint: string;
  mode: JevEngineMode;
  requestState: MusicState;
  requestQuestions: string[];
  response: {
    selected_option: string;
    probabilities: Record<string, number>;
    confidence: number;
    alternatives: StrategyProbability[];
    diagnostic?: DiagnosticResult;
  };
  latencyMs: number;
}

export interface AntiFixtureTestRun {
  energy: number;
  label: string;
  state: MusicState;
  response: StrategyDecision;
  resolvedStrategy: string;
  diagnostic?: DiagnosticResolution;
  latencyMs: number;
}

/**
 * Benchmark Fixtures and Diffing Models
 */
export interface BenchmarkExpectedOutput {
  strategy: Strategy;
  probability: number;
  confidence: number;
  alternatives: StrategyProbability[];
  diagnostic?: DiagnosticResult;
  resolvedStrategy?: Strategy;
  shot: {
    shot_scale: ShotScale;
    camera_motion: CameraMotion;
    character_motion: CharacterMotion;
    lighting_change: LightingChange;
    cutDecisionType: CutDecisionType;
    transition_type: TransitionType;
  };
}

export interface BenchmarkFixture {
  id: string;
  cueTime: number;
  label: string;
  musicState: MusicState;
  expected: BenchmarkExpectedOutput;
  notes?: string;
}

export interface BenchmarkFieldDiff<T> {
  field: string;
  expected: T;
  actual: T;
  matched: boolean;
  notes?: string;
}

export interface BenchmarkComparisonResult {
  fixture: BenchmarkFixture;
  actualStrategy?: StrategyDecision;
  actualDiagnostic?: DiagnosticResolution;
  actualShot?: ShotDirectionDecision;
  strategyMatched: boolean;
  confidenceDelta: number;
  shotMatched: boolean;
  cutMatched: boolean;
  diagnosticMatched?: boolean;
  diffs: BenchmarkFieldDiff<any>[];
}
