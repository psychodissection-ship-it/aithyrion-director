import { Strategy, ShotDirection } from './director';

export type KeyframeJobStatus =
  | 'NOT_CREATED'
  | 'PENDING'
  | 'READY_FOR_CODEX'
  | 'RUNNING'
  | 'GENERATED'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED';

export type CodexBridgeMode =
  | 'MANUAL_HANDOFF'
  | 'CLI_READY'
  | 'DIRECT_EXECUTION'
  | 'INTERACTIVE_LAUNCH'
  | 'AUTO_EXEC_EXPERIMENTAL';

export interface KeyframeJobTimeline {
  shot_index: number;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
}

export interface KeyframeJobDirector {
  strategy: Strategy;
  strategy_confidence: number;
}

export interface KeyframeJobSubject {
  character_id: string;
  character_name: string;
  identity_reference: string;
  preserve_identity: boolean;
}

export interface KeyframeJobContinuity {
  previous_keyframe?: string;
  keep: string[];
  change: string[];
}

export interface KeyframeJobComposition {
  framing: string;
  camera_angle: string;
  screen_direction: string;
  composition_change: string;
}

export interface KeyframeJobGeneration {
  provider: 'CODEX_IMAGEGEN';
  aspect_ratio: '16:9';
  candidate_count: number;
}

export interface KeyframeJobOutput {
  expected_path: string;
  actual_path?: string;
}

export interface KeyframeJob {
  version: '1.0';
  job_id: string;
  track_id: string;
  status: KeyframeJobStatus;
  timeline: KeyframeJobTimeline;
  director: KeyframeJobDirector;
  shot: {
    shot_scale: string;
    camera_motion: string;
    character_motion: string;
    lighting_change: string;
    transition_type: string;
  };
  subject: KeyframeJobSubject;
  continuity: KeyframeJobContinuity;
  composition: KeyframeJobComposition;
  generation: KeyframeJobGeneration;
  output: KeyframeJobOutput;
  created_at: string;
  codex_task_markdown?: string;
  cli_launch_command?: string;
  candidate_images?: string[];
  rejection_reason?: string;
}

export interface ContinuityState {
  character_id: string;
  identity_reference: string;
  approved_keyframe?: string;
  location_id: string;
  costume_id: string;
  screen_direction: string;
  color_palette: string[];
  locked_attributes: string[];
  shot_sequence: {
    shot_index: number;
    job_id: string;
    keyframe_path: string;
  }[];
}

export interface KeyframeManifest {
  job_id: string;
  status: 'APPROVED' | 'REJECTED';
  input: {
    identity_reference: string;
    previous_keyframe?: string;
  };
  director: {
    strategy: Strategy;
    shot_scale: string;
    camera_motion: string;
    character_motion: string;
    lighting: string;
  };
  output: {
    file: string;
  };
  timestamp: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  identity_reference: string;
  description: string;
  defaultColorPalette: string[];
  defaultLocation: string;
  defaultCostume: string;
}

export interface CodexCliStatus {
  available: boolean;
  version?: string;
  executablePath?: string;
  mode: CodexBridgeMode;
  message: string;
}
