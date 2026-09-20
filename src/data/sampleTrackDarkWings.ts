import { TimelinePoint } from '../types/director';

export const DARK_WINGS_TRACK: {
  title: string;
  artist: string;
  bpm: number;
  duration: number;
  timeline: TimelinePoint[];
  audioUrl?: string;
} = {
  title: "Dark Wings",
  artist: "Aithyrion Core",
  bpm: 128,
  duration: 32.0,
  audioUrl: "/dark_wings.wav",
  timeline: [
    {
      id: "pt-1",
      time: 4.20,
      description: "Intro Atmosphere - Subtle build",
      musicState: {
        time: 4.20,
        energy: 0.08,
        energyTrend: 'rising',
        onsetStrength: 0.12,
        nextMajorChange: 5.98,
        bpm: 128,
        section: "Intro Pad"
      },
      expectedStrategy: 'INTENSIFY'
    },
    {
      id: "pt-2",
      time: 10.18,
      description: "Bass entry & visual build-up",
      musicState: {
        time: 10.18,
        energy: 0.17,
        energyTrend: 'rising',
        onsetStrength: 0.25,
        nextMajorChange: 4.05,
        bpm: 128,
        section: "Build A"
      },
      expectedStrategy: 'INTENSIFY'
    },
    {
      id: "pt-3",
      time: 14.23,
      description: "Percussion acceleration & tension spike",
      musicState: {
        time: 14.23,
        energy: 0.57,
        energyTrend: 'rapidly_rising',
        onsetStrength: 0.62,
        nextMajorChange: 3.41,
        bpm: 128,
        section: "Build B"
      },
      expectedStrategy: 'INTENSIFY'
    },
    {
      id: "pt-4",
      time: 17.64,
      description: "Pre-drop ambiguity (Diagnostic Required)",
      musicState: {
        time: 17.64,
        energy: 0.76,
        energyTrend: 'rising',
        onsetStrength: 0.58,
        nextMajorChange: 2.56,
        bpm: 128,
        section: "Pre-Drop Tension"
      },
      expectedStrategy: 'CONTINUE_TENSION'
    },
    {
      id: "pt-5",
      time: 20.20,
      description: "Climax / Drop Hit (Decisive Impact)",
      musicState: {
        time: 20.20,
        energy: 0.94,
        energyTrend: 'plateau',
        onsetStrength: 0.92,
        nextMajorChange: 4.60,
        bpm: 128,
        section: "Main Drop"
      },
      expectedStrategy: 'IMPACT_HOLD'
    },
    {
      id: "pt-6",
      time: 24.80,
      description: "Post-drop breath / open relief",
      musicState: {
        time: 24.80,
        energy: 0.42,
        energyTrend: 'falling',
        onsetStrength: 0.30,
        nextMajorChange: 5.20,
        bpm: 128,
        section: "Post-Drop Breakdown"
      },
      expectedStrategy: 'RELEASE'
    }
  ]
};
