import { StrategyDecision, ShotDirectionDecision, Strategy } from '../../types/director';
import {
  KeyframeJob,
  ContinuityState,
  CharacterProfile,
} from '../../types/codexBridge';

export interface CompileJobInput {
  trackId: string;
  shotIndex: number;
  startSec: number;
  endSec: number;
  pass1: StrategyDecision;
  pass2: ShotDirectionDecision;
  effectiveStrategy: Strategy;
  continuity: ContinuityState;
  character: CharacterProfile;
  previousKeyframe?: string;
}

export class KeyframeSpecCompiler {
  /**
   * Compiles director decisions into a structured KeyframeJob with visual specs
   */
  compile(input: CompileJobInput): KeyframeJob {
    const {
      trackId,
      shotIndex,
      startSec,
      endSec,
      pass1,
      pass2,
      effectiveStrategy,
      continuity,
      character,
      previousKeyframe,
    } = input;

    const durationSec = +(endSec - startSec).toFixed(2);
    const padIndex = String(shotIndex).padStart(3, '0');
    const jobId = `${trackId}-shot-${padIndex}`;

    const rawShot = pass2.final;

    // 1. Camera / Framing Translation
    const framing = this.translateFraming(rawShot.shot_scale);
    const cameraTranslation = this.translateCameraMotion(rawShot.camera_motion);

    // 2. Character Motion Translation
    const characterTranslation = this.translateCharacterMotion(rawShot.character_motion);

    // 3. Lighting Translation
    const lightingTranslation = this.translateLighting(rawShot.lighting_change);

    // 4. Formulate KEEP list (Preserve invariants)
    const keep: string[] = [
      'character identity',
      'face',
      'hair',
      'costume',
      'location',
      'world continuity',
      'screen direction',
      'overall color palette',
    ];

    // 5. Formulate CHANGE list (Only what director requested)
    const change: string[] = [];

    if (previousKeyframe) {
      change.push(`framing shifts to ${framing} (${cameraTranslation})`);
      if (rawShot.character_motion !== 'STILL') {
        change.push(`character action: ${characterTranslation}`);
      }
      if (rawShot.lighting_change !== 'HOLD') {
        change.push(`lighting adjustment: ${lightingTranslation}`);
      }
      if (effectiveStrategy === 'INTENSIFY') {
        change.push('visual tension increases with tighter focal emphasis');
      } else if (effectiveStrategy === 'RELEASE') {
        change.push('visual relaxation and breathing room opens up');
      } else if (effectiveStrategy === 'IMPACT_HOLD') {
        change.push('decisive impact pose with powerful visual weight');
      }
    } else {
      // First shot: establish scene
      change.push(`establish initial ${framing} framing`);
      change.push(`character positioned in ${characterTranslation}`);
      change.push(`atmosphere set to ${lightingTranslation}`);
    }

    return {
      version: '1.0',
      job_id: jobId,
      track_id: trackId,
      status: 'READY_FOR_CODEX',
      timeline: {
        shot_index: shotIndex,
        start_sec: startSec,
        end_sec: endSec,
        duration_sec: durationSec,
      },
      director: {
        strategy: effectiveStrategy,
        strategy_confidence: pass1.confidence,
      },
      shot: {
        shot_scale: rawShot.shot_scale,
        camera_motion: rawShot.camera_motion,
        character_motion: rawShot.character_motion,
        lighting_change: rawShot.lighting_change,
        transition_type: rawShot.transition_type,
      },
      subject: {
        character_id: character.id,
        character_name: character.name,
        identity_reference: character.identity_reference,
        preserve_identity: true,
      },
      continuity: {
        previous_keyframe: previousKeyframe,
        keep,
        change,
      },
      composition: {
        framing: `${framing} (${cameraTranslation})`,
        camera_angle: 'eye_level',
        screen_direction: continuity.screen_direction || 'preserve',
        composition_change: rawShot.camera_motion === 'STATIC' ? 'subtle' : 'moderate',
      },
      generation: {
        provider: 'CODEX_IMAGEGEN',
        aspect_ratio: '16:9',
        candidate_count: 1,
      },
      output: {
        expected_path: `generated/keyframes/${jobId}.png`,
      },
      created_at: new Date().toISOString(),
    };
  }

  private translateFraming(scale: string): string {
    switch (scale) {
      case 'CLOSE':
        return 'close cinematic shot';
      case 'MEDIUM':
        return 'medium cinematic shot';
      case 'WIDE':
        return 'wide cinematic shot';
      case 'EXTREME_WIDE':
        return 'extreme wide establishing shot';
      default:
        return 'medium cinematic shot';
    }
  }

  private translateCameraMotion(motion: string): string {
    switch (motion) {
      case 'PUSH_IN':
        return 'closer framing, stronger subject dominance, reduced background visibility';
      case 'PULL_BACK':
        return 'wider framing, more environmental context, smaller subject presence';
      case 'PAN':
        return 'off-center composition, screen direction emphasis';
      case 'ORBIT':
        return 'changed perspective around the subject, preserve scene continuity';
      case 'STATIC':
      default:
        return 'stable balanced camera placement, preserved horizon';
    }
  }

  private translateCharacterMotion(action: string): string {
    switch (action) {
      case 'STILL':
        return 'stable pose, minimal body displacement';
      case 'LOOK':
        return 'subtle gaze shift toward focal target';
      case 'TURN':
        return 'torso/head turning with dynamic silhouette';
      case 'STEP_FORWARD':
        return 'clear forward weight shift / character has taken one deliberate step toward camera';
      case 'GESTURE':
        return 'one clear readable hand or upper-body gesture';
      default:
        return 'natural controlled posture';
    }
  }

  private translateLighting(lighting: string): string {
    switch (lighting) {
      case 'HOLD':
        return 'preserve current lighting schema and contrast';
      case 'BRIGHTEN':
        return 'increase environmental illumination and specular highlights';
      case 'DARKEN':
        return 'reduce overall exposure and deepen dramatic shadows';
      case 'PULSE':
        return 'capture peak moment of rhythmic light pulse on key edges';
      case 'COLOR_SHIFT':
        return 'preserve lighting balance while shifting dominant environmental hue';
      default:
        return 'maintain ambient lighting';
    }
  }
}

export const keyframeSpecCompiler = new KeyframeSpecCompiler();
