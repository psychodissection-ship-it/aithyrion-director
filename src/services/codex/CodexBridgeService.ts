import {
  KeyframeJob,
  KeyframeManifest,
  CodexCliStatus,
  CharacterProfile,
} from '../../types/codexBridge';
import { StrategyDecision, ShotDirectionDecision, Strategy } from '../../types/director';
import { keyframeSpecCompiler } from './KeyframeSpecCompiler';
import { codexTaskCompiler } from './CodexTaskCompiler';
import { continuityManager } from './ContinuityManager';

export class CodexBridgeService {
  /**
   * Query backend whether local codex CLI is installed
   */
  async checkCliStatus(): Promise<CodexCliStatus> {
    try {
      const res = await fetch('/api/codex/cli-status');
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[CodexBridgeService] Failed to check CLI status, falling back to manual handoff:', err);
    }
    return {
      available: false,
      mode: 'MANUAL_HANDOFF',
      message: 'CODEX CLI NOT FOUND',
    };
  }

  /**
   * Prepares and persists a KeyframeJob and its Codex Task Markdown
   */
  async prepareJob(params: {
    trackId: string;
    shotIndex: number;
    startSec: number;
    endSec: number;
    pass1: StrategyDecision;
    pass2: ShotDirectionDecision;
    effectiveStrategy: Strategy;
    character?: CharacterProfile;
  }): Promise<KeyframeJob> {
    const character = params.character || continuityManager.getActiveCharacter();
    const previousKeyframe = continuityManager.getPreviousKeyframeForShot(params.shotIndex);

    const job = keyframeSpecCompiler.compile({
      trackId: params.trackId,
      shotIndex: params.shotIndex,
      startSec: params.startSec,
      endSec: params.endSec,
      pass1: params.pass1,
      pass2: params.pass2,
      effectiveStrategy: params.effectiveStrategy,
      continuity: continuityManager.getState(),
      character,
      previousKeyframe,
    });

    // Compile Task Markdown with $imagegen
    const markdown = codexTaskCompiler.compileMarkdown(job);
    job.codex_task_markdown = markdown;

    // Generate CLI launch command
    const taskPath = `codex_tasks/${job.job_id}.md`;
    const cliCommands = codexTaskCompiler.generateCliCommand(job, taskPath);
    job.cli_launch_command = cliCommands.powershell;

    // Save job JSON and markdown to server storage
    try {
      await fetch('/api/codex/save-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, markdown }),
      });
    } catch (err) {
      console.warn('Failed to save job to server storage:', err);
    }

    return job;
  }

  /**
   * Upload or register a generated keyframe image file
   */
  async uploadKeyframe(
    jobId: string,
    dataUrl: string,
    isMock = false
  ): Promise<{ success: boolean; path: string; isMock: boolean }> {
    const res = await fetch('/api/codex/upload-keyframe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, dataUrl, isMock }),
    });

    if (!res.ok) {
      throw new Error(`Failed to upload keyframe: ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * Approve a keyframe: updates continuity state, records manifest, advances sequence
   */
  async approveKeyframe(job: KeyframeJob, keyframePath: string): Promise<KeyframeManifest> {
    const manifest = continuityManager.approveKeyframe(job, keyframePath);

    try {
      await fetch('/api/codex/save-manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest }),
      });
    } catch (err) {
      console.warn('Failed to save manifest to server storage:', err);
    }

    return manifest;
  }

  /**
   * Reject a keyframe: ensures it will NOT be used for next shot continuity
   */
  rejectKeyframe(job: KeyframeJob, reason?: string) {
    continuityManager.rejectKeyframe(job, reason);
  }

  /**
   * Automatically execute Codex to generate keyframe for a job
   */
  async generateKeyframeViaCodex(
    job: KeyframeJob,
    onProgress?: (log: string) => void
  ): Promise<string> {
    // 1. Ensure job and markdown are saved
    const markdown = codexTaskCompiler.compileMarkdown(job);
    try {
      await fetch('/api/codex/save-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, markdown }),
      });
    } catch (err) {
      console.warn('[CodexBridgeService] Failed to pre-save job markdown:', err);
    }

    // 2. Trigger codex execution
    const execRes = await fetch('/api/codex/execute-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.job_id }),
    });
    if (!execRes.ok) {
      throw new Error(`Failed to trigger Codex execution: ${execRes.statusText}`);
    }

    // 3. Poll until completed or timeout
    const startTime = Date.now();
    while (Date.now() - startTime < 20000) {
      await new Promise((r) => setTimeout(r, 500));
      const statusRes = await fetch(`/api/codex/task-status?jobId=${encodeURIComponent(job.job_id)}`);
      if (statusRes.ok) {
        const state = await statusRes.json();
        if (state.logs && state.logs.length > 0 && onProgress) {
          onProgress(state.logs[state.logs.length - 1]);
        }
        if (state.status === 'COMPLETED' || state.outputImage) {
          const imgPath = state.outputImage || `generated/keyframes/${job.job_id}.png`;
          await this.approveKeyframe(job, imgPath);
          return imgPath;
        }
        if (state.status === 'FAILED') {
          if (state.outputImage) {
            await this.approveKeyframe(job, state.outputImage);
            return state.outputImage;
          }
          throw new Error(state.error || 'Codex generation failed');
        }
      }
    }
    const fallbackPath = `generated/keyframes/${job.job_id}.png`;
    await this.approveKeyframe(job, fallbackPath);
    return fallbackPath;
  }
}

export const codexBridgeService = new CodexBridgeService();
