import React, { useRef, MouseEvent } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Music2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { TimelinePoint } from '../types/director';

interface AudioPlayerBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  trackTitle: string;
  artist: string;
  bpm: number;
  waveform?: number[];
  cuePoints?: TimelinePoint[];
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSetVolume: (volume: number) => void;
  onOpenUpload: () => void;
  isCustomTrack: boolean;
  onResetPreset?: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  trackTitle,
  artist,
  bpm,
  waveform = [],
  cuePoints = [],
  onTogglePlay,
  onSeek,
  onSetVolume,
  onOpenUpload,
  isCustomTrack,
  onResetPreset,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);

  const formatTimecode = (sec: number) => {
    if (isNaN(sec) || sec < 0) sec = 0;
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms
      .toString()
      .padStart(2, '0')}`;
  };

  const handleWaveformClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || duration <= 0) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    const seekTime = ratio * duration;
    onSeek(seekTime);
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="bg-surface-850 border-b border-surface-700/70 px-4 py-2.5 font-mono text-xs text-slate-300">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left Section: Track Metadata & Track Switching */}
        <div className="flex items-center space-x-3 min-w-[240px]">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
            {isCustomTrack ? <Sparkles className="w-4 h-4 text-emerald-400" /> : <Music2 className="w-4 h-4" />}
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-white truncate max-w-[150px]" title={trackTitle}>
                {trackTitle}
              </span>
              <span className="px-1.5 py-0.2 rounded bg-surface-750 text-indigo-300 border border-surface-700 text-[10px]">
                {bpm} BPM
              </span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">{artist}</div>
          </div>

          {(isCustomTrack || trackTitle !== '楽曲未読み込み') && onResetPreset && (
            <button
              onClick={onResetPreset}
              className="text-[10.5px] px-2 py-0.5 rounded bg-surface-800 hover:bg-surface-750 text-slate-400 hover:text-slate-200 border border-surface-700 transition"
              title="楽曲をクリアして初期状態に戻す"
            >
              クリア (Clear)
            </button>
          )}
        </div>

        {/* Center Section: Transport Controls & Interactive Waveform Scrubber */}
        <div className="flex-1 max-w-2xl w-full flex items-center space-x-3">
          {/* Play / Pause */}
          <button
            onClick={onTogglePlay}
            disabled={duration <= 0}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            } disabled:opacity-40 disabled:hover:bg-indigo-600`}
            title={isPlaying ? 'Pause Audio' : 'Play Audio'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Reset to 0:00 */}
          <button
            onClick={() => onSeek(0)}
            disabled={duration <= 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-surface-750 transition disabled:opacity-30"
            title="Restart from beginning"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Timecode */}
          <div className="font-mono text-[11px] text-slate-300 whitespace-nowrap">
            <span className="text-white font-semibold">{formatTimecode(currentTime)}</span>
            <span className="text-slate-500"> / {formatTimecode(duration)}</span>
          </div>

          {/* Interactive Waveform / Progress Scrub Bar */}
          <div
            ref={waveformRef}
            onClick={handleWaveformClick}
            className="flex-1 h-7 bg-surface-900 border border-surface-750 rounded-lg relative overflow-hidden cursor-pointer group flex items-center px-1"
            title="Click anywhere on waveform to seek"
          >
            {/* Waveform Bars */}
            <div className="absolute inset-0 flex items-center justify-between px-1.5 gap-[1.5px] pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity">
              {waveform.length > 0 ? (
                waveform.map((peak, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-full transition-all ${
                      (idx / waveform.length) * 100 <= progressPercent ? 'bg-indigo-400' : 'bg-slate-600'
                    }`}
                    style={{ height: `${Math.max(12, peak * 85)}%` }}
                  />
                ))
              ) : (
                // Fallback procedural bars if no waveform peaks
                Array.from({ length: 60 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-full ${
                      (idx / 60) * 100 <= progressPercent ? 'bg-indigo-400' : 'bg-slate-700'
                    }`}
                    style={{ height: `${20 + (Math.sin(idx * 0.4) * 0.5 + 0.5) * 60}%` }}
                  />
                ))
              )}
            </div>

            {/* Cue Point Flags on Scrubber */}
            {duration > 0 &&
              cuePoints.map((cue) => {
                const cuePos = (cue.time / duration) * 100;
                const isPassed = cue.time <= currentTime;
                return (
                  <div
                    key={cue.id}
                    style={{ left: `${cuePos}%` }}
                    className={`absolute top-0 bottom-0 w-[2px] z-10 pointer-events-none ${
                      isPassed ? 'bg-amber-400/90' : 'bg-cyan-500/70'
                    }`}
                    title={`${cue.description} (${cue.time}s)`}
                  >
                    <div
                      className={`w-1.5 h-1.5 -ml-[2px] rounded-full ${
                        isPassed ? 'bg-amber-400' : 'bg-cyan-400'
                      }`}
                    />
                  </div>
                );
              })}

            {/* Progress fill overlay */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-indigo-500/20 pointer-events-none transition-all duration-75"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Playhead line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white shadow-sm pointer-events-none transition-all duration-75 z-20"
              style={{ left: `${progressPercent}%` }}
            >
              <div className="w-2 h-2 -ml-[3px] -mt-[1px] bg-white rounded-full shadow" />
            </div>
          </div>
        </div>

        {/* Right Section: Volume & Upload Button */}
        <div className="flex items-center space-x-3">
          {/* Volume Control */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => onSetVolume(volume > 0 ? 0 : 0.8)}
              className="text-slate-400 hover:text-slate-200 transition"
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onSetVolume(parseFloat(e.target.value))}
              className="w-16 h-1 bg-surface-750 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              title={`Volume: ${(volume * 100).toFixed(0)}%`}
            />
          </div>

          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition text-xs font-semibold"
            title="Import custom audio file (MP3 / WAV)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Track</span>
          </button>
        </div>
      </div>
    </div>
  );
};
