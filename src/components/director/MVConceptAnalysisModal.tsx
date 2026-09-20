import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Music,
  User,
  CheckCircle2,
  Sliders,
  X,
  Palette,
  Layers,
  Flame,
  Clock,
  Compass,
  Zap,
  ArrowRight,
  ShieldCheck,
  Edit3,
} from 'lucide-react';
import { CharacterProfile } from '../../types/codexBridge';
import {
  mvConceptService,
  MVConcept,
  MVAnalysisResult,
} from '../../services/director/MVConceptService';

export interface MVConceptAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle: string;
  bpm: number;
  duration: number;
  character?: CharacterProfile | null;
  onConceptApplied: (concept: MVConcept) => void;
  currentConcept?: MVConcept | null;
}

export const MVConceptAnalysisModal: React.FC<MVConceptAnalysisModalProps> = ({
  isOpen,
  onClose,
  trackTitle,
  bpm,
  duration,
  character,
  onConceptApplied,
  currentConcept,
}) => {
  const [analysis, setAnalysis] = useState<MVAnalysisResult | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string>('sacred-sanctuary');
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);
  const [customStage, setCustomStage] = useState<string>('');
  const [customMood, setCustomMood] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const result = mvConceptService.analyzeAndGenerateConcepts({
        trackTitle,
        bpm,
        duration,
        character,
      });
      setAnalysis(result);

      if (currentConcept) {
        setSelectedConceptId(currentConcept.id);
        setCustomStage(currentConcept.stageSetting);
        setCustomMood(currentConcept.moodTone);
      } else {
        setSelectedConceptId(result.defaultConceptId);
        const defaultConcept = result.concepts.find((c) => c.id === result.defaultConceptId);
        if (defaultConcept) {
          setCustomStage(defaultConcept.stageSetting);
          setCustomMood(defaultConcept.moodTone);
        }
      }
    }
  }, [isOpen, trackTitle, bpm, duration, character, currentConcept]);

  if (!isOpen || !analysis) return null;

  const selectedConcept =
    analysis.concepts.find((c) => c.id === selectedConceptId) || analysis.concepts[0];

  const handleSelectConcept = (c: MVConcept) => {
    setSelectedConceptId(c.id);
    setCustomStage(c.stageSetting);
    setCustomMood(c.moodTone);
  };

  const handleConfirm = () => {
    const finalConcept: MVConcept = {
      ...selectedConcept,
      stageSetting: customStage.trim() || selectedConcept.stageSetting,
      moodTone: customMood.trim() || selectedConcept.moodTone,
    };
    onConceptApplied(finalConcept);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden font-mono text-slate-100">
        
        {/* 1. Modal Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AntiGravity AI Director: MV Concept & Direction Analysis
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>AntiGravity Directing</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                AntiGravityが楽曲の音響特徴（BPM・展開）とキャラクター原案を直接解析し、最適なMV世界観・演出コンセプトを提案します
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Top Cross-Analysis Telemetry Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Audio Telemetry Card */}
            <div className="bg-surface-850 border border-surface-750/70 rounded-xl p-3.5 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between text-xs border-b border-surface-750 pb-2">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Music className="w-3.5 h-3.5 text-indigo-400" />
                  1. 楽曲音響シグネチャ解析 (Acoustic Profile)
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                  {analysis.trackSummary.tempoCategory}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-surface-900/90 border border-surface-750 p-2 rounded-lg">
                  <div className="text-[9.5px] text-slate-400 font-semibold">TEMPO</div>
                  <div className="text-sm font-bold text-amber-300">{analysis.trackSummary.bpm} BPM</div>
                </div>
                <div className="bg-surface-900/90 border border-surface-750 p-2 rounded-lg">
                  <div className="text-[9.5px] text-slate-400 font-semibold">LENGTH</div>
                  <div className="text-sm font-bold text-cyan-300">{analysis.trackSummary.durationSec.toFixed(1)}s</div>
                </div>
                <div className="bg-surface-900/90 border border-surface-750 p-2 rounded-lg">
                  <div className="text-[9.5px] text-slate-400 font-semibold">MAIN DROP / CLIMAX</div>
                  <div className="text-sm font-bold text-rose-300">
                    @{analysis.trackSummary.dropTimeSec?.toFixed(1) || '20.2'}s
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed bg-surface-900/60 p-2 rounded border border-surface-750">
                <strong className="text-indigo-300">音響特性:</strong> {analysis.trackSummary.energyProfile}
              </p>
            </div>

            {/* Character Analysis Card */}
            <div className="bg-surface-850 border border-surface-750/70 rounded-xl p-3.5 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between text-xs border-b border-surface-750 pb-2">
                <span className="font-bold text-purple-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  2. キャラクター原案 & 属性解析 (Visual Identity)
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                  ACTIVE
                </span>
              </div>

              <div className="flex items-center space-x-3">
                {analysis.characterSummary.identityRef ? (
                  <img
                    src={`/api/codex/image?path=${encodeURIComponent(analysis.characterSummary.identityRef)}`}
                    alt={analysis.characterSummary.name}
                    className="w-14 h-14 rounded-xl object-cover border border-purple-500/40 shadow flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-400 flex-shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                )}

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white truncate">
                      {analysis.characterSummary.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-surface-900 text-purple-300 border border-surface-750 font-semibold truncate">
                      {analysis.characterSummary.archetype}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 line-clamp-2 leading-tight">
                    {analysis.characterSummary.visualTraits}
                  </p>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 bg-surface-900/60 p-2 rounded border border-surface-750 flex items-center justify-between">
                <span>Continuity 束縛: <strong className="text-emerald-300">有効 (全カット同一人物保証)</strong></span>
                <span className="text-purple-300">Style: Anime Keyframe</span>
              </div>
            </div>

          </div>

          {/* 3. AI Director's MV Concept Proposals */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  AIディレクターが提案する3つのMV演出コンセプト
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  楽曲のビートとキャラクターの魅力を最大化する世界観・舞台設定をお選びください
                </p>
              </div>

              <button
                onClick={() => setIsCustomizing((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 text-xs flex items-center space-x-1.5 transition"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isCustomizing ? 'カスタム欄を閉じる' : '舞台設定を細かく調整'}</span>
              </button>
            </div>

            {/* 3 Concept Proposal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              {analysis.concepts.map((concept, idx) => {
                const isSelected = concept.id === selectedConceptId;
                const isRecommended = idx === 0;

                return (
                  <div
                    key={concept.id}
                    onClick={() => handleSelectConcept(concept)}
                    className={`rounded-xl border p-4 flex flex-col justify-between cursor-pointer transition-all relative ${
                      isSelected
                        ? 'bg-gradient-to-b from-indigo-950/70 to-surface-900 border-indigo-500 shadow-xl ring-2 ring-indigo-500/50 scale-[1.02]'
                        : 'bg-surface-850/90 border-surface-750 hover:border-slate-500 hover:bg-surface-800/80 opacity-85 hover:opacity-100'
                    }`}
                  >
                    {/* Recommended Badge */}
                    {isRecommended && (
                      <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[9.5px] shadow flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 fill-slate-950" />
                        <span>AI RECOMMENDED</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* Concept Header */}
                      <div>
                        <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">
                          {concept.genre}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-0.5 flex items-center justify-between">
                          <span>{concept.title}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                        </h4>
                        <p className="text-[10px] text-slate-400 italic mt-0.5">
                          {concept.englishTitle}
                        </p>
                      </div>

                      {/* Stage & Environment */}
                      <div className="bg-surface-900/90 border border-surface-750/80 rounded-lg p-2.5 text-xs space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase">
                          舞台・ロケーション
                        </span>
                        <p className="text-[11px] text-slate-200 leading-relaxed font-sans">
                          {concept.stageSetting}
                        </p>
                      </div>

                      {/* Color Palette Swatches */}
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase">
                          カラースキーム
                        </span>
                        <div className="flex items-center space-x-1.5">
                          {concept.colorPalette.map((color, cIdx) => (
                            <div
                              key={cIdx}
                              className="w-6 h-5 rounded border border-white/20 shadow-sm"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                          <span className="text-[10px] text-slate-400 ml-1 truncate">
                            {concept.moodTone}
                          </span>
                        </div>
                      </div>

                      {/* 4-Phase Story Arc */}
                      <div className="bg-surface-900/60 border border-surface-750/60 rounded-lg p-2 text-[10.5px] space-y-1 font-sans">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase font-mono">
                          曲の展開と演出ストーリー
                        </span>
                        <div className="space-y-0.5 text-slate-300">
                          <div className="truncate">
                            <strong className="text-amber-400 font-mono">01. 導入:</strong> {concept.storyArc.intro}
                          </div>
                          <div className="truncate">
                            <strong className="text-cyan-400 font-mono">02. 高揚:</strong> {concept.storyArc.build}
                          </div>
                          <div className="truncate">
                            <strong className="text-rose-400 font-mono">03. サビ:</strong> {concept.storyArc.climax}
                          </div>
                          <div className="truncate">
                            <strong className="text-purple-400 font-mono">04. 結び:</strong> {concept.storyArc.outro}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Radio Select Button */}
                    <div className="pt-3 border-t border-surface-750/70 mt-3 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-500">
                        Keywords: {concept.visualKeywords.slice(0, 3).join(', ')}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? 'text-indigo-400' : 'text-slate-400'
                        }`}
                      >
                        {isSelected ? '選択中' : '選択する'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional Custom Adjustment Drawer */}
          {isCustomizing && (
            <div className="bg-surface-850 border border-indigo-500/40 rounded-xl p-4 space-y-3 animate-in fade-in duration-150 shadow-inner">
              <div className="flex items-center justify-between border-b border-surface-750 pb-2">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  選択したコンセプトの舞台・演出トーンをカスタマイズ
                </span>
                <span className="text-[10px] text-slate-500">自由編集可能</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-semibold text-slate-300 block mb-1">
                    舞台背景・シチュエーション設定 (Stage Setting)
                  </label>
                  <textarea
                    rows={2}
                    value={customStage}
                    onChange={(e) => setCustomStage(e.target.value)}
                    className="w-full bg-surface-900 border border-surface-750 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                    placeholder="例: 夕暮れの廃墟、雨の繁華街、ステンドグラスの大聖堂など"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-semibold text-slate-300 block mb-1">
                    演出トーン & 感情の雰囲気 (Mood Tone)
                  </label>
                  <textarea
                    rows={2}
                    value={customMood}
                    onChange={(e) => setCustomMood(e.target.value)}
                    className="w-full bg-surface-900 border border-surface-750 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                    placeholder="例: 荘厳、エモーショナル、疾走感、儚いノスタルジアなど"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* 4. Modal Footer: Confirmation Action */}
        <div className="px-6 py-4 border-t border-surface-800 flex items-center justify-between bg-surface-950/70 flex-wrap gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              確定した世界観は全カットのキーフレーム作画プロンプトおよび動画生成プロンプトに一貫適用されます
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 text-xs font-semibold transition"
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg flex items-center space-x-2 transition transform active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>このMVコンセプトで制作を開始する</span>
              <ArrowRight className="w-4 h-4 text-indigo-200" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
