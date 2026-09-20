import React, { useState, useEffect } from 'react';
import {
  Film,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Play,
  Download,
  AlertCircle,
  Key,
  Layers,
  Clock,
  Video,
  X,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  hailuoVideoService,
  HailuoConfigResponse,
} from '../../services/video/HailuoVideoService';

interface HailuoGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  shotIndex: number;
  timeRange: string;
  durationSec: number;
  prompt: string;
  keyframePath?: string;
  characterName?: string;
  onVideoGenerated?: (shotIndex: number, videoUrl: string) => void;
}

export const HailuoGenerationModal: React.FC<HailuoGenerationModalProps> = ({
  isOpen,
  onClose,
  shotIndex,
  timeRange,
  durationSec,
  prompt,
  keyframePath,
  characterName = 'Character',
  onVideoGenerated,
}) => {
  const [config, setConfig] = useState<HailuoConfigResponse | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('MiniMax-Hailuo-02');
  const [videoDuration, setVideoDuration] = useState<number>(6);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Task execution state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setApiKey(hailuoVideoService.getStoredApiKey());
      setSelectedModel(hailuoVideoService.getPreferredModel());
      hailuoVideoService.getConfig().then(setConfig);

      // Check if video already exists for this shot
      fetch(`/api/hailuo/video?shotIndex=${shotIndex}`)
        .then((res) => {
          if (res.ok) {
            setGeneratedVideoUrl(`/api/hailuo/video?shotIndex=${shotIndex}&t=${Date.now()}`);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, shotIndex]);

  // Elapsed timer when processing
  useEffect(() => {
    let interval: any;
    if (isSubmitting) {
      interval = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    } else {
      setElapsedSec(0);
    }
    return () => clearInterval(interval);
  }, [isSubmitting]);

  if (!isOpen) return null;

  const handleSaveApiKey = (val: string) => {
    setApiKey(val);
    hailuoVideoService.setStoredApiKey(val);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  };

  const handleOpenWebUI = async () => {
    await handleCopyPrompt();
    window.open('https://hailuoai.video/', '_blank');
  };

  const handleStartGeneration = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusText('MiniMax APIへ動画生成タスクを発行中...');

    try {
      const activeKey = apiKey.trim() ? apiKey.trim() : undefined;
      const genRes = await hailuoVideoService.generateVideo({
        shotIndex,
        prompt,
        keyframePath,
        model: selectedModel,
        duration: videoDuration,
        apiKey: activeKey,
      });

      if (!genRes.taskId) {
        throw new Error(genRes.message || 'タスクIDが取得できませんでした');
      }

      setTaskId(genRes.taskId);
      setStatusText(`タスク発行完了 (Task ID: ${genRes.taskId})。動画レンダリングを監視中...`);

      // Poll until complete
      const finalResult = await hailuoVideoService.pollUntilComplete(
        genRes.taskId,
        activeKey,
        (status, attempt) => {
          if (status === 'Preparing') {
            setStatusText(`キュー待機中 (Preparing) [確認回数: ${attempt}回]...`);
          } else if (status === 'Processing') {
            setStatusText(`MiniMax AI GPUにて動画生成中 (Processing) [経過: ${attempt * 5}秒]...`);
          } else if (status === 'Success') {
            setStatusText('動画生成完了！MP4をダウンロードして保存中...');
          }
        }
      );

      if (finalResult.status === 'Success' && finalResult.videoUrl) {
        const fullUrl = `${finalResult.videoUrl}&t=${Date.now()}`;
        setGeneratedVideoUrl(fullUrl);
        setStatusText('動画生成および保存が完了しました！');
        if (onVideoGenerated) {
          onVideoGenerated(shotIndex, fullUrl);
        }
      } else {
        throw new Error(finalResult.message || '動画生成に失敗しました');
      }
    } catch (err: any) {
      console.error('Video generation error:', err);
      setErrorMessage(err.message || '動画生成中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between bg-surface-850">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Hailuo AI (MiniMax) Video Generation Bridge
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                  I2V Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Shot #{shotIndex} ({timeRange} • {durationSec.toFixed(2)}s) — {characterName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-750 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Keyframe & Prompt */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Video className="w-3.5 h-3.5 text-indigo-400" />
                    <span>入力キーフレーム (First Frame)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{keyframePath || 'Default Keyframe'}</span>
                </div>
                <div className="aspect-video w-full rounded-xl bg-surface-950 border border-surface-750 overflow-hidden relative shadow-inner flex items-center justify-center group">
                  {keyframePath ? (
                    <img
                      src={`/${keyframePath}`}
                      alt={`Shot #${shotIndex} Keyframe`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-slate-500 text-center p-4">
                      <Film className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <span>キーフレーム画像未指定</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white font-mono text-[10px]">
                    Shot #{shotIndex}
                  </div>
                </div>
              </div>

              {/* Video Generation Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>最適化済み動画プロンプト (I2V Prompt)</span>
                  </span>
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center space-x-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'コピー完了' : 'プロンプトをコピー'}</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-surface-950 border border-surface-750 text-slate-300 font-mono text-[11px] leading-relaxed max-h-44 overflow-y-auto">
                  {prompt}
                </div>
              </div>
            </div>

            {/* Right Column: Settings, API Key, Generation Controls */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                {/* API Key Configuration */}
                <div className="p-3.5 rounded-xl bg-surface-850 border border-surface-750 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>MiniMax Developer API Key</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      {config?.hasEnvKey && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          .env連携中
                        </span>
                      )}
                      {apiKey && (
                        <button
                          type="button"
                          onClick={() => handleSaveApiKey('')}
                          className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                          title="ブラウザ保存キーを消去して.envキーを使用"
                        >
                          クリア (.envを使用)
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="password"
                    placeholder={config?.hasEnvKey ? '.envのMINIMAX_API_KEYを使用中 (空欄でOK)' : 'sk-cp-... (API Keyを入力)'}
                    value={apiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-950 border border-surface-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 transition"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>キーはブラウザに安全に保存されます</span>
                    <a
                      href="https://platform.minimaxi.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline flex items-center space-x-0.5"
                    >
                      <span>APIキー取得</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                {/* Model & Duration Selectors */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5 flex items-center space-x-1">
                      <Layers className="w-3 h-3 text-fuchsia-400" />
                      <span>動画モデル</span>
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        const newModel = e.target.value;
                        setSelectedModel(newModel);
                        hailuoVideoService.setPreferredModel(newModel);
                        if (!newModel.startsWith('MiniMax-H3') && videoDuration === 5) {
                          setVideoDuration(6);
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-lg bg-surface-850 border border-surface-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="MiniMax-Hailuo-02">Hailuo 02 (Balanced / 標準)</option>
                      <option value="MiniMax-Hailuo-2.3">Hailuo 2.3 (Cinematic / 高画質)</option>
                      <option value="MiniMax-H3">MiniMax H3 (Multimodal 2K / 要Plan)</option>
                      <option value="MiniMax-H3-Max">MiniMax H3 Max (Flagship / 要Plan)</option>
                    </select>
                    {(selectedModel === 'MiniMax-H3' || selectedModel === 'MiniMax-H3-Max') && (
                      <p className="text-[10px] text-amber-400/90 mt-1 leading-tight">
                        ※ H3系APIはMiniMaxアカウントの専用TokenPlan加入が必要です (未加入時はWeb版を推奨)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>動画の長さ</span>
                    </label>
                    <select
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-lg bg-surface-850 border border-surface-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                    >
                      {selectedModel.startsWith('MiniMax-H3') && (
                        <option value={5}>5 秒 (H3 Fast)</option>
                      )}
                      <option value={6}>6 秒 (Standard / Hailuo推奨)</option>
                      <option value={10}>10 秒 (Extended)</option>
                    </select>
                  </div>
                </div>

                {/* Progress / Status Panel */}
                {(isSubmitting || statusText || errorMessage) && (
                  <div className={`p-3 rounded-xl border ${
                    errorMessage
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
                  } space-y-2 text-xs`}>
                    <div className="flex items-center space-x-2">
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      ) : errorMessage ? (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Check className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className="font-semibold">{isSubmitting ? `動画生成中 (${elapsedSec}s)` : errorMessage ? 'エラー' : 'ステータス'}</span>
                    </div>
                    <div className="text-[11px] leading-relaxed">
                      {errorMessage || statusText}
                    </div>
                  </div>
                )}

                {/* Generated Video Player */}
                {generatedVideoUrl && !isSubmitting && (
                  <div className="p-3 rounded-xl bg-surface-950 border border-emerald-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>生成済み動画プレビュー</span>
                      </span>
                      <a
                        href={generatedVideoUrl}
                        download={`hailuo-shot-${shotIndex}.mp4`}
                        className="flex items-center space-x-1 text-[11px] text-emerald-400 hover:text-emerald-300"
                      >
                        <Download className="w-3 h-3" />
                        <span>MP4保存</span>
                      </a>
                    </div>
                    <video
                      controls
                      autoPlay
                      loop
                      src={generatedVideoUrl}
                      className="w-full rounded-lg max-h-44 bg-black object-contain shadow"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleStartGeneration}
                  disabled={isSubmitting || (!apiKey && !config?.hasEnvKey)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white font-semibold flex items-center justify-center space-x-2 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Hailuo AI レンダリング中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Hailuo AI API で動画を生成</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleOpenWebUI}
                  className="w-full py-2 px-4 rounded-xl bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 flex items-center justify-center space-x-2 transition text-xs"
                  title="プロンプトをクリップボードにコピーしてWeb版 (hailuoai.video) を開きます"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Web版 (hailuoai.video) で開いて無料クレジットで生成</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
