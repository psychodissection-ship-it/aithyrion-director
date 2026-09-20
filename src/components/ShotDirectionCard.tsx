import React from 'react';
import { ShotDirectionDecision, CutDecisionType } from '../types/director';
import {
  Film,
  Video,
  UserCheck,
  SunMedium,
  Scissors,
  ArrowRightLeft,
  ShieldAlert,
  Sparkles,
  Shield,
  AlertOctagon,
  Image as ImageIcon,
  Copy,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Play,
} from 'lucide-react';
import { KeyframeJob } from '../types/codexBridge';

interface ShotDirectionCardProps {
  decision: ShotDirectionDecision | null;
  isEvaluating: boolean;
  currentJob?: KeyframeJob | null;
  onPrepareJob?: () => void;
  onOpenJobModal?: () => void;
  onOpenReviewModal?: () => void;
}

export const ShotDirectionCard: React.FC<ShotDirectionCardProps> = ({
  decision,
  isEvaluating: _isEvaluating,
  currentJob,
  onPrepareJob,
  onOpenJobModal,
  onOpenReviewModal,
}) => {
  if (!decision) {
    return (
      <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-6 flex flex-col items-center justify-center min-h-[240px] text-center shadow-sm">
        <Film className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
          Pass 2: Shot Planning Idle
        </span>
        <p className="text-xs text-slate-600 mt-1 max-w-xs font-mono">
          Awaiting Strategy confirmation to synthesize visual camera and character directions.
        </p>
      </div>
    );
  }

  const { final, confidences, cutDecisionType, appliedConstraints } = decision;

  const renderCutBadge = (type: CutDecisionType) => {
    switch (type) {
      case 'SOFT_CUT':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI SOFT CUT</span>
            <span className="text-[10px] text-emerald-400/80 font-normal">(Director Decided)</span>
          </div>
        );
      case 'HARD_FORCE_CUT':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-xs font-semibold animate-pulse">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            <span>HARD FORCE CUT</span>
            <span className="text-[10px] text-rose-300/80 font-normal">(&ge; 8s Max Limit)</span>
          </div>
        );
      case 'CUT_SUPPRESSED':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-semibold">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>CUT SUPPRESSED</span>
            <span className="text-[10px] text-amber-400/80 font-normal">(&lt; 2s Min Protection)</span>
          </div>
        );
      case 'NO_CUT':
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-900 border border-surface-750 text-slate-400 font-mono text-xs">
            <Scissors className="w-3.5 h-3.5 text-slate-500" />
            <span>HOLD SHOT</span>
            <span className="text-[10px] text-slate-500">(No Cut)</span>
          </div>
        );
    }
  };

  const renderParam = (
    label: string,
    value: string,
    confidence: number,
    icon: React.ReactNode,
    highlight = false
  ) => {
    const confPct = Math.round(confidence * 100);
    return (
      <div className="bg-surface-900/90 border border-surface-750 p-3 rounded-lg flex flex-col justify-between font-mono">
        <div className="flex items-center justify-between text-slate-500 text-[10.5px] mb-1">
          <div className="flex items-center space-x-1.5">
            {icon}
            <span className="uppercase tracking-wider">{label}</span>
          </div>
          <span
            className={`text-[10px] font-semibold ${
              confPct >= 75 ? 'text-emerald-400' : confPct >= 50 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {confPct}%
          </span>
        </div>

        <div className={`text-sm font-bold mt-1 tracking-tight ${highlight ? 'text-indigo-300' : 'text-white'}`}>
          {value}
        </div>

        {/* Confidence mini bar */}
        <div className="w-full bg-surface-800 rounded-full h-1 mt-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              confPct >= 75 ? 'bg-emerald-500' : confPct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${confPct}%` }}
          />
        </div>
      </div>
    );
  };

  const jobStatus = currentJob ? currentJob.status : 'NOT_CREATED';

  return (
    <div className="bg-surface-850 border border-surface-700/60 rounded-xl p-4 flex flex-col justify-between shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-700/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
              4. Shot Direction
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">Pass 2: Granular Visual Execution</p>
          </div>
        </div>

        {/* Prominent Cut Distinction Badge */}
        <div>{renderCutBadge(cutDecisionType)}</div>
      </div>

      {/* 6 Parameter Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-1">
        {renderParam(
          'Shot Scale',
          final.shot_scale,
          confidences.shot_scale,
          <Film className="w-3.5 h-3.5 text-indigo-400" />,
          true
        )}
        {renderParam(
          'Camera Motion',
          final.camera_motion,
          confidences.camera_motion,
          <Video className="w-3.5 h-3.5 text-cyan-400" />
        )}
        {renderParam(
          'Character Motion',
          final.character_motion,
          confidences.character_motion,
          <UserCheck className="w-3.5 h-3.5 text-purple-400" />
        )}
        {renderParam(
          'Lighting Change',
          final.lighting_change,
          confidences.lighting_change,
          <SunMedium className="w-3.5 h-3.5 text-amber-400" />
        )}
        {renderParam(
          'Cut Execution',
          final.cut_now ? 'CUT (ACTIVE)' : 'HOLD (INACTIVE)',
          confidences.cut,
          <Scissors className="w-3.5 h-3.5 text-rose-400" />,
          final.cut_now
        )}
        {renderParam(
          'Transition',
          final.transition_type,
          confidences.cut,
          <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
        )}
      </div>

      {/* Hard Constraints notice if applicable */}
      {appliedConstraints.length > 0 && (
        <div className="bg-surface-900 border border-indigo-500/30 rounded-lg p-2.5 font-mono text-[11px]">
          <div className="flex items-center space-x-1.5 text-indigo-400 font-semibold mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hard Constraint / Stability Policy:</span>
          </div>
          <ul className="list-disc list-inside text-slate-400 space-y-0.5 pl-1 text-[10.5px]">
            {appliedConstraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* CODEX KEYFRAME BRIDGE INTEGRATION */}
      <div className="bg-surface-900/90 border border-indigo-500/30 rounded-xl p-3 font-mono text-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-slate-200 text-xs">Codex Keyframe Bridge</span>
          </div>

          {/* Status Badge */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-slate-500">Status:</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                jobStatus === 'APPROVED'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : jobStatus === 'READY_FOR_CODEX'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : jobStatus === 'REJECTED'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-surface-800 text-slate-400 border-surface-700'
              }`}
            >
              {jobStatus}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-surface-800">
          <div className="text-[11px] text-slate-400">
            {jobStatus === 'NOT_CREATED' && 'Generate keyframe illustration for this shot via Codex'}
            {jobStatus === 'READY_FOR_CODEX' && 'Codex job prepared. Run generation or review image.'}
            {jobStatus === 'APPROVED' && 'Keyframe approved & registered for next shot continuity.'}
            {jobStatus === 'REJECTED' && 'Keyframe rejected. Re-run Codex to generate new candidate.'}
          </div>

          <div className="flex items-center space-x-2">
            {jobStatus === 'NOT_CREATED' ? (
              <button
                onClick={onPrepareJob}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition text-xs shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Generate with Codex</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onOpenJobModal}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 transition text-[11px] font-semibold"
                  title="Open Codex Execution & Spec Console"
                >
                  <Play className="w-3 h-3 fill-current text-emerald-400" />
                  <span>Run / Spec</span>
                </button>

                <button
                  onClick={onOpenReviewModal}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition text-[11px] font-semibold"
                  title="Human review & approval"
                >
                  <ImageIcon className="w-3 h-3 text-emerald-400" />
                  <span>{jobStatus === 'APPROVED' ? 'View Keyframe' : 'Review / Generate'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
