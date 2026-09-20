export interface HailuoModelOption {
  id: string;
  name: string;
  default?: boolean;
}

export interface HailuoConfigResponse {
  hasEnvKey: boolean;
  availableModels: HailuoModelOption[];
  defaultModel: string;
}

export interface HailuoGenerateParams {
  shotIndex: number;
  prompt: string;
  keyframePath?: string;
  model?: string;
  duration?: number;
  apiKey?: string;
}

export interface HailuoGenerateResponse {
  success: boolean;
  taskId?: string;
  status?: 'Preparing' | 'Processing' | 'Success' | 'Fail';
  shotIndex?: number;
  model?: string;
  error?: string;
  message?: string;
}

export interface HailuoStatusResponse {
  success: boolean;
  taskId: string;
  status: 'Preparing' | 'Processing' | 'Success' | 'Fail';
  fileId?: string;
  downloadUrl?: string;
  videoUrl?: string;
  shotIndex?: number;
  error?: string;
  message?: string;
}

export interface HailuoSavedVideo {
  fileName: string;
  shotIndex: number;
  url: string;
  size: number;
  createdAt: number;
}

export interface HailuoBatchItem {
  shotIndex: number;
  prompt: string;
  keyframePath?: string;
  model?: string;
  duration?: number;
  status: 'pending' | 'generating' | 'polling' | 'completed' | 'failed' | 'cancelled';
  taskId?: string;
  progressMessage?: string;
  videoUrl?: string;
  error?: string;
}

export interface HailuoBatchState {
  isRunning: boolean;
  total: number;
  completed: number;
  failed: number;
  currentShotIndex?: number;
  items: HailuoBatchItem[];
  startedAt?: number;
  statusMessage: string;
}

class HailuoVideoService {
  private static API_KEY_STORAGE_KEY = 'aithyrion_minimax_api_key';
  private static PREFERRED_MODEL_KEY = 'aithyrion_minimax_model';

  getStoredApiKey(): string {
    return localStorage.getItem(HailuoVideoService.API_KEY_STORAGE_KEY) || '';
  }

  setStoredApiKey(key: string): void {
    if (!key) {
      localStorage.removeItem(HailuoVideoService.API_KEY_STORAGE_KEY);
    } else {
      localStorage.setItem(HailuoVideoService.API_KEY_STORAGE_KEY, key.trim());
    }
  }

  getPreferredModel(): string {
    return localStorage.getItem(HailuoVideoService.PREFERRED_MODEL_KEY) || 'MiniMax-Hailuo-2.3';
  }

  setPreferredModel(model: string): void {
    localStorage.setItem(HailuoVideoService.PREFERRED_MODEL_KEY, model);
  }

  async getConfig(): Promise<HailuoConfigResponse> {
    try {
      const res = await fetch('/api/hailuo/config');
      if (!res.ok) throw new Error(`Config request failed: ${res.status}`);
      return await res.json();
    } catch {
      return {
        hasEnvKey: false,
        availableModels: [
          { id: 'MiniMax-Hailuo-02', name: 'Hailuo 02 (Balanced / Cinematic)', default: true },
          { id: 'MiniMax-Hailuo-2.3', name: 'Hailuo 2.3 (High Fidelity / Expressive)' },
          { id: 'MiniMax-H3', name: 'MiniMax H3 (Native Multimodal / Latest)' },
        ],
        defaultModel: 'MiniMax-Hailuo-02',
      };
    }
  }

  async generateVideo(params: HailuoGenerateParams): Promise<HailuoGenerateResponse> {
    const apiKey = params.apiKey || this.getStoredApiKey();
    const res = await fetch('/api/hailuo/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        apiKey,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Video generation request failed');
    }
    return data;
  }

  async queryStatus(taskId: string, apiKey?: string): Promise<HailuoStatusResponse> {
    const key = apiKey || this.getStoredApiKey();
    const url = `/api/hailuo/status?taskId=${encodeURIComponent(taskId)}${
      key ? `&apiKey=${encodeURIComponent(key)}` : ''
    }`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to query task status');
    }
    return data;
  }

  async listVideos(): Promise<HailuoSavedVideo[]> {
    try {
      const res = await fetch('/api/hailuo/list-videos');
      if (!res.ok) return [];
      const data = await res.json();
      return data.videos || [];
    } catch {
      return [];
    }
  }

  /**
   * Polls MiniMax video generation status until finished or max attempts reached
   */
  async pollUntilComplete(
    taskId: string,
    apiKey?: string,
    onProgress?: (status: string, attempt: number) => void,
    maxAttempts = 60,
    intervalMs = 5000
  ): Promise<HailuoStatusResponse> {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      const result = await this.queryStatus(taskId, apiKey);
      if (onProgress) {
        onProgress(result.status, attempt);
      }

      if (result.status === 'Success' || result.status === 'Fail') {
        return result;
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error('Video generation timed out after maximum polling attempts (5 minutes).');
  }

  async startBatchGeneration(params: {
    shots: Array<{
      shotIndex: number;
      prompt: string;
      keyframePath?: string;
      model?: string;
      duration?: number;
    }>;
    apiKey?: string;
    model?: string;
  }): Promise<{ success: boolean; message: string; state: HailuoBatchState }> {
    const res = await fetch('/api/hailuo/batch-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Batch request failed: ${res.status}`);
    }
    return await res.json();
  }

  async getBatchStatus(): Promise<HailuoBatchState> {
    const res = await fetch('/api/hailuo/batch-status');
    if (!res.ok) throw new Error(`Batch status failed: ${res.status}`);
    return await res.json();
  }

  async cancelBatch(): Promise<{ success: boolean; state: HailuoBatchState }> {
    const res = await fetch('/api/hailuo/batch-cancel', {
      method: 'POST',
    });
    return await res.json();
  }

  async resetVideos(): Promise<void> {
    try {
      await fetch('/api/hailuo/reset-videos', { method: 'POST' });
    } catch (err) {
      console.warn('[HailuoVideoService] Failed to reset videos:', err);
    }
  }
}

export const hailuoVideoService = new HailuoVideoService();
