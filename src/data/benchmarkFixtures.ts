import { BenchmarkFixture } from '../types/director';

export const BENCHMARK_FIXTURES: BenchmarkFixture[] = [
  {
    id: 'dw-10.18',
    cueTime: 10.18,
    label: 'Dark Wings @ 10.18s (Build A Entry)',
    musicState: {
      time: 10.18,
      energy: 0.17,
      energyTrend: 'rising',
      onsetStrength: 0.25,
      nextMajorChange: 4.05,
      bpm: 128,
      section: 'Build A',
    },
    expected: {
      strategy: 'INTENSIFY',
      probability: 0.65,
      confidence: 0.54,
      alternatives: [
        { strategy: 'CONTINUE_TENSION', probability: 0.22 },
        { strategy: 'RELEASE', probability: 0.14 },
      ],
      shot: {
        shot_scale: 'CLOSE',
        camera_motion: 'PUSH_IN',
        character_motion: 'STEP_FORWARD',
        lighting_change: 'DARKEN',
        cutDecisionType: 'SOFT_CUT',
        transition_type: 'HARD_CUT',
      },
    },
    notes: 'Baseline Playground test: Bass introduction triggers visual tension intensification.',
  },
  {
    id: 'dw-14.23',
    cueTime: 14.23,
    label: 'Dark Wings @ 14.23s (Build B Escalation)',
    musicState: {
      time: 14.23,
      energy: 0.57,
      energyTrend: 'rapidly_rising',
      onsetStrength: 0.62,
      nextMajorChange: 3.41,
      bpm: 128,
      section: 'Build B',
    },
    expected: {
      strategy: 'INTENSIFY',
      probability: 0.72,
      confidence: 0.65,
      alternatives: [
        { strategy: 'IMPACT_HOLD', probability: 0.18 },
        { strategy: 'CONTINUE_TENSION', probability: 0.10 },
      ],
      shot: {
        shot_scale: 'MEDIUM',
        camera_motion: 'PUSH_IN',
        character_motion: 'STEP_FORWARD',
        lighting_change: 'DARKEN',
        cutDecisionType: 'SOFT_CUT',
        transition_type: 'HARD_CUT',
      },
    },
    notes: 'Rhythmic acceleration: Director cuts to medium shot while continuing push-in and dark lighting.',
  },
  {
    id: 'dw-17.64',
    cueTime: 17.64,
    label: 'Dark Wings @ 17.64s (Pre-Drop Ambiguity / Diagnostic)',
    musicState: {
      time: 17.64,
      energy: 0.76,
      energyTrend: 'rising',
      onsetStrength: 0.58,
      nextMajorChange: 2.56,
      bpm: 128,
      section: 'Pre-Drop Tension',
    },
    expected: {
      strategy: 'CONTINUE_TENSION',
      probability: 0.44,
      confidence: 0.23, // < 0.30 -> Triggers Diagnostic Pass
      alternatives: [
        { strategy: 'IMPACT_HOLD', probability: 0.42 },
        { strategy: 'RELEASE', probability: 0.26 },
      ],
      diagnostic: {
        impact_arrival: 0.38,
        tension_should_continue: 0.74,
        release_is_appropriate: 0.12,
      },
      resolvedStrategy: 'CONTINUE_TENSION',
      shot: {
        shot_scale: 'MEDIUM',
        camera_motion: 'PUSH_IN',
        character_motion: 'STILL',
        lighting_change: 'HOLD',
        cutDecisionType: 'NO_CUT',
        transition_type: 'NONE',
      },
    },
    notes: 'Key criterion: Low confidence triggers Diagnostic Pass. Tension (0.74) dominates, holding camera and suppressing cut.',
  },
];
