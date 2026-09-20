import { DirectorEngine } from './DirectorEngine';
import {
  MusicState,
  Strategy,
  StrategyDecision,
  DiagnosticResolution,
  ShotDirectionDecision,
  ShotHistoryItem,
  JevEngineMode,
  JevHealthStatus,
  JevInspectorTelemetry,
} from '../../types/director';

export interface JevEngineConfig {
  proxyBaseUrl?: string; // Default to relative '/api/jev'
}

/**
 * JevDirectorEngine:
 * Communicates with the server-side API proxy (/api/jev/*), ensuring sensitive API keys
 * never touch the browser or client bundle.
 *
 * Strictly enforces the fail-closed policy when running in LIVE_REMOTE mode.
 */
export class JevDirectorEngine implements DirectorEngine {
  public readonly engineId = 'jev-director-engine';
  public readonly engineName = 'JEV Neural Engine';
  public readonly description = 'Connects to JEV API via server proxy with live remote telemetry';

  private proxyBase: string;
  private currentMode: JevEngineMode = 'NOT_CONFIGURED';

  constructor(config: JevEngineConfig = {}) {
    this.proxyBase = config.proxyBaseUrl ?? '/api/jev';
  }

  public getMode(): JevEngineMode {
    return this.currentMode;
  }

  public async checkHealth(): Promise<JevHealthStatus> {
    try {
      const res = await fetch(`${this.proxyBase}/health`);
      if (!res.ok) {
        this.currentMode = 'ERROR';
        throw new Error(`JEV Proxy health check failed: ${res.status}`);
      }
      const data: JevHealthStatus = await res.json();
      this.currentMode = data.mode;
      return data;
    } catch (err: unknown) {
      this.currentMode = 'ERROR';
      throw err;
    }
  }

  public async setMode(mode: 'LIVE_REMOTE' | 'SIMULATED'): Promise<{ success: boolean; mode: JevEngineMode }> {
    const res = await fetch(`${this.proxyBase}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (res.ok) {
      this.currentMode = data.mode;
    }
    return data;
  }

  public async getInspectorTelemetry(): Promise<JevInspectorTelemetry | null> {
    try {
      const res = await fetch(`${this.proxyBase}/inspector`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Director Pass 1:
   * Requests strategic direction from JEV backend via server proxy.
   */
  public async selectStrategy(
    state: MusicState,
    history: ShotHistoryItem[]
  ): Promise<StrategyDecision> {
    const res = await fetch(`${this.proxyBase}/pass1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, history }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      if (res.status === 503) {
        this.currentMode = 'NOT_CONFIGURED';
        throw new Error(errBody.error || 'LIVE JEV NOT CONFIGURED');
      }
      this.currentMode = 'ERROR';
      throw new Error(`JEV Pass 1 Error (${res.status}): ${errBody.message || errBody.error}`);
    }

    const decision: StrategyDecision = await res.json();
    return decision;
  }

  /**
   * Diagnostic Pass:
   * Requests diagnostic resolution when confidence < 0.30.
   */
  public async diagnoseStrategy(
    state: MusicState,
    history: ShotHistoryItem[],
    pass1: StrategyDecision
  ): Promise<DiagnosticResolution> {
    const res = await fetch(`${this.proxyBase}/diagnostic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, history, pass1 }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      if (res.status === 503) {
        this.currentMode = 'NOT_CONFIGURED';
        throw new Error(errBody.error || 'LIVE JEV NOT CONFIGURED');
      }
      this.currentMode = 'ERROR';
      throw new Error(`JEV Diagnostic Error (${res.status}): ${errBody.message || errBody.error}`);
    }

    const resolution: DiagnosticResolution = await res.json();
    return resolution;
  }

  /**
   * Director Pass 2:
   * Requests granular shot direction from JEV backend via server proxy.
   */
  public async selectShotDirection(
    state: MusicState,
    strategy: Strategy,
    history: ShotHistoryItem[]
  ): Promise<ShotDirectionDecision> {
    const res = await fetch(`${this.proxyBase}/pass2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, strategy, history }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      if (res.status === 503) {
        this.currentMode = 'NOT_CONFIGURED';
        throw new Error(errBody.error || 'LIVE JEV NOT CONFIGURED');
      }
      this.currentMode = 'ERROR';
      throw new Error(`JEV Pass 2 Error (${res.status}): ${errBody.message || errBody.error}`);
    }

    const decision: ShotDirectionDecision = await res.json();
    return decision;
  }
}
