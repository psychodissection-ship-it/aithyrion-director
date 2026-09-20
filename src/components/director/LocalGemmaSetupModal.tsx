import React, { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Terminal,
  Zap,
} from 'lucide-react';
import { LocalGemmaStatus, JevEngineMode } from '../../types/director';

interface LocalGemmaSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: JevEngineMode;
  onSelectMode: (mode: JevEngineMode) => Promise<void>;
  onRefreshHealth: () => Promise<void>;
}

export const LocalGemmaSetupModal: React.FC<LocalGemmaSetupModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
  onRefreshHealth,
}) => {
  const [status, setStatus] = useState<LocalGemmaStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jev/gemma-status');
      if (res.ok) {
        const data: LocalGemmaStatus = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.warn('Failed to fetch Gemma status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleActivateGemma = async () => {
    await onSelectMode('LOCAL_GEMMA');
    await onRefreshHealth();
    onClose();
  };

  const handleActivateCloud = async () => {
    await onSelectMode('LIVE_REMOTE');
    await onRefreshHealth();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden font-mono text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Local Gemma (OpenJev) 設定
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                  System 1 Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Google Gemma (2B) をPC上で実行し、完全無料・オフラインでAIディレクターを駆動します
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

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] text-xs">
          
          {/* Status Banner */}
          <div className="bg-surface-850 border border-surface-750 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                <span>ローカル稼働ステータス</span>
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
              </span>
              <button
                onClick={fetchStatus}
                disabled={loading}
                className="px-2.5 py-1 rounded bg-surface-800 hover:bg-surface-750 text-slate-300 hover:text-white transition text-[11px] flex items-center space-x-1.5 border border-surface-700"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>再チェック</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-surface-900/80 rounded-lg border border-surface-800">
                <div className="text-[11px] text-slate-400 mb-1">Ollama デーモン</div>
                <div className="flex items-center space-x-2">
                  {status?.ollamaOnline ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-emerald-300">起動中 (Online)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span className="font-bold text-rose-300">未検出 (Offline)</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 bg-surface-900/80 rounded-lg border border-surface-800">
                <div className="text-[11px] text-slate-400 mb-1">Gemma モデル</div>
                <div className="flex items-center space-x-2">
                  {status?.gemmaAvailable ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-emerald-300 truncate" title={status.modelName}>
                        {status.modelName || 'gemma2:2b'}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-amber-300">モデル未導入</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Setup Guide if Offline or Model Missing */}
          {(!status?.ollamaOnline || !status?.gemmaAvailable) && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs">
                <Terminal className="w-4 h-4" />
                <span>かんたんセットアップ手順 (ターミナルで実行)</span>
              </div>

              {/* Step 1 */}
              <div className="p-4 bg-surface-850 border border-surface-750 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">1. Ollama のインストール</span>
                  <a
                    href="https://ollama.com/download/windows"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center space-x-1"
                  >
                    <span>公式サイト</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-400">
                  PowerShell で下記を実行するか、公式サイトからインストーラーをダウンロードします：
                </p>
                <div className="flex items-center justify-between p-2.5 bg-surface-950 rounded-lg border border-surface-800">
                  <code className="text-cyan-300 text-xs">winget install Ollama.Ollama</code>
                  <button
                    onClick={() => copyToClipboard('winget install Ollama.Ollama', 'step1')}
                    className="p-1 rounded hover:bg-surface-800 text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'step1' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 bg-surface-850 border border-surface-750 rounded-xl space-y-2">
                <span className="font-bold text-slate-200">2. Gemma 2B モデルのダウンロード & 起動</span>
                <p className="text-[11px] text-slate-400">
                  ターミナルで下記を実行します（約1.6GBダウンロード後に自動起動します）：
                </p>
                <div className="flex items-center justify-between p-2.5 bg-surface-950 rounded-lg border border-surface-800">
                  <code className="text-cyan-300 text-xs">ollama run gemma2:2b</code>
                  <button
                    onClick={() => copyToClipboard('ollama run gemma2:2b', 'step2')}
                    className="p-1 rounded hover:bg-surface-800 text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'step2' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  ※現在のPC（Ryzen 7 + RX 5500M 4GB）の VRAM 内に丸ごと収まり、超高速で動作します。
                </p>
              </div>
            </div>
          )}

          {/* Engine Selection Section */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-semibold text-slate-300">アクティブエンジンの選択</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Local Gemma Card */}
              <div
                onClick={() => status?.ollamaOnline && handleActivateGemma()}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-2 ${
                  currentMode === 'LOCAL_GEMMA'
                    ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500'
                    : status?.ollamaOnline
                    ? 'bg-surface-850 border-surface-750 hover:border-cyan-500/40'
                    : 'bg-surface-950/40 border-surface-800 opacity-60 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>Local Gemma (OpenJev)</span>
                    </span>
                    {currentMode === 'LOCAL_GEMMA' && (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    完全ローカル・無料・オフライン。Ollama経由でミリ秒単位の判断を実行。
                  </p>
                </div>
                <div className="text-[10px] text-cyan-400/80 pt-1">
                  {status?.ollamaOnline ? '● 接続可能' : '○ Ollama 未起動'}
                </div>
              </div>

              {/* Cloud TypeSafe AI Card */}
              <div
                onClick={handleActivateCloud}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-2 ${
                  currentMode === 'LIVE_REMOTE'
                    ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/30 ring-1 ring-purple-500'
                    : 'bg-surface-850 border-surface-750 hover:border-purple-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white flex items-center space-x-1.5">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      <span>TypeSafe AI (Cloud)</span>
                    </span>
                    {currentMode === 'LIVE_REMOTE' && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    公式 JEV SystemOne クラウド API。高度に校正された確率分布と確信度。
                  </p>
                </div>
                <div className="text-[10px] text-purple-400/80 pt-1">
                  ● クラウド API (api.typesafe.ai)
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-surface-950 border-t border-surface-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            現在: <span className="text-white font-bold">{currentMode}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              閉じる
            </button>
            {status?.ollamaOnline && currentMode !== 'LOCAL_GEMMA' && (
              <button
                onClick={handleActivateGemma}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950/50 transition flex items-center space-x-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Local Gemma に切り替え</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
