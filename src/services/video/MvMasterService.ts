export interface MasterShotInput {
  shotIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  keyframePath?: string;
}

export interface MasterBuildState {
  isBuilding: boolean;
  progressPercent: number;
  statusMessage: string;
  outputVideoUrl?: string;
  duration?: number;
  error?: string;
  updatedAt: number;
}

class MvMasterService {
  async getStatus(): Promise<MasterBuildState> {
    const res = await fetch('/api/mv/status');
    if (!res.ok) throw new Error(`Status query failed: ${res.status}`);
    return await res.json();
  }

  async buildMaster(params: {
    shots: MasterShotInput[];
    audioPath?: string;
    applyVjEffects?: boolean;
    resolution?: '720p' | '1080p';
  }): Promise<{ success: boolean; message: string; state: MasterBuildState }> {
    const res = await fetch('/api/mv/build-master', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Build request failed: ${res.status}`);
    }
    return await res.json();
  }

  async uploadAudioFile(file: Blob | File): Promise<{ success: boolean; path: string; publicUrl: string }> {
    const res = await fetch('/api/mv/upload-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: file,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Audio upload failed: ${res.status}`);
    }
    return await res.json();
  }

  async resetProject(): Promise<void> {
    try {
      await fetch('/api/mv/reset-project', { method: 'POST' });
    } catch (err) {
      console.warn('[MvMasterService] Failed to reset project:', err);
    }
  }

  async pollUntilComplete(
    onProgress?: (state: MasterBuildState) => void,
    maxWaitSec: number = 300
  ): Promise<MasterBuildState> {
    const startTime = Date.now();
    while ((Date.now() - startTime) / 1000 < maxWaitSec) {
      const state = await this.getStatus();
      if (onProgress) onProgress(state);

      if (!state.isBuilding) {
        if (state.error) {
          throw new Error(state.error);
        }
        return state;
      }

      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('MVマスターの書き出しがタイムアウトしました');
  }
}

export const mvMasterService = new MvMasterService();
