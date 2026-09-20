import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  DragEvent,
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import {
  UploadCloud,
  Music,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Play,
  Square,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MoveHorizontal,
  Users,
  Upload,
  Plus,
  User,
  Check,
  Palette,
  MapPin,
  Shirt,
} from 'lucide-react';
import { audioAnalyzer, AnalyzedTrackData } from '../services/audio/AudioAnalyzer';
import {
  CharacterProfile,
  continuityManager,
} from '../services/codex/ContinuityManager';

interface AudioDropzoneProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackAnalyzed: (
    track: AnalyzedTrackData,
    file: File,
    character?: CharacterProfile
  ) => void;
}

type ProcessingStep =
  | 'IDLE'
  | 'READING'
  | 'DECODING'
  | 'TRIMMING'
  | 'CHARACTER_SETUP'
  | 'ANALYZING_DSP'
  | 'EXTRACTING_CUES'
  | 'COMPLETE'
  | 'ERROR';

type DragTarget = 'START' | 'END' | 'WINDOW' | 'PLAYHEAD' | null;

export const AudioDropzone: React.FC<AudioDropzoneProps> = ({
  isOpen,
  onClose,
  onTrackAnalyzed,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [step, setStep] = useState<ProcessingStep>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  // Audio Buffer & Trimming States
  const [rawBuffer, setRawBuffer] = useState<AudioBuffer | null>(null);
  const [rawWaveform, setRawWaveform] = useState<number[]>([]);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(30);
  const [playheadSec, setPlayheadSec] = useState<number>(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);

  // Zoom State
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Dragging State
  const [activeDrag, setActiveDrag] = useState<DragTarget>(null);

  // Character Setup States
  const [roster, setRoster] = useState<CharacterProfile[]>(continuityManager.getCharacters());
  const [selectedChar, setSelectedChar] = useState<CharacterProfile>(continuityManager.getActiveCharacter());
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newCostume, setNewCostume] = useState<string>('Tactical Cyber Hoodie & Combat Gear');
  const [newLocation, setNewLocation] = useState<string>('Neo-Tokyo High-Altitude Spire');
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [newImageDataUrl, setNewImageDataUrl] = useState<string | null>(null);
  const [isSavingChar, setIsSavingChar] = useState<boolean>(false);
  const charImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      continuityManager.syncWithServer().then((list) => {
        setRoster(list);
        setSelectedChar(continuityManager.getActiveCharacter());
      });
    }
  }, [isOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioCtxRef = useRef<AudioContext | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewStartedAtRef = useRef<number>(0);
  const previewOffsetSecRef = useRef<number>(0);
  const playheadSecRef = useRef<number>(0);
  playheadSecRef.current = playheadSec;
  const previewAnimFrameRef = useRef<number | null>(null);

  const waveformScrollRef = useRef<HTMLDivElement>(null);
  const waveformInnerRef = useRef<HTMLDivElement>(null);

  // Drag tracking refs
  const dragInfoRef = useRef<{
    target: DragTarget;
    startX: number;
    initialTrimStart: number;
    initialTrimEnd: number;
    totalDuration: number;
  } | null>(null);

  const stopPreviewAudio = useCallback((resetToStart: boolean = false) => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch {}
      previewSourceRef.current = null;
    }
    if (previewAnimFrameRef.current) {
      cancelAnimationFrame(previewAnimFrameRef.current);
      previewAnimFrameRef.current = null;
    }
    setIsPreviewPlaying(false);
    if (resetToStart) {
      setPlayheadSec(trimStart);
    }
  }, [trimStart]);

  // Clean up preview audio on unmount
  useEffect(() => {
    return () => {
      stopPreviewAudio();
      if (previewAudioCtxRef.current && previewAudioCtxRef.current.state !== 'closed') {
        previewAudioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopPreviewAudio]);

  /**
   * Start preview audio at a specific timestamp within [trimStart, trimEnd]
   */
  const startPreviewAudio = useCallback(
    (startOffsetSec?: number) => {
      if (!rawBuffer) return;

      // Stop previous instance without resetting playhead
      if (previewSourceRef.current) {
        try {
          previewSourceRef.current.stop();
          previewSourceRef.current.disconnect();
        } catch {}
        previewSourceRef.current = null;
      }
      if (previewAnimFrameRef.current) {
        cancelAnimationFrame(previewAnimFrameRef.current);
        previewAnimFrameRef.current = null;
      }

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!previewAudioCtxRef.current || previewAudioCtxRef.current.state === 'closed') {
          previewAudioCtxRef.current = new AudioCtx();
        }
        const ctx = previewAudioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        let effectiveStart =
          typeof startOffsetSec === 'number' ? startOffsetSec : playheadSecRef.current;
        if (effectiveStart >= trimEnd || effectiveStart < trimStart) {
          effectiveStart = trimStart;
        }

        const duration = Math.max(0.1, trimEnd - effectiveStart);
        const source = ctx.createBufferSource();
        source.buffer = rawBuffer;
        source.connect(ctx.destination);

        source.start(0, effectiveStart, duration);
        previewSourceRef.current = source;
        setIsPreviewPlaying(true);
        setPlayheadSec(effectiveStart);

        previewStartedAtRef.current = ctx.currentTime;
        previewOffsetSecRef.current = effectiveStart;

        source.onended = () => {
          setIsPreviewPlaying(false);
          setPlayheadSec(trimStart);
        };

        const updateProgress = () => {
          if (!previewSourceRef.current) return;
          const elapsed = ctx.currentTime - previewStartedAtRef.current;
          const currentPos = previewOffsetSecRef.current + elapsed;
          if (currentPos >= trimEnd) {
            stopPreviewAudio(true);
            return;
          }
          setPlayheadSec(currentPos);
          previewAnimFrameRef.current = requestAnimationFrame(updateProgress);
        };
        previewAnimFrameRef.current = requestAnimationFrame(updateProgress);
      } catch (err) {
        console.error('Failed to play preview audio:', err);
        stopPreviewAudio(true);
      }
    },
    [rawBuffer, stopPreviewAudio, trimEnd, trimStart]
  );

  /**
   * Toggle preview playback
   */
  const togglePreviewAudio = useCallback(() => {
    if (isPreviewPlaying) {
      stopPreviewAudio(false);
    } else {
      startPreviewAudio(playheadSec);
    }
  }, [isPreviewPlaying, playheadSec, startPreviewAudio, stopPreviewAudio]);

  /**
   * Seek playhead to a specific timestamp
   */
  const seekTo = useCallback(
    (targetSec: number, resumeIfPlaying: boolean = true) => {
      const clamped = Math.max(trimStart, Math.min(trimEnd, targetSec));
      const rounded = +clamped.toFixed(2);
      setPlayheadSec(rounded);
      if (isPreviewPlaying && resumeIfPlaying) {
        startPreviewAudio(rounded);
      }
    },
    [isPreviewPlaying, startPreviewAudio, trimEnd, trimStart]
  );

  // Keep playhead within trimStart and trimEnd if crop boundaries shift
  useEffect(() => {
    if (playheadSec < trimStart || playheadSec > trimEnd) {
      setPlayheadSec(trimStart);
    }
  }, [trimStart, trimEnd, playheadSec]);

  // Ref to hold latest togglePreviewAudio to avoid 60fps event listener re-binding (C-7 fix)
  const togglePreviewAudioRef = useRef(togglePreviewAudio);
  useEffect(() => {
    togglePreviewAudioRef.current = togglePreviewAudio;
  }, [togglePreviewAudio]);

  // Spacebar listener when in TRIMMING mode
  useEffect(() => {
    if (!isOpen || step !== 'TRIMMING') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextInput =
        (target instanceof HTMLInputElement &&
          target.type !== 'range' &&
          target.type !== 'checkbox' &&
          target.type !== 'radio') ||
        target instanceof HTMLTextAreaElement;
      const isInteractiveElement =
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement ||
        target.closest?.('button, a, [role="button"]') != null;

      if (isTextInput || isInteractiveElement) return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePreviewAudioRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step]);

  // Global mousemove and mouseup listeners for direct waveform dragging & seeking
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragInfoRef.current || !waveformInnerRef.current) return;

      const { target, startX, initialTrimStart, initialTrimEnd, totalDuration } = dragInfoRef.current;
      const rect = waveformInnerRef.current.getBoundingClientRect();
      const innerWidth = rect.width;
      if (innerWidth <= 0) return;

      if (target === 'PLAYHEAD') {
        const mouseX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, mouseX / innerWidth));
        const targetSec = ratio * totalDuration;
        const clamped = Math.max(trimStart, Math.min(trimEnd, targetSec));
        setPlayheadSec(+clamped.toFixed(2));
        return;
      }

      const deltaX = e.clientX - startX;
      const deltaSec = (deltaX / innerWidth) * totalDuration;

      if (target === 'START') {
        const newStart = Math.max(0, Math.min(initialTrimStart + deltaSec, initialTrimEnd - 0.5));
        setTrimStart(+newStart.toFixed(2));
      } else if (target === 'END') {
        const newEnd = Math.max(initialTrimStart + 0.5, Math.min(initialTrimEnd + deltaSec, totalDuration));
        setTrimEnd(+newEnd.toFixed(2));
      } else if (target === 'WINDOW') {
        const windowLength = initialTrimEnd - initialTrimStart;
        const rawNewStart = initialTrimStart + deltaSec;
        const clampedStart = Math.max(0, Math.min(rawNewStart, totalDuration - windowLength));
        const clampedEnd = clampedStart + windowLength;

        setTrimStart(+clampedStart.toFixed(2));
        setTrimEnd(+clampedEnd.toFixed(2));
      }
    };

    const handleGlobalMouseUp = () => {
      if (dragInfoRef.current) {
        if (dragInfoRef.current.target === 'PLAYHEAD' && isPreviewPlaying) {
          startPreviewAudio(playheadSecRef.current);
        }
        dragInfoRef.current = null;
        setActiveDrag(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPreviewPlaying, startPreviewAudio, trimEnd, trimStart]);

  if (!isOpen) return null;

  const handleStartDrag = (target: DragTarget, e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const totalDuration = rawBuffer ? rawBuffer.duration : 1;
    dragInfoRef.current = {
      target,
      startX: e.clientX,
      initialTrimStart: trimStart,
      initialTrimEnd: trimEnd,
      totalDuration,
    };
    setActiveDrag(target);

    // If starting PLAYHEAD drag, seek immediately to clicked point
    if (target === 'PLAYHEAD' && waveformInnerRef.current) {
      const rect = waveformInnerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetSec = ratio * totalDuration;
      seekTo(targetSec, false);
    } else {
      stopPreviewAudio();
    }
  };

  const handleWheelZoom = (e: ReactWheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      setZoomLevel((prev) => Math.max(1.0, Math.min(5.0, +(prev + delta).toFixed(1))));
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await decodeForTrimming(files[0]);
    }
  };

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await decodeForTrimming(files[0]);
    }
  };

  const decodeForTrimming = async (file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
      setStep('ERROR');
      setErrorMessage(`File "${file.name}" is not a recognized audio format. Please upload MP3, WAV, OGG, or M4A.`);
      return;
    }

    setFileName(file.name);
    setOriginalFile(file);
    setErrorMessage(null);

    try {
      setStep('READING');
      await new Promise((r) => setTimeout(r, 80));

      setStep('DECODING');
      const audioBuffer = await audioAnalyzer.decodeAudioFile(file);
      setRawBuffer(audioBuffer);

      // Extract raw waveform peaks for the trimmer (higher sample count for zoom)
      const waveform = audioAnalyzer.extractWaveformPeaks(audioBuffer, 240);
      setRawWaveform(waveform);

      // Default crop: Full track length (User can choose shorter clip presets if desired)
      const initialEnd = audioBuffer.duration;
      setTrimStart(0);
      setTrimEnd(+initialEnd.toFixed(2));
      setPlayheadSec(0);
      setZoomLevel(1.0);

      setStep('TRIMMING');
    } catch (err: any) {
      console.error('Audio decode failed:', err);
      setStep('ERROR');
      setErrorMessage(err.message || 'Failed to decode audio file. Browser Web Audio API could not parse format.');
    }
  };

  /**
   * Confirm trimming and run DSP analysis on the cropped slice
   */
  const handleProceedToCharacter = () => {
    stopPreviewAudio();
    setRoster(continuityManager.getCharacters());
    setSelectedChar(continuityManager.getActiveCharacter());
    setStep('CHARACTER_SETUP');
  };

  const handleCharImageChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setNewImagePreview(dataUrl);
      setNewImageDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNewCharacter = async () => {
    if (!newName.trim()) {
      alert('Please enter a character name');
      return;
    }
    if (!newImageDataUrl) {
      alert('Please select or upload a character identity illustration');
      return;
    }

    setIsSavingChar(true);
    try {
      const safeId = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const profile: CharacterProfile = {
        id: safeId,
        name: newName.trim(),
        identity_reference: `references/characters/${safeId}/identity.png`,
        description: `Custom character created for MV: ${newName.trim()}`,
        defaultLocation: newLocation.trim() || 'Cinematic MV Stage',
        defaultCostume: newCostume.trim() || 'Custom Wardrobe',
        defaultColorPalette: ['#6366f1', '#ec4899', '#06b6d4'],
      };

      const saved = await continuityManager.registerCharacter(profile, newImageDataUrl);
      setRoster(continuityManager.getCharacters());
      setSelectedChar(saved);
      setIsAddingNew(false);
      setNewName('');
      setNewImagePreview(null);
      setNewImageDataUrl(null);
    } catch (err: any) {
      alert(`Failed to save character: ${err.message}`);
    } finally {
      setIsSavingChar(false);
    }
  };

  /**
   * Finalize track import with the specified character profile
   */
  const handleFinalizeWithCharacter = async (charToUse: CharacterProfile) => {
    if (!rawBuffer || !originalFile) return;
    stopPreviewAudio();

    try {
      setStep('ANALYZING_DSP');
      await new Promise((r) => setTimeout(r, 100));

      // Slice the audio buffer to selected range
      const slicedBuffer = audioAnalyzer.sliceAudioBuffer(rawBuffer, trimStart, trimEnd);

      // Convert sliced buffer to WAV Blob so the player can load and play it
      const wavBlob = audioAnalyzer.audioBufferToWavBlob(slicedBuffer);

      // Create a new File for the cropped track
      const baseName = originalFile.name.replace(/\.[^/.]+$/, '');
      const croppedFileName = `${baseName}_crop_${Math.round(trimStart)}s_${Math.round(trimEnd)}s.wav`;
      const croppedFile = new File([wavBlob], croppedFileName, { type: 'audio/wav' });

      setStep('EXTRACTING_CUES');
      await new Promise((r) => setTimeout(r, 120));

      // Run full DSP analysis on the sliced audio
      const analyzed = audioAnalyzer.analyzeBuffer(slicedBuffer, croppedFile.name);

      setStep('COMPLETE');
      await new Promise((r) => setTimeout(r, 250));

      continuityManager.setActiveCharacterProfile(charToUse);
      onTrackAnalyzed(analyzed, croppedFile, charToUse);
      onClose();
      resetState();
    } catch (err: any) {
      console.error('Failed to crop and analyze audio:', err);
      setStep('ERROR');
      setErrorMessage(err.message || 'Failed to crop audio buffer.');
    }
  };

  const resetState = () => {
    stopPreviewAudio();
    setStep('IDLE');
    setRawBuffer(null);
    setRawWaveform([]);
    setErrorMessage(null);
    setOriginalFile(null);
    setZoomLevel(1.0);
    setActiveDrag(null);
  };

  const handleClose = () => {
    stopPreviewAudio();
    resetState();
    onClose();
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms
      .toString()
      .padStart(2, '0')}`;
  };

  const totalDuration = rawBuffer ? rawBuffer.duration : 0;
  const selectedDuration = Math.max(0, trimEnd - trimStart);
  const startPercent = totalDuration > 0 ? (trimStart / totalDuration) * 100 : 0;
  const endPercent = totalDuration > 0 ? (trimEnd / totalDuration) * 100 : 100;
  const playheadPercent = totalDuration > 0 ? (playheadSec / totalDuration) * 100 : 0;

  const isProcessing =
    step === 'READING' || step === 'DECODING' || step === 'ANALYZING_DSP' || step === 'EXTRACTING_CUES';

  const handleWaveformClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!waveformInnerRef.current) return;
    const rect = waveformInnerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = ratio * totalDuration;
    seekTo(targetSec, true);
  };

  const renderRulerTicks = () => {
    if (totalDuration <= 0) return null;
    const tickInterval = totalDuration > 120 ? 15 : totalDuration > 60 ? 10 : 5;
    const ticks = [];
    for (let t = 0; t <= totalDuration; t += tickInterval) {
      const pos = (t / totalDuration) * 100;
      ticks.push(
        <div
          key={t}
          className="absolute top-0 bottom-0 flex flex-col justify-between pointer-events-none"
          style={{ left: `${pos}%` }}
        >
          <span className="text-[9px] text-slate-400 font-mono -ml-2.5 leading-none">
            {formatTime(t).split('.')[0]}
          </span>
          <div className="w-[1px] h-1.5 bg-surface-600" />
        </div>
      );
    }
    return ticks;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-850 border border-surface-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden font-mono text-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60 bg-surface-900/60">
          <div className="flex items-center space-x-2.5">
            {step === 'TRIMMING' ? (
              <Scissors className="w-5 h-5 text-amber-400" />
            ) : step === 'CHARACTER_SETUP' ? (
              <Users className="w-5 h-5 text-indigo-400" />
            ) : (
              <Music className="w-5 h-5 text-indigo-400" />
            )}
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-white">
                {step === 'TRIMMING'
                  ? 'Step 1: Crop / Trim Audio Selection'
                  : step === 'CHARACTER_SETUP'
                  ? 'Step 2: Designate Character & Illustration for this Track'
                  : 'Import Audio Track'}
              </h2>
              {step === 'TRIMMING' && (
                <p className="text-[11px] text-slate-400 truncate max-w-md">{fileName}</p>
              )}
              {step === 'CHARACTER_SETUP' && (
                <p className="text-[11px] text-slate-400 truncate max-w-md">
                  Specify which character to direct in this music video (choose existing or add new)
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            aria-label="閉じる"
            className="p-1 rounded-lg hover:bg-surface-750 text-slate-400 hover:text-slate-200 transition disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* STEP 1: DROPZONE / UPLOAD */}
          {step === 'IDLE' || isProcessing || step === 'COMPLETE' || (step === 'ERROR' && !rawBuffer) ? (
            <>
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                    : isProcessing
                    ? 'border-indigo-500/50 bg-surface-900/40 cursor-wait'
                    : 'border-surface-700 hover:border-indigo-400/70 hover:bg-surface-800/60 bg-surface-900/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg,audio/aac,audio/m4a,audio/*"
                  className="hidden"
                  onChange={handleFileInput}
                  disabled={isProcessing}
                />

                {isProcessing ? (
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-white">
                        {step === 'READING' && 'Reading Audio File Buffer...'}
                        {step === 'DECODING' && 'Decoding Audio via Web Audio API...'}
                        {step === 'ANALYZING_DSP' && 'Analyzing Cropped RMS Energy & Spectral Flux...'}
                        {step === 'EXTRACTING_CUES' && 'Extracting Structural Inflection Cues...'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-sm">
                        {fileName}
                      </div>
                    </div>
                  </div>
                ) : step === 'COMPLETE' ? (
                  <div className="flex flex-col items-center space-y-2 text-center text-emerald-400">
                    <CheckCircle2 className="w-12 h-12" />
                    <div className="text-xs font-semibold">Cropping & Analysis Complete! Loading studio...</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="w-14 h-14 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">
                        Drag and drop your audio file here, or{' '}
                        <span className="text-indigo-400 underline underline-offset-2">browse</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Supports MP3, WAV, OGG, M4A, FLAC (100% processed client-side)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message if any */}
              {errorMessage && (
                <div className="p-3 bg-rose-950/40 border border-rose-600/50 rounded-lg flex items-start space-x-2.5 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Analysis Error:</span> {errorMessage}
                  </div>
                </div>
              )}
            </>
          ) : null}

          {/* STEP 2: INTERACTIVE AUDIO CROP / TRIM VIEW */}
          {step === 'TRIMMING' && (
            <div className="space-y-4">
              {/* Header Info & Zoom Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="flex items-center space-x-1.5 text-amber-300 font-semibold">
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Direct Waveform Selection</span>
                  </span>
                  <span className="text-slate-500">•</span>
                  <span>
                    Total: <strong className="text-white">{formatTime(totalDuration)}</strong>
                  </span>
                </div>

                {/* Zoom Controls Toolbar */}
                <div className="flex items-center space-x-1.5 bg-surface-900/90 border border-surface-700/60 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-slate-500 mr-1">Zoom:</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(1.0, +(z - 0.5).toFixed(1)))}
                    disabled={zoomLevel <= 1.0}
                    className="p-1 rounded hover:bg-surface-800 text-slate-300 disabled:opacity-30 transition"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>

                  <span className="text-[11px] font-semibold text-indigo-300 px-1 min-w-[32px] text-center">
                    {zoomLevel.toFixed(1)}x
                  </span>

                  <button
                    onClick={() => setZoomLevel((z) => Math.min(5.0, +(z + 0.5).toFixed(1)))}
                    disabled={zoomLevel >= 5.0}
                    className="p-1 rounded hover:bg-surface-800 text-slate-300 disabled:opacity-30 transition"
                    title="Zoom In (+)"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>

                  {zoomLevel > 1.0 && (
                    <button
                      onClick={() => setZoomLevel(1.0)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 hover:bg-surface-750 text-slate-400 transition"
                      title="Reset Zoom to 1.0x"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Waveform Viewport */}
              <div
                ref={waveformScrollRef}
                onWheel={handleWheelZoom}
                className="relative overflow-x-auto border border-surface-700/80 rounded-xl bg-surface-950 select-none shadow-inner"
                style={{ scrollbarWidth: 'thin' }}
              >
                {/* Waveform Inner Container with dynamic zoom width */}
                <div
                  ref={waveformInnerRef}
                  onClick={handleWaveformClick}
                  className="relative flex flex-col cursor-pointer"
                  style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}
                >
                  {/* Top Interactive Time Ruler */}
                  <div
                    onMouseDown={(e) => handleStartDrag('PLAYHEAD', e)}
                    onClick={handleWaveformClick}
                    className="h-5 bg-surface-900/90 border-b border-surface-700/60 flex items-center relative cursor-ew-resize select-none px-1 overflow-hidden"
                    title="Click or drag anywhere on the timeline to move playback position"
                  >
                    {renderRulerTicks()}
                  </div>

                  {/* Waveform Peaks & Visual Track Area */}
                  <div
                    onMouseDown={(e) => handleStartDrag('PLAYHEAD', e)}
                    onClick={handleWaveformClick}
                    className="h-28 relative flex items-center px-1 cursor-ew-resize"
                  >
                    {/* Waveform Peaks */}
                    <div className="absolute inset-0 flex items-center justify-between px-2 gap-[1.5px] pointer-events-none">
                      {rawWaveform.map((peak, idx) => {
                        const peakPos = (idx / rawWaveform.length) * 100;
                        const isInside = peakPos >= startPercent && peakPos <= endPercent;
                        return (
                          <div
                            key={idx}
                            className={`flex-1 rounded-full transition-all ${
                              isInside ? 'bg-indigo-400' : 'bg-slate-700/40'
                            }`}
                            style={{ height: `${Math.max(10, peak * 85)}%` }}
                          />
                        );
                      })}
                    </div>

                    {/* Left Dimmed Area (Pre-crop) */}
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-surface-950/85 backdrop-blur-[1px] pointer-events-none transition-all duration-75"
                      style={{ width: `${startPercent}%` }}
                    />

                    {/* Right Dimmed Area (Post-crop) */}
                    <div
                      className="absolute top-0 bottom-0 right-0 bg-surface-950/85 backdrop-blur-[1px] pointer-events-none transition-all duration-75"
                      style={{ width: `${100 - endPercent}%` }}
                    />

                    {/* 1. SELECTION WINDOW BODY (Draggable same-window time frame) */}
                    <div
                      className={`absolute top-0 bottom-0 bg-indigo-500/15 border-t-2 border-b-2 border-indigo-400/50 transition-all duration-75 flex items-center justify-center pointer-events-none`}
                      style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
                    >
                      {/* Drag handle button inside the window */}
                      <div
                        onMouseDown={(e) => handleStartDrag('WINDOW', e)}
                        className={`pointer-events-auto flex items-center space-x-1 px-2.5 py-1 rounded-full bg-surface-900/90 border border-indigo-400/50 text-[10px] text-indigo-200 shadow-md ${
                          activeDrag === 'WINDOW' ? 'cursor-grabbing bg-indigo-600/30 text-white' : 'cursor-grab hover:bg-surface-800'
                        }`}
                        title="Drag to slide the entire crop window"
                      >
                        <MoveHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-semibold">Slide Window</span>
                      </div>
                    </div>

                    {/* 2. LEFT START HANDLE (Draggable Start Point) */}
                    <div
                      onMouseDown={(e) => handleStartDrag('START', e)}
                      className={`absolute top-0 bottom-0 w-3 -ml-1.5 z-30 flex flex-col items-center justify-between cursor-ew-resize group ${
                        activeDrag === 'START' ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                      }`}
                      style={{ left: `${startPercent}%` }}
                      title="Drag to change Start Time"
                    >
                      {/* Top Grip Tab */}
                      <div className="w-3.5 h-4 bg-amber-400 rounded-t-sm shadow-md flex items-center justify-center">
                        <div className="w-0.5 h-2 bg-slate-950 rounded-full" />
                      </div>
                      {/* Center Vertical Divider Line */}
                      <div className="w-[2px] h-full bg-amber-400 group-hover:bg-amber-300 shadow-sm" />
                      {/* Bottom Grip Tab */}
                      <div className="w-3.5 h-4 bg-amber-400 rounded-b-sm shadow-md flex items-center justify-center">
                        <div className="w-0.5 h-2 bg-slate-950 rounded-full" />
                      </div>
                    </div>

                    {/* 3. RIGHT END HANDLE (Draggable End Point) */}
                    <div
                      onMouseDown={(e) => handleStartDrag('END', e)}
                      className={`absolute top-0 bottom-0 w-3 -ml-1.5 z-30 flex flex-col items-center justify-between cursor-ew-resize group ${
                        activeDrag === 'END' ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                      }`}
                      style={{ left: `${endPercent}%` }}
                      title="Drag to change End Time"
                    >
                      {/* Top Grip Tab */}
                      <div className="w-3.5 h-4 bg-amber-400 rounded-t-sm shadow-md flex items-center justify-center">
                        <div className="w-0.5 h-2 bg-slate-950 rounded-full" />
                      </div>
                      {/* Center Vertical Divider Line */}
                      <div className="w-[2px] h-full bg-amber-400 group-hover:bg-amber-300 shadow-sm" />
                      {/* Bottom Grip Tab */}
                      <div className="w-3.5 h-4 bg-amber-400 rounded-b-sm shadow-md flex items-center justify-center">
                        <div className="w-0.5 h-2 bg-slate-950 rounded-full" />
                      </div>
                    </div>

                    {/* 4. PLAYHEAD (Draggable Pin + Glowing Indicator Line) */}
                    <div
                      onMouseDown={(e) => handleStartDrag('PLAYHEAD', e)}
                      className="absolute top-0 bottom-0 z-40 group cursor-ew-resize select-none"
                      style={{ left: `${playheadPercent}%` }}
                      title={`Playhead: ${formatTime(playheadSec)} (Click or drag to move)`}
                    >
                      {/* Top Pin Grab Handle */}
                      <div className="absolute -top-3.5 -left-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] flex items-center justify-center group-hover:scale-125 transition-transform">
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      </div>
                      {/* Playhead Center Vertical Line */}
                      <div className="w-[2px] h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] group-hover:bg-amber-300 transition-colors" />
                      {/* Floating Timestamp Tooltip */}
                      <div className="absolute -bottom-6 -left-6 px-1.5 py-0.5 rounded bg-surface-950/95 border border-surface-700 text-[10px] text-white font-mono pointer-events-none opacity-0 group-hover:opacity-100 transition whitespace-nowrap shadow-xl z-50">
                        {formatTime(playheadSec)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Crop Sliders & Timecode Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-surface-900/80 border border-surface-700/60 rounded-xl text-xs">
                {/* Start Time Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Start Point:</span>
                    <span className="text-amber-400 font-bold">{formatTime(trimStart)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, totalDuration - 0.5)}
                    step="0.05"
                    value={trimStart}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimStart(Math.min(val, trimEnd - 0.5));
                      stopPreviewAudio();
                    }}
                    className="w-full h-1.5 bg-surface-750 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>

                {/* End Time Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>End Point:</span>
                    <span className="text-amber-400 font-bold">{formatTime(trimEnd)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max={totalDuration}
                    step="0.05"
                    value={trimEnd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimEnd(Math.max(val, trimStart + 0.5));
                      stopPreviewAudio();
                    }}
                    className="w-full h-1.5 bg-surface-750 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>

                {/* Selected Duration Info */}
                <div className="flex flex-col justify-center items-center bg-surface-800/80 border border-surface-700/50 rounded-lg p-2 text-center">
                  <span className="text-slate-400 text-[11px]">Selected Duration</span>
                  <span className="text-white text-sm font-bold tracking-tight">
                    {formatTime(selectedDuration)} ({selectedDuration.toFixed(1)}s)
                  </span>
                  <span className="text-[10.5px] text-emerald-400 font-semibold mt-0.5">
                    予想カット数: ~{audioAnalyzer.estimateShotCount(selectedDuration, 124)}カット
                  </span>
                </div>
              </div>

              {/* Quick Preset Buttons, Interactive Seek Slider & Spacebar Play Preview */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-surface-900/60 border border-surface-700/50 rounded-xl p-2.5">
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  <span className="text-slate-500 text-[11px] mr-1">Presets:</span>
                  <button
                    onClick={() => {
                      setTrimStart(0);
                      setTrimEnd(+totalDuration.toFixed(2));
                      stopPreviewAudio();
                    }}
                    className={`px-2.5 py-1 rounded transition text-[11px] ${
                      trimStart === 0 && Math.abs(trimEnd - totalDuration) < 0.2
                        ? 'bg-indigo-600 text-white font-bold border border-indigo-400 shadow-sm'
                        : 'bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700'
                    }`}
                  >
                    Full Track (フル尺)
                  </button>
                  <button
                    onClick={() => {
                      setTrimStart(0);
                      setTrimEnd(+Math.min(30.0, totalDuration).toFixed(2));
                      stopPreviewAudio();
                    }}
                    className={`px-2 py-1 rounded transition text-[11px] ${
                      trimStart === 0 && Math.abs(trimEnd - 30.0) < 0.2
                        ? 'bg-indigo-600 text-white font-bold border border-indigo-400 shadow-sm'
                        : 'bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700'
                    }`}
                  >
                    First 30s
                  </button>
                  {totalDuration > 60 && (
                    <button
                      onClick={() => {
                        setTrimStart(0);
                        setTrimEnd(+Math.min(60.0, totalDuration).toFixed(2));
                        stopPreviewAudio();
                      }}
                      className={`px-2 py-1 rounded transition text-[11px] ${
                        trimStart === 0 && Math.abs(trimEnd - 60.0) < 0.2
                          ? 'bg-indigo-600 text-white font-bold border border-indigo-400 shadow-sm'
                          : 'bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700'
                      }`}
                    >
                      First 60s
                    </button>
                  )}
                  {totalDuration > 40 && (
                    <button
                      onClick={() => {
                        const mid = totalDuration * 0.5;
                        setTrimStart(+Math.max(0, mid - 15).toFixed(2));
                        setTrimEnd(+Math.min(totalDuration, mid + 15).toFixed(2));
                        stopPreviewAudio();
                      }}
                      className="px-2 py-1 rounded bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 transition text-[11px]"
                    >
                      Mid Climax (30s)
                    </button>
                  )}
                </div>

                {/* Direct Playhead Seek Slider & Playback Controls */}
                <div className="flex items-center space-x-3 flex-1 justify-end min-w-[280px]">
                  {/* Seek Slider */}
                  <div className="flex items-center space-x-2 bg-surface-950/80 border border-surface-700/80 rounded-lg px-2.5 py-1 flex-1 max-w-xs">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">Seek:</span>
                    <input
                      type="range"
                      min={trimStart}
                      max={trimEnd}
                      step="0.05"
                      value={playheadSec}
                      onChange={(e) => seekTo(parseFloat(e.target.value), true)}
                      className="w-full h-1.5 bg-surface-750 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                      title="Drag to change playback position"
                    />
                    <span className="text-[11px] font-mono font-semibold text-indigo-300 min-w-[50px] text-right">
                      {formatTime(playheadSec)}
                    </span>
                  </div>

                  {/* Play / Pause Toggle Button */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] text-slate-500 hidden sm:inline">[Space]</span>
                    <button
                      onClick={togglePreviewAudio}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                        isPreviewPlaying
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30'
                          : 'bg-surface-800 hover:bg-surface-750 text-indigo-300 border-indigo-500/40'
                      }`}
                    >
                      {isPreviewPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Play</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CHARACTER_SETUP */}
          {step === 'CHARACTER_SETUP' && (
            <div className="space-y-4 font-mono text-xs">
              {/* Hidden file input for character image upload */}
              <input
                ref={charImageInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleCharImageChosen}
              />

              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold">Select or Add Character for this MV Track:</span>
                <span className="text-[11px] text-indigo-400">
                  {roster.length} registered characters
                </span>
              </div>

              {/* Roster Grid & Add New Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto p-1">
                {roster.map((char) => {
                  const isSelected = selectedChar?.id === char.id;
                  const imgSrc = `/api/codex/image?path=${encodeURIComponent(char.identity_reference)}`;

                  return (
                    <div
                      key={char.id}
                      onClick={() => {
                        setSelectedChar(char);
                        setIsAddingNew(false);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col space-y-2 relative group ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg'
                          : 'bg-surface-900/80 border-surface-750 hover:border-surface-600'
                      }`}
                    >
                      {/* Active Checkmark */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center space-x-1 z-10 shadow">
                          <Check className="w-3 h-3" />
                          <span>Selected</span>
                        </div>
                      )}

                      {/* Image Thumbnail */}
                      <div className="aspect-video bg-surface-950 rounded-lg overflow-hidden border border-surface-800 flex items-center justify-center relative">
                        <img
                          src={imgSrc}
                          alt={char.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Character Details */}
                      <div>
                        <div className="font-bold text-white text-xs flex items-center space-x-1">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{char.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {char.defaultCostume}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Card to Add New Character */}
                <div
                  onClick={() => setIsAddingNew(true)}
                  className={`p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] text-center space-y-2 ${
                    isAddingNew
                      ? 'border-indigo-400 bg-indigo-500/10'
                      : 'border-surface-700 hover:border-indigo-400/60 bg-surface-900/40 hover:bg-surface-850'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Create New Character</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Upload custom illustration</div>
                  </div>
                </div>
              </div>

              {/* Inline Character Creator Form */}
              {isAddingNew && (
                <div className="p-4 bg-surface-900 border border-indigo-500/40 rounded-xl space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs text-white font-bold">
                    <span>New Character Specification:</span>
                    <button
                      onClick={() => setIsAddingNew(false)}
                      aria-label="キャラクター作成を閉じる"
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Left: Image upload box */}
                    <div
                      onClick={() => charImageInputRef.current?.click()}
                      className="border-2 border-dashed border-surface-700 hover:border-indigo-400 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer bg-surface-950 aspect-video relative overflow-hidden"
                    >
                      {newImagePreview ? (
                        <>
                          <img
                            src={newImagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white">
                            Change Image
                          </span>
                        </>
                      ) : (
                        <div className="flex flex-col items-center space-y-1 text-center text-slate-400">
                          <Upload className="w-5 h-5 text-indigo-400" />
                          <span className="text-[11px] font-semibold text-slate-200">
                            Upload Illustration (Required)
                          </span>
                          <span className="text-[10px] text-slate-500">PNG, JPG or WEBP</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Name, Costume, Location inputs */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">
                          Character Name *
                        </label>
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g. Amber, Cloel, Zax, Custom Hero..."
                          className="w-full px-2.5 py-1.5 rounded bg-surface-950 border border-surface-750 text-white focus:border-indigo-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">
                          Signature Costume / Outfit
                        </label>
                        <input
                          type="text"
                          value={newCostume}
                          onChange={(e) => setNewCostume(e.target.value)}
                          placeholder="e.g. Tactical Cyber Hoodie & Combat Gear"
                          className="w-full px-2.5 py-1.5 rounded bg-surface-950 border border-surface-750 text-white focus:border-indigo-500 outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">
                          World Location / Setting
                        </label>
                        <input
                          type="text"
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          placeholder="e.g. High-Altitude Cyber Spire"
                          className="w-full px-2.5 py-1.5 rounded bg-surface-950 border border-surface-750 text-white focus:border-indigo-500 outline-none text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-1 border-t border-surface-800">
                    <button
                      onClick={() => setIsAddingNew(false)}
                      className="px-3 py-1 rounded bg-surface-800 text-slate-400 hover:text-white text-xs transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNewCharacter}
                      disabled={isSavingChar || !newName.trim() || !newImageDataUrl}
                      className="flex items-center space-x-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-40"
                    >
                      <span>{isSavingChar ? 'Saving...' : 'Save & Select Character'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-surface-700/60 bg-surface-900/60 flex items-center justify-between text-xs">
          {step === 'TRIMMING' ? (
            <>
              <button
                onClick={() => {
                  stopPreviewAudio();
                  setStep('IDLE');
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Choose Another File</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleClose}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceedToCharacter}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/20 transition"
                >
                  <span>Next: Designate Character ({selectedDuration.toFixed(1)}s)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : step === 'CHARACTER_SETUP' ? (
            <>
              <button
                onClick={() => setStep('TRIMMING')}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Audio Trimming</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleClose}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleFinalizeWithCharacter(selectedChar)}
                  disabled={!selectedChar}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20 transition disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Confirm & Launch Studio ({selectedChar?.name})</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-slate-500">
                Local browser DSP • Non-destructive in-memory slicing
              </div>
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 transition disabled:opacity-40"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
