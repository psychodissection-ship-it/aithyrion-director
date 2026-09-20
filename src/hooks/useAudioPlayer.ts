import { useState, useEffect, useRef, useCallback } from 'react';

export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  audioUrl: string | null;
  fileName: string | null;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  loadAudioFile: (file: File) => void;
  loadAudioUrl: (url: string, fileName?: string) => void;
  clearAudio: () => void;
}

export function useAudioPlayer(
  onTimeUpdate?: (time: number) => void,
  defaultAudioUrl: string = ''
): AudioPlayerState {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [audioUrl, setAudioUrl] = useState<string | null>(defaultAudioUrl || null);
  const [fileName, setFileName] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume;
    if (defaultAudioUrl) {
      audio.src = defaultAudioUrl;
    }
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      if (onTimeUpdateRef.current) {
        onTimeUpdateRef.current(t);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      audioRef.current = null;
    };
  }, [defaultAudioUrl]);

  const loadAudioFile = useCallback((file: File) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.src && audio.src.startsWith('blob:')) {
      URL.revokeObjectURL(audio.src);
    }

    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.load();
    setAudioUrl(url);
    setFileName(file.name);
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const loadAudioUrl = useCallback((url: string, name?: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.src && audio.src.startsWith('blob:')) {
      URL.revokeObjectURL(audio.src);
    }

    audio.src = url;
    audio.load();
    setAudioUrl(url);
    setFileName(name || url.split('/').pop() || 'Track');
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const clearAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      audio.src = '';
    }
    setAudioUrl(null);
    setFileName(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.src) {
      const fallbackUrl = defaultAudioUrl || '/dark_wings.wav';
      audio.src = fallbackUrl;
      setAudioUrl(fallbackUrl);
      setFileName('Dark Wings (Benchmark)');
      audio.load();
    }

    try {
      await audio.play();
    } catch (err) {
      console.warn('Audio playback prevented or error', err);
    }
  }, [defaultAudioUrl]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      if (!audio.src) {
        const fallbackUrl = defaultAudioUrl || '/dark_wings.wav';
        audio.src = fallbackUrl;
        setAudioUrl(fallbackUrl);
        audio.load();
      }
      const maxDuration =
        audio.duration && !isNaN(audio.duration) && audio.duration > 0
          ? audio.duration
          : duration || 32;
      const clamped = Math.max(0, Math.min(time, maxDuration));
      audio.currentTime = clamped;
      setCurrentTime(clamped);
      if (onTimeUpdateRef.current) {
        onTimeUpdateRef.current(clamped);
      }
    }
  }, [duration, defaultAudioUrl]);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    audioUrl,
    fileName,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    loadAudioFile,
    loadAudioUrl,
    clearAudio,
  };
}
