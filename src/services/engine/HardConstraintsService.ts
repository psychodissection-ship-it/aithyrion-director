import {
  ShotDirection,
  ShotDirectionConfidence,
  ShotDirectionDecision,
  ShotHistoryItem,
  MusicState,
  CutDecisionType,
} from '../../types/director';

export interface HardConstraintsConfig {
  minShotDurationSec: number;
  maxShotDurationSec: number;
  lowConfidenceThreshold: number;
}

export const DEFAULT_HARD_CONSTRAINTS: HardConstraintsConfig = {
  minShotDurationSec: 2.0,
  maxShotDurationSec: 8.0,
  lowConfidenceThreshold: 0.4,
};

export class HardConstraintsService {
  constructor(private config: HardConstraintsConfig = DEFAULT_HARD_CONSTRAINTS) {}

  /**
   * Applies hard video editing constraints and low-confidence stability locks.
   * AI proposes (soft decision), Code enforces (hard constraints).
   *
   * Explicitly categorizes cut types:
   * - SOFT_CUT: AI Director decided to cut based on musical phrasing.
   * - HARD_FORCE_CUT: Shot duration exceeded 8.0s (code enforced).
   * - CUT_SUPPRESSED: Shot duration under 2.0s (code suppressed to avoid visual flicker).
   * - NO_CUT: Camera continues smoothly without a cut.
   */
  public evaluate(
    raw: ShotDirection,
    confidences: ShotDirectionConfidence,
    currentState: MusicState,
    history: ShotHistoryItem[]
  ): ShotDirectionDecision {
    const final: ShotDirection = { ...raw };
    const appliedConstraints: string[] = [];
    let cutDecisionType: CutDecisionType = raw.cut_now ? 'SOFT_CUT' : 'NO_CUT';

    const lastShot = history.length > 0 ? history[history.length - 1] : null;

    // Calculate current running shot duration since last hard/flash cut
    let currentShotDuration = 0;
    if (lastShot) {
      let cutTime = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].pass2.final.cut_now || history[i].pass2.final.transition_type !== 'NONE') {
          cutTime = history[i].time;
          break;
        }
      }
      currentShotDuration = currentState.time - cutTime;
    }

    // --- Hard Constraint 1: Maximum Shot Duration Enforcement ---
    if (currentShotDuration >= this.config.maxShotDurationSec) {
      if (!final.cut_now) {
        final.cut_now = true;
        if (final.transition_type === 'NONE') {
          final.transition_type = 'HARD_CUT';
        }
        cutDecisionType = 'HARD_FORCE_CUT';
        appliedConstraints.push(
          `HARD CONSTRAINT: Shot duration reached ${currentShotDuration.toFixed(1)}s (>= ${this.config.maxShotDurationSec}s). Force Cut executed.`
        );
      }
    }

    // --- Hard Constraint 2: Minimum Shot Duration Protection ---
    if (lastShot && currentShotDuration < this.config.minShotDurationSec) {
      if (final.cut_now) {
        final.cut_now = false;
        final.transition_type = 'NONE';
        cutDecisionType = 'CUT_SUPPRESSED';
        appliedConstraints.push(
          `HARD CONSTRAINT: Shot duration is only ${currentShotDuration.toFixed(1)}s (< ${this.config.minShotDurationSec}s). Cut suppressed to prevent visual jitter.`
        );
      }
    }

    // --- Low Confidence Handling: "迷っているときは動かさない" ---
    if (lastShot) {
      const prevDirection = lastShot.pass2.final;

      // 1. Shot Scale confidence check
      if (confidences.shot_scale < this.config.lowConfidenceThreshold) {
        final.shot_scale = prevDirection.shot_scale;
        appliedConstraints.push(
          `LOW CONFIDENCE LOCK: Shot Scale confidence (${(confidences.shot_scale * 100).toFixed(0)}% < ${(this.config.lowConfidenceThreshold * 100)}%). Inherited previous: ${prevDirection.shot_scale}`
        );
      }

      // 2. Camera Motion confidence check
      if (confidences.camera_motion < this.config.lowConfidenceThreshold) {
        final.camera_motion = prevDirection.camera_motion;
        appliedConstraints.push(
          `LOW CONFIDENCE LOCK: Camera Motion confidence (${(confidences.camera_motion * 100).toFixed(0)}% < ${(this.config.lowConfidenceThreshold * 100)}%). Retained previous: ${prevDirection.camera_motion}`
        );
      }

      // 3. Character Motion confidence check
      if (confidences.character_motion < this.config.lowConfidenceThreshold) {
        final.character_motion = prevDirection.character_motion;
        appliedConstraints.push(
          `LOW CONFIDENCE LOCK: Character Motion confidence (${(confidences.character_motion * 100).toFixed(0)}% < ${(this.config.lowConfidenceThreshold * 100)}%). Retained previous: ${prevDirection.character_motion}`
        );
      }

      // 4. Lighting Change confidence check: only reflect if high confidence
      if (confidences.lighting_change < this.config.lowConfidenceThreshold) {
        final.lighting_change = 'HOLD';
        appliedConstraints.push(
          `LOW CONFIDENCE LOCK: Lighting confidence (${(confidences.lighting_change * 100).toFixed(0)}% < ${(this.config.lowConfidenceThreshold * 100)}%). Defaulted to HOLD.`
        );
      }
    }

    final.cut_type = cutDecisionType;

    return {
      raw,
      confidences,
      final,
      cutDecisionType,
      appliedConstraints,
    };
  }
}
