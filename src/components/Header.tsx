import React from 'react';
import {
  Play,
  SkipForward,
  RotateCcw,
  Cpu,
  Sparkles,
  Activity,
  Wand2,
  SplitSquareVertical,
  Scale,
  Film,
  Zap,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  Users,
} from 'lucide-react';
import { EngineType } from '../services/engine';
import { JevHealthStatus, JevEngineMode } from '../types/director';
import { CodexCliStatus } from '../types/codexBridge';

export type AppMode = 'STUDIO' | 'COMPARE' | 'BENCHMARK' | 'ANTI_FIXTURE';

interface HeaderProps {
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  engineType: EngineType;
  onEngineChange: (engine: EngineType) => void;
  jevHealth: JevHealthStatus | null;
  codexStatus?: CodexCliStatus | null;
  onOpenInspector: () => void;
  onOpenReferences?: () => void;
  onEvaluate: () => void;
  onStepNext: () => void;
  onAutoDirect: () => void;
  onReset: () => void;
  isEvaluating: boolean;
  isAutoDirecting: boolean;
  canStepNext: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  appMode,
  onModeChange,
  engineType,
  onEngineChange,
  jevHealth,
  codexStatus,
  onOpenInspector,
  onOpenReferences,
  onEvaluate,
  onStepNext,
  onAutoDirect,
  onReset,
  isEvaluating,
  isAutoDirecting,
  canStepNext,
}) => {
  const jevMode: JevEngineMode = jevHealth?.mode || 'NOT_CONFIGURED';

  const renderJevStatusBadge = () => {
    switch (jevMode) {
      case 'LIVE_REMOTE':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>JEV: LIVE_REMOTE</span>
          </div>
        );
      case 'SIMULATED':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>JEV: SIMULATED</span>
          </div>
        );
      case 'NOT_CONFIGURED':
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-mono font-bold">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            <span>LIVE JEV NOT CONFIGURED</span>
          </div>
        );
    }
  };

  return (
    <header className="border-b border-surface-700/60 bg-surface-850 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 select-none font-mono">
      {/* Brand & Subtitle */}
      <div className="flex items-center space-x-3.5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-amber-500 p-0.5 shadow-lg shadow-purple-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-surface-900 rounded-[7px] flex items-center justify-center">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-semibold tracking-wide text-white uppercase">Aithyrion Director</h1>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">
              v0.3.0 Live JEV Proof
            </span>
          </div>
          <p className="text-[11px] text-slate-400 tracking-tight">
            Music-aware AI Direction Engine
          </p>
        </div>
      </div>

      {/* Main View Mode Selector */}
      <div className="flex items-center space-x-1 bg-surface-900 border border-surface-700/80 rounded-lg p-1 text-xs">
        <button
          onClick={() => onModeChange('STUDIO')}
          className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
            appMode === 'STUDIO'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Director Studio</span>
        </button>

        <button
          onClick={() => onModeChange('COMPARE')}
          className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
            appMode === 'COMPARE'
              ? 'bg-purple-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <SplitSquareVertical className="w-3.5 h-3.5" />
          <span>Compare Engines</span>
        </button>

        <button
          onClick={() => onModeChange('BENCHMARK')}
          className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
            appMode === 'BENCHMARK'
              ? 'bg-amber-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Benchmark Validator</span>
        </button>

        <button
          onClick={() => onModeChange('ANTI_FIXTURE')}
          className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
            appMode === 'ANTI_FIXTURE'
              ? 'bg-emerald-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Modulate energy to verify dynamic neural probability tensors"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Anti-Fixture Test</span>
        </button>
      </div>

      {/* Engine Status, Inspector Trigger & Switcher */}
      <div className="flex items-center space-x-2.5">
        {/* Prominent Live JEV Engine Status Badge */}
        {renderJevStatusBadge()}

        {/* JEV Raw Request/Response Inspector Trigger */}
        <button
          onClick={onOpenInspector}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-900 hover:bg-surface-750 border border-surface-700/80 text-purple-300 text-xs transition"
          title="Open Developer Raw Request / Response Inspector"
        >
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">JEV Inspector</span>
        </button>

        {/* Codex Bridge CLI Status Badge */}
        {codexStatus && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono ${
              codexStatus.available
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-bold'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            }`}
            title={codexStatus.message}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                codexStatus.available ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{codexStatus.available ? 'CODEX: READY' : 'CODEX: MANUAL'}</span>
          </div>
        )}

        {/* References Manager Trigger */}
        {onOpenReferences && (
          <button
            onClick={onOpenReferences}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-900 hover:bg-surface-750 border border-surface-700/80 text-slate-300 hover:text-white text-xs transition"
            title="Open Character & Scene Reference Manager"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">References</span>
          </button>
        )}

        {/* JEV Engine Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/40 border border-purple-500/40 rounded-lg text-purple-300 text-xs font-semibold">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span>JEV (TypeSafe AI)</span>
        </div>

        {/* Transport Controls (Studio mode) */}
        {appMode === 'STUDIO' && (
          <div className="flex items-center space-x-1.5">
            <button
              onClick={onAutoDirect}
              disabled={isAutoDirecting || isEvaluating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs rounded transition shadow-sm font-medium"
              title="タイムライン全カットのカメラワーク・演出方針をJEV AIが一括自動決定します"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isAutoDirecting ? '演出中...' : '🪄 全自動演出'}</span>
            </button>

            <button
              onClick={onEvaluate}
              disabled={isEvaluating || isAutoDirecting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-indigo-400/50 text-white text-xs font-medium rounded transition shadow-sm"
              title="【Eval（評価/指示）】選択中のカット（ビート）に対してJEV AIがカメラワーク・画角・演出方針を決定します"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isEvaluating ? '推論中...' : '🎬 AI演出指示 (Eval)'}</span>
            </button>

            <button
              onClick={onStepNext}
              disabled={!canStepNext || isEvaluating || isAutoDirecting}
              className="p-1.5 bg-surface-750 hover:bg-surface-700 border border-surface-600/50 disabled:opacity-40 text-slate-200 text-xs rounded transition"
              title="Step Next"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onReset}
              title="Reset session & history"
              className="p-1.5 bg-surface-750 hover:bg-surface-700 border border-surface-600/50 text-slate-400 hover:text-slate-200 rounded transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
