import {
  ContinuityState,
  CharacterProfile,
  KeyframeJob,
  KeyframeManifest,
} from '../../types/codexBridge';

export type { CharacterProfile };

export const DEFAULT_CHARACTERS: CharacterProfile[] = [
  {
    id: 'sara',
    name: 'Sara',
    identity_reference: 'references/characters/sara/identity.png',
    description: 'Dynamic cyberpunk protagonist with signature crimson/rose neural jacket',
    defaultColorPalette: ['#e11d48', '#0f172a', '#38bdf8'],
    defaultLocation: 'Neo-Tokyo Industrial Rooftop',
    defaultCostume: 'Tactical Cyber Rose Hoodie & Combat Gear',
  },
  {
    id: 'lexia',
    name: 'Lexia',
    identity_reference: 'references/characters/lexia/identity.png',
    description: 'Calculated tactical intelligence operative with cyan holographic neural visor',
    defaultColorPalette: ['#06b6d4', '#1e1b4b', '#f8fafc'],
    defaultLocation: 'High-altitude Cyber Command Spire',
    defaultCostume: 'Neural Interface Sleek Bodysuit & Trenchcoat',
  },
];

export class ContinuityManager {
  private characters: CharacterProfile[] = [...DEFAULT_CHARACTERS];
  private activeCharacter: CharacterProfile = DEFAULT_CHARACTERS[0];

  private state: ContinuityState = {
    character_id: DEFAULT_CHARACTERS[0].id,
    identity_reference: DEFAULT_CHARACTERS[0].identity_reference,
    approved_keyframe: undefined,
    location_id: 'location_rooftop_01',
    costume_id: 'costume_standard_01',
    screen_direction: 'RIGHT',
    color_palette: ['cyan', 'magenta', 'black'],
    locked_attributes: ['face', 'hair', 'body identity', 'costume', 'location'],
    shot_sequence: [],
  };

  private manifests: KeyframeManifest[] = [];

  constructor() {
    this.loadFromStorage();
    this.syncWithServer();
  }

  getCharacters(): CharacterProfile[] {
    return [...this.characters];
  }

  async syncWithServer(): Promise<CharacterProfile[]> {
    try {
      const res = await fetch('/api/codex/characters');
      if (res.ok) {
        const data = await res.json();
        if (data.characters && Array.isArray(data.characters) && data.characters.length > 0) {
          this.characters = data.characters;
          // Re-validate active character
          const stillExists = this.characters.find((c) => c.id === this.activeCharacter.id);
          if (stillExists) {
            this.activeCharacter = stillExists;
          } else {
            this.activeCharacter = this.characters[0];
            this.state.character_id = this.characters[0].id;
            this.state.identity_reference = this.characters[0].identity_reference;
          }
          this.saveToStorage();
        }
      }
    } catch (err) {
      console.warn('[ContinuityManager] Failed to load roster from API, using cached/default roster:', err);
    }
    return this.characters;
  }

  async registerCharacter(
    profile: CharacterProfile,
    dataUrl?: string
  ): Promise<CharacterProfile> {
    try {
      const res = await fetch('/api/codex/save-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, dataUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          const savedProfile: CharacterProfile = data.profile;
          const idx = this.characters.findIndex((c) => c.id === savedProfile.id);
          if (idx >= 0) {
            this.characters[idx] = savedProfile;
          } else {
            this.characters.push(savedProfile);
          }
          this.setActiveCharacterProfile(savedProfile);
          return savedProfile;
        }
      }
    } catch (err) {
      console.warn('Failed to save character to server, persisting locally:', err);
    }

    // Fallback local registration
    const idx = this.characters.findIndex((c) => c.id === profile.id);
    if (idx >= 0) {
      this.characters[idx] = profile;
    } else {
      this.characters.push(profile);
    }
    this.setActiveCharacterProfile(profile);
    return profile;
  }

  getActiveCharacter(): CharacterProfile {
    return this.activeCharacter;
  }

  setActiveCharacter(characterId: string) {
    const found = this.characters.find((c) => c.id === characterId);
    if (found) {
      this.setActiveCharacterProfile(found);
    }
  }

  setActiveCharacterProfile(profile: CharacterProfile) {
    this.activeCharacter = profile;
    this.state.character_id = profile.id;
    this.state.identity_reference = profile.identity_reference;
    if (profile.defaultLocation) this.state.location_id = profile.defaultLocation;
    if (profile.defaultCostume) this.state.costume_id = profile.defaultCostume;
    if (profile.defaultColorPalette) this.state.color_palette = profile.defaultColorPalette;
    this.saveToStorage();
  }

  getState(): ContinuityState {
    return { ...this.state };
  }

  getPreviousKeyframeForShot(shotIndex: number): string | undefined {
    if (shotIndex <= 1) return undefined;
    // Find highest approved shotIndex that is less than current shotIndex
    const candidates = this.state.shot_sequence
      .filter((s) => s.shot_index < shotIndex)
      .sort((a, b) => b.shot_index - a.shot_index);

    return candidates[0]?.keyframe_path || this.state.approved_keyframe;
  }

  getApprovedKeyframeForShot(shotIndex: number): string | undefined {
    const found = this.state.shot_sequence.find((s) => s.shot_index === shotIndex);
    return found?.keyframe_path;
  }

  approveKeyframe(job: KeyframeJob, keyframePath: string): KeyframeManifest {
    job.status = 'APPROVED';
    job.output.actual_path = keyframePath;

    // Update continuity state
    this.state.approved_keyframe = keyframePath;

    // Add or replace in shot sequence
    const existingIdx = this.state.shot_sequence.findIndex(
      (s) => s.shot_index === job.timeline.shot_index
    );
    const record = {
      shot_index: job.timeline.shot_index,
      job_id: job.job_id,
      keyframe_path: keyframePath,
    };

    if (existingIdx >= 0) {
      this.state.shot_sequence[existingIdx] = record;
    } else {
      this.state.shot_sequence.push(record);
      this.state.shot_sequence.sort((a, b) => a.shot_index - b.shot_index);
    }

    const manifest: KeyframeManifest = {
      job_id: job.job_id,
      status: 'APPROVED',
      input: {
        identity_reference: job.subject.identity_reference,
        previous_keyframe: job.continuity.previous_keyframe,
      },
      director: {
        strategy: job.director.strategy,
        shot_scale: job.shot.shot_scale,
        camera_motion: job.shot.camera_motion,
        character_motion: job.shot.character_motion,
        lighting: job.shot.lighting_change,
      },
      output: {
        file: keyframePath,
      },
      timestamp: new Date().toISOString(),
    };

    this.manifests.push(manifest);
    this.saveToStorage();
    return manifest;
  }

  rejectKeyframe(job: KeyframeJob, reason?: string) {
    job.status = 'REJECTED';
    job.rejection_reason = reason;

    // Remove from shot sequence if it was added
    this.state.shot_sequence = this.state.shot_sequence.filter(
      (s) => s.shot_index !== job.timeline.shot_index
    );
    // If the approved_keyframe was this one, revert to the previous one in sequence
    if (this.state.approved_keyframe === job.output.actual_path) {
      const last = this.state.shot_sequence[this.state.shot_sequence.length - 1];
      this.state.approved_keyframe = last?.keyframe_path;
    }
    this.saveToStorage();
  }

  reset() {
    this.state.approved_keyframe = undefined;
    this.state.shot_sequence = [];
    this.manifests = [];
    this.saveToStorage();
  }

  private saveToStorage() {
    try {
      localStorage.setItem('aithyrion_continuity_state', JSON.stringify(this.state));
      localStorage.setItem('aithyrion_roster', JSON.stringify(this.characters));
      localStorage.setItem('aithyrion_active_character_id', this.activeCharacter.id);
    } catch (err) {
      console.warn('[ContinuityManager] Failed to persist state to localStorage:', err);
    }
  }

  private loadFromStorage() {
    try {
      const savedRoster = localStorage.getItem('aithyrion_roster');
      if (savedRoster) {
        const parsedRoster = JSON.parse(savedRoster);
        if (Array.isArray(parsedRoster) && parsedRoster.length > 0) {
          this.characters = parsedRoster;
        }
      }

      const savedState = localStorage.getItem('aithyrion_continuity_state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed && typeof parsed === 'object') {
          this.state = { ...this.state, ...parsed };
        }
      }

      const activeId = localStorage.getItem('aithyrion_active_character_id');
      if (activeId) {
        const found = this.characters.find((c) => c.id === activeId);
        if (found) {
          this.activeCharacter = found;
          this.state.character_id = found.id;
          this.state.identity_reference = found.identity_reference;
        }
      }
    } catch (err) {
      console.warn('[ContinuityManager] Failed to read state from localStorage:', err);
    }
  }
}

export const continuityManager = new ContinuityManager();
