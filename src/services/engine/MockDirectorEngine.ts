import { DirectorEngine } from './DirectorEngine';
import { HardConstraintsService } from './HardConstraintsService';
import {
  MusicState,
  Strategy,
  StrategyDecision,
  DiagnosticResolution,
  ShotDirectionDecision,
  ShotHistoryItem,
  ShotDirection,
  ShotDirectionConfidence
} from '../../types/director';

export class MockDirectorEngine implements DirectorEngine {
  public readonly engineId = 'mock-director-engine';
  public readonly engineName = 'Mock Director Engine';
  public readonly description = 'Deterministic & heuristic rule-based engine modeling Dark Wings MV planning';

  private hardConstraints = new HardConstraintsService();

  /**
   * Director Pass 1:
   * Decides current strategy and calculates confidence score.
   */
  public async selectStrategy(
    state: MusicState,
    _history: ShotHistoryItem[]
  ): Promise<StrategyDecision> {
    // Artificial latency to simulate decision pipeline
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Specific deterministic handling for the Dark Wings benchmark points
    if (Math.abs(state.time - 17.64) < 0.2) {
      // 17.64s: Pre-drop ambiguous state
      return {
        strategy: 'CONTINUE_TENSION',
        probability: 0.44,
        confidence: 0.23, // < 0.30 -> Triggers Diagnostic Pass
        alternatives: [
          { strategy: 'IMPACT_HOLD', probability: 0.42 },
          { strategy: 'RELEASE', probability: 0.26 },
        ],
        requiresDiagnostic: true,
        status: 'DIAGNOSTIC_REQUIRED',
      };
    }

    if (Math.abs(state.time - 10.18) < 0.2) {
      return {
        strategy: 'INTENSIFY',
        probability: 0.65,
        confidence: 0.54,
        alternatives: [
          { strategy: 'CONTINUE_TENSION', probability: 0.22 },
          { strategy: 'RELEASE', probability: 0.14 },
        ],
        requiresDiagnostic: false,
        status: 'ACCEPTED',
      };
    }

    if (Math.abs(state.time - 14.23) < 0.2) {
      return {
        strategy: 'INTENSIFY',
        probability: 0.72,
        confidence: 0.65,
        alternatives: [
          { strategy: 'IMPACT_HOLD', probability: 0.18 },
          { strategy: 'CONTINUE_TENSION', probability: 0.10 },
        ],
        requiresDiagnostic: false,
        status: 'ACCEPTED',
      };
    }

    if (Math.abs(state.time - 20.20) < 0.2) {
      return {
        strategy: 'IMPACT_HOLD',
        probability: 0.82,
        confidence: 0.74,
        alternatives: [
          { strategy: 'RELEASE', probability: 0.12 },
          { strategy: 'INTENSIFY', probability: 0.06 },
        ],
        requiresDiagnostic: false,
        status: 'ACCEPTED',
      };
    }

    if (Math.abs(state.time - 24.80) < 0.2) {
      return {
        strategy: 'RELEASE',
        probability: 0.70,
        confidence: 0.60,
        alternatives: [
          { strategy: 'CONTINUE_TENSION', probability: 0.20 },
          { strategy: 'INTENSIFY', probability: 0.10 },
        ],
        requiresDiagnostic: false,
        status: 'ACCEPTED',
      };
    }

    // Heuristic inference for any arbitrary music state
    let strategy: Strategy = 'INTENSIFY';
    let probability = 0.55;
    let confidence = 0.52;

    if (state.energyTrend === 'rapidly_rising' || (state.energyTrend === 'rising' && state.energy < 0.7)) {
      strategy = 'INTENSIFY';
      probability = 0.65;
      confidence = 0.54;
    } else if (state.energy >= 0.7 && state.energyTrend === 'rising') {
      // Ambiguous transition to drop
      strategy = 'CONTINUE_TENSION';
      probability = 0.40;
      confidence = 0.25;
    } else if (state.energy >= 0.85 && state.onsetStrength >= 0.8) {
      strategy = 'IMPACT_HOLD';
      probability = 0.80;
      confidence = 0.75;
    } else if (state.energyTrend === 'falling') {
      strategy = 'RELEASE';
      probability = 0.72;
      confidence = 0.64;
    }

    const requiresDiagnostic = confidence < 0.30;
    const status = requiresDiagnostic
      ? 'DIAGNOSTIC_REQUIRED'
      : confidence >= 0.50
      ? 'ACCEPTED'
      : 'ACCEPTED_WITH_ALTERNATIVES';

    return {
      strategy,
      probability,
      confidence,
      alternatives: [
        { strategy: 'IMPACT_HOLD', probability: 0.25 },
        { strategy: 'RELEASE', probability: 0.20 },
      ],
      requiresDiagnostic,
      status,
    };
  }

  /**
   * Diagnostic Pass:
   * Evaluates impact_arrival, tension_should_continue, and release_is_appropriate.
   */
  public async diagnoseStrategy(
    state: MusicState,
    _history: ShotHistoryItem[],
    _pass1: StrategyDecision
  ): Promise<DiagnosticResolution> {
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Dark Wings 17.64s specified values:
    if (Math.abs(state.time - 17.64) < 0.2) {
      return {
        diagnostic: {
          impact_arrival: 0.38,
          tension_should_continue: 0.74,
          release_is_appropriate: 0.12,
        },
        resolvedStrategy: 'CONTINUE_TENSION',
        reasoning:
          'Tension continuation score (0.74) heavily dominates impact arrival (0.38). Drop hit has not yet resolved; maintaining visual tension.',
      };
    }

    // Dynamic heuristic evaluation
    const impact_arrival = state.energy > 0.85 && state.onsetStrength > 0.7 ? 0.85 : 0.30;
    const tension_should_continue = state.energyTrend === 'rising' ? 0.70 : 0.25;
    const release_is_appropriate = state.energyTrend === 'falling' ? 0.80 : 0.15;

    let resolvedStrategy: Strategy = 'CONTINUE_TENSION';
    let reasoning = 'Diagnostic evaluated tension maintenance as primary objective.';

    if (impact_arrival > tension_should_continue && impact_arrival > release_is_appropriate) {
      resolvedStrategy = 'IMPACT_HOLD';
      reasoning = 'Decisive musical impact detected. Committing to IMPACT_HOLD.';
    } else if (release_is_appropriate > tension_should_continue) {
      resolvedStrategy = 'RELEASE';
      reasoning = 'Harmonic and rhythmic relaxation confirmed. Resolving to RELEASE.';
    }

    return {
      diagnostic: {
        impact_arrival,
        tension_should_continue,
        release_is_appropriate,
      },
      resolvedStrategy,
      reasoning,
    };
  }

  /**
   * Director Pass 2:
   * Determines concrete shot direction from resolved strategy and music dynamics.
   */
  public async selectShotDirection(
    state: MusicState,
    strategy: Strategy,
    history: ShotHistoryItem[]
  ): Promise<ShotDirectionDecision> {
    await new Promise((resolve) => setTimeout(resolve, 150));

    let raw: ShotDirection;
    let confidences: ShotDirectionConfidence;

    // Deterministic matching for the Dark Wings PoC benchmark points
    if (Math.abs(state.time - 10.18) < 0.2) {
      raw = {
        cut_now: true,
        shot_scale: 'CLOSE',
        camera_motion: 'PUSH_IN',
        character_motion: 'STEP_FORWARD',
        lighting_change: 'DARKEN',
        transition_type: 'HARD_CUT',
      };
      confidences = {
        shot_scale: 0.85,
        camera_motion: 0.78,
        character_motion: 0.72,
        lighting_change: 0.80,
        cut: 0.90,
      };
    } else if (Math.abs(state.time - 14.23) < 0.2) {
      raw = {
        cut_now: true,
        shot_scale: 'MEDIUM',
        camera_motion: 'PUSH_IN',
        character_motion: 'STEP_FORWARD',
        lighting_change: 'DARKEN',
        transition_type: 'HARD_CUT',
      };
      confidences = {
        shot_scale: 0.88,
        camera_motion: 0.82,
        character_motion: 0.75,
        lighting_change: 0.78,
        cut: 0.92,
      };
    } else if (Math.abs(state.time - 17.64) < 0.2) {
      // Specified shot: MEDIUM, PUSH_IN, STILL, HOLD (No cut, holding the tension)
      raw = {
        cut_now: false,
        shot_scale: 'MEDIUM',
        camera_motion: 'PUSH_IN',
        character_motion: 'STILL',
        lighting_change: 'HOLD',
        transition_type: 'NONE',
      };
      confidences = {
        shot_scale: 0.80,
        camera_motion: 0.75,
        character_motion: 0.85,
        lighting_change: 0.90,
        cut: 0.82,
      };
    } else if (Math.abs(state.time - 20.20) < 0.2) {
      raw = {
        cut_now: true,
        shot_scale: 'WIDE',
        camera_motion: 'STATIC',
        character_motion: 'GESTURE',
        lighting_change: 'PULSE',
        transition_type: 'FLASH_CUT',
      };
      confidences = {
        shot_scale: 0.92,
        camera_motion: 0.88,
        character_motion: 0.80,
        lighting_change: 0.95,
        cut: 0.98,
      };
    } else if (Math.abs(state.time - 24.80) < 0.2) {
      raw = {
        cut_now: true,
        shot_scale: 'EXTREME_WIDE',
        camera_motion: 'PULL_BACK',
        character_motion: 'STILL',
        lighting_change: 'BRIGHTEN',
        transition_type: 'DISSOLVE',
      };
      confidences = {
        shot_scale: 0.84,
        camera_motion: 0.76,
        character_motion: 0.70,
        lighting_change: 0.82,
        cut: 0.88,
      };
    } else {
      // General heuristic based on strategy
      switch (strategy) {
        case 'INTENSIFY':
          raw = {
            cut_now: history.length === 0 || (history[history.length - 1].time + 3.0 <= state.time),
            shot_scale: 'CLOSE',
            camera_motion: 'PUSH_IN',
            character_motion: 'STEP_FORWARD',
            lighting_change: 'DARKEN',
            transition_type: 'HARD_CUT',
          };
          confidences = { shot_scale: 0.7, camera_motion: 0.65, character_motion: 0.6, lighting_change: 0.7, cut: 0.75 };
          break;
        case 'CONTINUE_TENSION':
          raw = {
            cut_now: false,
            shot_scale: 'MEDIUM',
            camera_motion: 'PUSH_IN',
            character_motion: 'STILL',
            lighting_change: 'HOLD',
            transition_type: 'NONE',
          };
          confidences = { shot_scale: 0.75, camera_motion: 0.7, character_motion: 0.8, lighting_change: 0.85, cut: 0.8 };
          break;
        case 'IMPACT_HOLD':
          raw = {
            cut_now: true,
            shot_scale: 'WIDE',
            camera_motion: 'STATIC',
            character_motion: 'GESTURE',
            lighting_change: 'PULSE',
            transition_type: 'FLASH_CUT',
          };
          confidences = { shot_scale: 0.9, camera_motion: 0.85, character_motion: 0.8, lighting_change: 0.9, cut: 0.95 };
          break;
        case 'RELEASE':
        default:
          raw = {
            cut_now: true,
            shot_scale: 'EXTREME_WIDE',
            camera_motion: 'PULL_BACK',
            character_motion: 'STILL',
            lighting_change: 'BRIGHTEN',
            transition_type: 'DISSOLVE',
          };
          confidences = { shot_scale: 0.8, camera_motion: 0.75, character_motion: 0.7, lighting_change: 0.8, cut: 0.85 };
          break;
      }
    }

    // Pass through Hard Constraints Engine
    return this.hardConstraints.evaluate(raw, confidences, state, history);
  }
}
