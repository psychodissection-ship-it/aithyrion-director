import React, { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UploadCloud,
  Layers,
  Image as ImageIcon,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Loader2,
  Play,
} from 'lucide-react';
import { KeyframeJob } from '../../types/codexBridge';
import { codexBridgeService } from '../../services/codex/CodexBridgeService';

interface KeyframeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: KeyframeJob | null;
  onJobUpdated: (job: KeyframeJob) => void;
}

export const KeyframeReviewModal: React.FC<KeyframeReviewModalProps> = ({
  isOpen,
  onClose,
  job,
  onJobUpdated,
}) => {
  const [candidateImage, setCandidateImage] = useState<string | null>(null);
  const [isMock, setIsMock] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isGeneratingViaCodex, setIsGeneratingViaCodex] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-load existing keyframe if available
  useEffect(() => {
    if (isOpen && job) {
      if (job.output?.actual_path) {
        setCandidateImage(`/api/codex/image?path=${encodeURIComponent(job.output.actual_path)}&t=${Date.now()}`);
      } else {
        // Probe if generated/keyframes/${job.job_id}.png exists
        const testPath = `generated/keyframes/${job.job_id}.png`;
        fetch(`/api/codex/image?path=${encodeURIComponent(testPath)}`)
          .then((res) => {
            if (res.ok) {
              setCandidateImage(`/api/codex/image?path=${encodeURIComponent(testPath)}&t=${Date.now()}`);
            } else {
              setCandidateImage(null);
            }
          })
          .catch(() => setCandidateImage(null));
      }
    }
  }, [isOpen, job]);

  if (!isOpen || !job) return null;

  /**
   * One-click Codex Keyframe Generation using the designated character identity
   */
  const handleGenerateViaCodex = async () => {
    setIsGeneratingViaCodex(true);
    setStatusMessage(`Synthesizing Keyframe for Shot #${job.timeline.shot_index} using ${job.subject.character_name}...`);

    try {
      const imgPath = await codexBridgeService.generateKeyframeViaCodex(job, (log) => {
        setStatusMessage(log.slice(-100));
      });
      setCandidateImage(`/api/codex/image?path=${encodeURIComponent(imgPath)}&t=${Date.now()}`);
      setStatusMessage('Keyframe generated successfully via Codex!');
      onJobUpdated({
        ...job,
        status: 'APPROVED',
        output: { ...job.output, actual_path: imgPath },
      });
    } catch (err: any) {
      console.error('Codex generation failed:', err);
      setStatusMessage(`Codex error: ${err.message}`);
    } finally {
      setIsGeneratingViaCodex(false);
    }
  };

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await loadCandidateFile(files[0], false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await loadCandidateFile(files[0], false);
    }
  };

  const loadCandidateFile = async (file: File, mock = false) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCandidateImage(reader.result as string);
      setIsMock(mock);
      setStatusMessage(null);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Approve current candidate image
   */
  const handleApprove = async () => {
    if (!candidateImage) return;

    try {
      setIsUploading(true);
      // Upload keyframe to server storage
      const uploadRes = await codexBridgeService.uploadKeyframe(job.job_id, candidateImage, isMock);

      // Approve in continuity manager & save manifest
      await codexBridgeService.approveKeyframe(job, uploadRes.path);

      onJobUpdated({ ...job, status: 'APPROVED', output: { ...job.output, actual_path: uploadRes.path } });
      onClose();
    } catch (err: any) {
      console.error('Approval failed:', err);
      setStatusMessage(`Approval error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Reject current candidate image
   */
  const handleReject = () => {
    codexBridgeService.rejectKeyframe(job, 'Rejected during human review');
    onJobUpdated({ ...job, status: 'REJECTED' });
    setCandidateImage(null);
    setStatusMessage('Keyframe rejected. Will NOT be used as reference for subsequent shots.');
  };

  /**
   * Reset candidate for regeneration
   */
  const handleRegenerate = () => {
    setCandidateImage(null);
    job.status = 'READY_FOR_CODEX';
    onJobUpdated({ ...job });
    setStatusMessage('Reset candidate. Ready for new generation.');
  };

  const identitySrc = `/api/codex/image?path=${encodeURIComponent(job.subject.identity_reference)}`;
  const prevKeyframeSrc = job.continuity.previous_keyframe
    ? `/api/codex/image?path=${encodeURIComponent(job.continuity.previous_keyframe)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-850 border border-surface-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden font-mono text-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60 bg-surface-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-semibold text-white tracking-wide">
                  カット #{job.timeline.shot_index} のキーフレーム個別修正・再生成 (リテイク)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Shot #{job.timeline.shot_index}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ※一括生成（Generate All）完了後は自動反映されます。特定のカットだけを描き直したい時に使います。
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="閉じる"
            className="p-1 rounded-lg hover:bg-surface-750 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs font-mono">
          {/* Reference vs Candidate Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Identity Reference */}
            <div className="bg-surface-900/90 border border-surface-750 rounded-xl p-3 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-indigo-300 font-semibold">1. キャラクター原案 (お手本)</span>
                <span className="text-slate-500 text-[10px]">基準画像</span>
              </div>
              <div className="aspect-video bg-surface-950 rounded-lg overflow-hidden border border-surface-800 flex items-center justify-center relative group">
                <img
                  src={identitySrc}
                  alt="Character Identity"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-[10px] text-white">
                  {job.subject.character_name} 原案
                </div>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {job.subject.character_name} ({job.subject.identity_reference})
              </div>
            </div>

            {/* 2. Previous Keyframe (Continuity) */}
            <div className="bg-surface-900/90 border border-surface-750 rounded-xl p-3 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cyan-300 font-semibold">2. 直前のカット (比較)</span>
                <span className="text-slate-500 text-[10px]">連続性確認</span>
              </div>
              <div className="aspect-video bg-surface-950 rounded-lg overflow-hidden border border-surface-800 flex items-center justify-center relative">
                {prevKeyframeSrc ? (
                  <img
                    src={prevKeyframeSrc}
                    alt="Previous Keyframe"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-4 text-center text-slate-500 text-[10.5px]">
                    オープニングカット #1<br />
                    (直前フレームなし)
                  </div>
                )}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {job.continuity.previous_keyframe || 'オープニングシーン'}
              </div>
            </div>

            {/* 3. Candidate Generated Keyframe */}
            <div className="bg-surface-900/90 border border-surface-750 rounded-xl p-3 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-300 font-semibold flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. Codex作画結果 (今回のカット)</span>
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  {candidateImage ? '作画完了' : isGeneratingViaCodex ? '描画中...' : '未生成'}
                </span>
              </div>

              <div className="aspect-video rounded-lg overflow-hidden border border-surface-800 bg-surface-950 flex flex-col items-center justify-center relative shadow-inner">
                {isGeneratingViaCodex ? (
                  <div className="flex flex-col items-center space-y-2 p-4 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <div className="text-[11px] font-semibold text-white">Synthesizing with Codex...</div>
                    <div className="text-[10px] text-slate-400 max-w-xs">
                      Applying {job.subject.character_name} reference & camera directions
                    </div>
                  </div>
                ) : candidateImage ? (
                  <>
                    <img
                      src={candidateImage}
                      alt="Candidate Keyframe"
                      className="w-full h-full object-cover"
                    />
                    {isMock && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] shadow">
                        MOCK KEYFRAME
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 flex flex-col items-center justify-center text-center space-y-2.5">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-200">
                        No Keyframe Generated Yet
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Codex will draw using {job.subject.character_name}'s identity
                      </div>
                    </div>
                    <button
                      onClick={handleGenerateViaCodex}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center space-x-1.5 shadow-md"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Generate with Codex</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action buttons below candidate preview */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {candidateImage ? (
                  <button
                    onClick={handleGenerateViaCodex}
                    disabled={isGeneratingViaCodex}
                    className="w-full text-[11px] px-2 py-1.5 rounded bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/40 transition flex items-center justify-center space-x-1 disabled:opacity-40 font-semibold"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                    <span>このカットをCodexで再作画 (リテイク)</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between w-full text-[10px] text-slate-500">
                    <span>出力比率: 16:9 シネマティック</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Alert if any */}
          {statusMessage && (
            <div className="p-2.5 bg-surface-900 border border-indigo-500/40 rounded-lg text-[11px] text-indigo-300 flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Verification Checklist: KEEP vs CHANGE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="bg-surface-900/60 p-3 rounded-xl border border-surface-750 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>維持ルール (キャラ・衣装・世界観の統一)</span>
              </div>
              <ul className="text-[10.5px] text-slate-400 space-y-1 pl-5 list-disc">
                {job.continuity.keep.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>

            <div className="bg-surface-900/60 p-3 rounded-xl border border-surface-750 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>演出上の変化 (構図・カメラ・ライティング)</span>
              </div>
              <ul className="text-[10.5px] text-slate-400 space-y-1 pl-5 list-disc">
                {job.continuity.change.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-surface-700/60 bg-surface-900/80 flex items-center justify-between text-xs">
          <div className="text-[11px] text-slate-500">
            ※決定されたキーフレームがストーリーボードおよび絵コンテリールに採用されます
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleReject}
              disabled={!candidateImage || isUploading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-600/40 transition disabled:opacity-40"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>ボツにする (Reject)</span>
            </button>

            <button
              onClick={handleRegenerate}
              disabled={isUploading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 transition disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>リセット</span>
            </button>

            <button
              onClick={handleApprove}
              disabled={!candidateImage || isUploading}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow transition disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isUploading ? '保存中...' : 'この絵で決定する (OK)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
