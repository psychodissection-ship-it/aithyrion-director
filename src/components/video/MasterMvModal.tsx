import React, { useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  Download,
  Sparkles,
  Volume2,
  VolumeX,
  Maximize2,
  Film,
  Zap,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

export interface MasterMvModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  trackTitle?: string;
  artist?: string;
  onRebuild?: () => void;
  isRebuilding?: boolean;
}

export const MasterMvModal: React.FC<MasterMvModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  trackTitle = 'Track',
  artist = 'Artist',
  onRebuild,
  isRebuilding = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(isNaN(p) ? 0 : p);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `master_mv_${trackTitle.toLowerCase().replace(/\s+/g, '_')}.mp4`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-5xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden font-mono text-slate-100">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-surface-800 flex items-center justify-between bg-surface-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Master Music Video (完成版MVマスター)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Audio & Beat Synced</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {trackTitle} &bull; {artist} &bull; Full Concat + AAC 320k Mix + VJ Master Grade
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-950/40 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>MP4をダウンロード</span>
            </button>
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player Area */}
        <div className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-center bg-black/40 overflow-hidden">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-surface-800 shadow-2xl flex items-center justify-center group">
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              loop
              playsInline
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full object-contain"
            />

            {/* Custom Bottom Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 flex flex-col space-y-2 opacity-90 group-hover:opacity-100 transition">
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between text-xs text-slate-200">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={togglePlay}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition text-white"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition text-white"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <span className="text-[11px] text-slate-300 font-mono">
                    Master Track (Beat Synced VJ Mix)
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleFullscreen}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition text-white"
                    title="全画面表示"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* VJ Effects Applied Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full mt-4">
            <div className="p-2.5 rounded-xl bg-surface-950/80 border border-surface-800 text-[11px] flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-200">White Flash</p>
                <p className="text-[10px] text-slate-400">カット切り替え閃光</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-950/80 border border-surface-800 text-[11px] flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-200">Cyber Grade</p>
                <p className="text-[10px] text-slate-400">ネオンシネマ調色</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-950/80 border border-surface-800 text-[11px] flex items-center space-x-2">
              <Film className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-200">Beat Conform</p>
                <p className="text-[10px] text-slate-400">尺自動ループ調整</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-950/80 border border-surface-800 text-[11px] flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-200">AAC 320kbps</p>
                <p className="text-[10px] text-slate-400">最高音質オーディオ</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-800 bg-surface-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            出力ファイル: <code className="text-indigo-300 font-mono">public/master_mv.mp4</code>
          </div>
          <div className="flex items-center space-x-2">
            {onRebuild && (
              <button
                onClick={onRebuild}
                disabled={isRebuilding}
                className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-200 border border-surface-700 text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-cyan-400 ${isRebuilding ? 'animate-spin' : ''}`} />
                <span>{isRebuilding ? '再書き出し中...' : '再レンダリング'}</span>
              </button>
            )}
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>保存する</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
