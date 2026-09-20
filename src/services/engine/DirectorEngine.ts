import {
  MusicState,
  Strategy,
  StrategyDecision,
  DiagnosticResolution,
  ShotDirectionDecision,
  ShotHistoryItem
} from '../../types/director';

export interface DirectorEngine {
  readonly engineId: string;
  readonly engineName: string;
  readonly description: string;

  /**
   * Director Pass 1:
   * Determines overarching direction strategy based on current music state and shot history.
   */
  selectStrategy(
    state: MusicState,
    history: ShotHistoryItem[]
  ): Promise<StrategyDecision>;

  /**
   * Diagnostic Pass:
   * When confidence < 0.30, analyzes impact arrival, tension continuation, and release appropriateness.
   */
  diagnoseStrategy(
    state: MusicState,
    history: ShotHistoryItem[],
    pass1: StrategyDecision
  ): Promise<DiagnosticResolution>;

  /**
   * Director Pass 2:
   * Given the resolved strategy, determines granular visual shooting instructions.
   */
  selectShotDirection(
    state: MusicState,
    strategy: Strategy,
    history: ShotHistoryItem[]
  ): Promise<ShotDirectionDecision>;
}
