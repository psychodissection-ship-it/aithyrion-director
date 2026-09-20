import { TimelinePoint, EnergyTrend, MusicState } from '../../types/director';

export interface AnalyzedTrackData {
  title: string;
  artist: string;
  duration: number;
  bpm: number;
  waveform: number[]; // Normalized [0, 1] peaks for waveform visualization (e.g. 150 points)
  timeline: TimelinePoint[];
  audioBuffer?: AudioBuffer;
  audioUrl?: string;
}

export class AudioAnalyzer {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Safely release Web Audio API context resources (M-4 fix)
   */
  async dispose(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        await this.audioCtx.close();
      } catch (err) {
        console.warn('Error closing AudioContext:', err);
      }
      this.audioCtx = null;
    }
  }

  /**
   * Decode an audio File into an AudioBuffer using the browser's Web Audio API
   */
  async decodeAudioFile(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = this.getAudioContext();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  /**
   * Extract waveform preview peaks for UI rendering (e.g. 120-200 bars)
   */
  extractWaveformPeaks(buffer: AudioBuffer, numSamples = 160): number[] {
    const channelData = buffer.getChannelData(0);
    const step = Math.floor(channelData.length / numSamples);
    const peaks: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      const start = i * step;
      const end = Math.min(start + step, channelData.length);
      let max = 0;
      for (let j = start; j < end; j += 10) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks.push(+max.toFixed(3));
    }

    // Normalize peaks to [0, 1]
    const maxVal = Math.max(...peaks, 0.01);
    return peaks.map((p) => +(p / maxVal).toFixed(3));
  }

  /**
   * Main analysis method: analyzes audio buffer and returns full AnalyzedTrackData
   */
  analyzeBuffer(buffer: AudioBuffer, fileName: string): AnalyzedTrackData {
    const sampleRate = buffer.sampleRate;
    const duration = buffer.duration;
    const channelData = buffer.getChannelData(0);

    // 1. Frame-based RMS Energy Analysis (100ms window, 50ms hop)
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms
    const hopSize = Math.floor(sampleRate * 0.05); // 50ms
    const numFrames = Math.floor((channelData.length - windowSize) / hopSize);

    const frameEnergies: { time: number; rms: number }[] = [];
    let maxRms = 0.001;

    for (let i = 0; i < numFrames; i++) {
      const offset = i * hopSize;
      let sumSq = 0;
      for (let j = 0; j < windowSize; j += 4) {
        const sample = channelData[offset + j];
        sumSq += sample * sample;
      }
      const rms = Math.sqrt(sumSq / (windowSize / 4));
      const time = +(offset / sampleRate).toFixed(2);
      frameEnergies.push({ time, rms });
      if (rms > maxRms) maxRms = rms;
    }

    // Normalize RMS energies to [0, 1]
    const normalizedFrames = frameEnergies.map((f) => ({
      time: f.time,
      energy: +(f.rms / maxRms).toFixed(3),
    }));

    // 2. Onset / Transient Detection (spectral energy difference / flux)
    const onsets: { time: number; strength: number }[] = [];
    for (let i = 1; i < normalizedFrames.length; i++) {
      const diff = normalizedFrames[i].energy - normalizedFrames[i - 1].energy;
      if (diff > 0.08) {
        onsets.push({
          time: normalizedFrames[i].time,
          strength: Math.min(1.0, +(diff * 3.5).toFixed(3)),
        });
      }
    }

    // 3. Tempo (BPM) Estimation from Onset intervals
    const estimatedBpm = this.estimateBpm(onsets, duration);

    // 4. Extract Structural Inflection Points (Cue Points)
    const timeline = this.extractInflectionPoints(normalizedFrames, onsets, duration, estimatedBpm);

    // 5. Generate Waveform Peaks
    const waveform = this.extractWaveformPeaks(buffer);

    // Title formatting from filename
    const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    return {
      title: cleanTitle,
      artist: 'Custom Audio Source',
      duration: +duration.toFixed(2),
      bpm: estimatedBpm,
      waveform,
      timeline,
      audioBuffer: buffer,
    };
  }

  /**
   * Estimate BPM using inter-onset intervals
   */
  private estimateBpm(onsets: { time: number; strength: number }[], duration: number): number {
    if (onsets.length < 5) return 124; // Sensible default for electronic / modern pop

    const intervals: number[] = [];
    for (let i = 1; i < Math.min(onsets.length, 120); i++) {
      const dt = onsets[i].time - onsets[i - 1].time;
      if (dt >= 0.28 && dt <= 1.2) {
        intervals.push(dt);
      }
    }

    if (intervals.length === 0) return 124;

    // Convert intervals to BPM candidates
    const bpmCandidates = intervals.map((dt) => {
      let bpm = 60 / dt;
      while (bpm < 90) bpm *= 2;
      while (bpm > 180) bpm /= 2;
      return Math.round(bpm);
    });

    // Frequency map / mode
    const counts: Record<number, number> = {};
    bpmCandidates.forEach((b) => {
      counts[b] = (counts[b] || 0) + 1;
    });

    let bestBpm = 124;
    let maxCount = 0;
    for (const [bpmStr, count] of Object.entries(counts)) {
      if (count > maxCount) {
        const parsed = parseInt(bpmStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
          maxCount = count;
          bestBpm = parsed;
        }
      }
    }

    return bestBpm || 124;
  }

  /**
   * Helper to estimate shot count for a given duration and BPM
   */
  estimateShotCount(duration: number, bpm: number = 120): number {
    if (duration <= 0) return 0;
    const barSec = Math.max(1.0, (60 / (bpm || 120)) * 4);
    const avgShotDuration = Math.min(6.0, Math.max(2.8, barSec * 2));
    return Math.max(1, Math.round(duration / avgShotDuration));
  }

  /**
   * Divide full audio duration into continuous cinematic MV shot points
   * Quantized to musical bars and snapped to dynamic onsets/transients.
   */
  private extractInflectionPoints(
    frames: { time: number; energy: number }[],
    onsets: { time: number; strength: number }[],
    duration: number,
    bpm: number
  ): TimelinePoint[] {
    if (frames.length === 0 || duration <= 0) return [];

    const effectiveBpm = bpm > 40 && bpm < 260 ? bpm : 124;
    const beatSec = 60 / effectiveBpm;
    const barSec = beatSec * 4; // 1 bar (4 beats)

    // Helper to sample frame at time t
    const getEnergyAt = (t: number): number => {
      const idx = Math.min(frames.length - 1, Math.max(0, Math.floor((t / duration) * frames.length)));
      return frames[idx]?.energy || 0.1;
    };

    // Helper to get average energy in interval [tStart, tEnd]
    const getAvgEnergyIn = (tStart: number, tEnd: number): number => {
      const startIdx = Math.min(frames.length - 1, Math.max(0, Math.floor((tStart / duration) * frames.length)));
      const endIdx = Math.min(frames.length - 1, Math.max(0, Math.floor((tEnd / duration) * frames.length)));
      if (startIdx >= endIdx) return getEnergyAt(tStart);
      let sum = 0;
      for (let i = startIdx; i <= endIdx; i++) {
        sum += frames[i].energy;
      }
      return sum / (endIdx - startIdx + 1);
    };

    // Helper to determine energy trend comparing current interval to previous
    const getEnergyTrend = (currentAvg: number, prevAvg: number): EnergyTrend => {
      const delta = currentAvg - prevAvg;
      if (delta > 0.18) return 'rapidly_rising';
      if (delta > 0.05) return 'rising';
      if (delta < -0.12) return 'falling';
      if (currentAvg > 0.72) return 'plateau';
      return 'stable';
    };

    // Helper to get peak onset strength in interval
    const getPeakOnsetIn = (tStart: number, tEnd: number): number => {
      const matched = onsets.filter((o) => o.time >= tStart && o.time <= tEnd);
      if (matched.length === 0) return 0.2;
      return Math.max(...matched.map((o) => o.strength));
    };

    // Determine section label for a time t
    const getSectionLabel = (t: number, avgEnergy: number): { section: string; description: string } => {
      const relPos = t / duration;

      if (relPos < 0.08) {
        return { section: 'Intro Atmosphere', description: 'Opening atmosphere & visual establishment' };
      }
      if (relPos < 0.24) {
        return { section: 'Verse 1 (Narrative)', description: 'Narrative progression & rhythmic character movement' };
      }
      if (relPos < 0.38) {
        return { section: 'Build-Up 1 (Pre-Chorus)', description: 'Percussive buildup & tension acceleration' };
      }
      if (relPos < 0.54) {
        return avgEnergy > 0.65
          ? { section: 'Chorus 1 (Drop)', description: 'High energy hook & dynamic visual performance' }
          : { section: 'Chorus 1 (Melodic)', description: 'Melodic release & sweeping camera angles' };
      }
      if (relPos < 0.68) {
        return { section: 'Verse 2 (Breakdown)', description: 'Post-drop breath, contrast & narrative development' };
      }
      if (relPos < 0.78) {
        return { section: 'Build-Up 2 (Bridge Tension)', description: 'Secondary acceleration & climactic buildup' };
      }
      if (relPos < 0.92) {
        return { section: 'Climax Chorus (Final Drop)', description: 'Maximum impact peak & intense cinematic action' };
      }
      return { section: 'Outro (Fade)', description: 'Closing resolution & fade-out' };
    };

    // Construct sequential cuts from 0.0 to duration
    const cutTimes: number[] = [0.0];
    let currentT = 0.0;
    const minShotDur = 2.0; // Minimum 2.0s per shot to prevent visual jitter
    const maxShotDur = 7.5; // Maximum 7.5s per shot (below HardConstraints 8.0s limit)

    while (currentT < duration - minShotDur) {
      const localEnergy = getAvgEnergyIn(currentT, Math.min(duration, currentT + barSec * 2));

      // Choose target bar count based on local energy
      let targetBars: number;
      if (localEnergy > 0.75) {
        targetBars = barSec >= 2.2 ? 1 : 2;
      } else if (localEnergy > 0.45) {
        targetBars = 2;
      } else {
        targetBars = barSec >= 2.0 ? 3 : 4;
      }

      let idealNextT = currentT + targetBars * barSec;

      // Clamp to min/max duration
      idealNextT = Math.max(currentT + minShotDur, Math.min(currentT + maxShotDur, idealNextT));

      // Don't leave a tiny orphaned tail at the end
      if (duration - idealNextT < minShotDur) {
        break; // The final cut will span to duration
      }

      // Beat snapping: look for nearest onset within ±0.35s of idealNextT
      const snapWindow = 0.35;
      const nearbyOnsets = onsets.filter(
        (o) => Math.abs(o.time - idealNextT) <= snapWindow && o.time > currentT + minShotDur && o.time < duration - minShotDur
      );

      let snappedT = idealNextT;
      if (nearbyOnsets.length > 0) {
        // Pick the strongest onset in the snap window
        nearbyOnsets.sort((a, b) => b.strength - a.strength);
        snappedT = nearbyOnsets[0].time;
      }

      snappedT = +snappedT.toFixed(2);
      cutTimes.push(snappedT);
      currentT = snappedT;
    }

    // Now map cut intervals into TimelinePoint[]
    let prevAvgEnergy = 0.2;
    const points: TimelinePoint[] = [];

    for (let i = 0; i < cutTimes.length; i++) {
      const t = cutTimes[i];
      const nextT = i + 1 < cutTimes.length ? cutTimes[i + 1] : duration;
      const shotDuration = +(nextT - t).toFixed(2);
      const avgEnergy = +getAvgEnergyIn(t, nextT).toFixed(2);
      const trend = getEnergyTrend(avgEnergy, prevAvgEnergy);
      const onset = +getPeakOnsetIn(t, Math.min(duration, t + 1.2)).toFixed(2);
      const { section, description } = getSectionLabel(t, avgEnergy);

      prevAvgEnergy = avgEnergy;

      const musicState: MusicState = {
        time: t,
        energy: avgEnergy,
        energyTrend: trend,
        onsetStrength: onset,
        nextMajorChange: shotDuration,
        bpm: effectiveBpm,
        section,
      };

      points.push({
        id: `shot-pt-${i + 1}`,
        time: t,
        description: `${description} [${shotDuration}s]`,
        musicState,
      });
    }

    return points;
  }

  /**
   * Slice an AudioBuffer into a sub-buffer between startTime and endTime (in seconds)
   */
  sliceAudioBuffer(buffer: AudioBuffer, startTime: number, endTime: number): AudioBuffer {
    const sampleRate = buffer.sampleRate;
    const clampedStart = Math.max(0, Math.min(startTime, buffer.duration));
    const clampedEnd = Math.max(clampedStart + 0.5, Math.min(endTime, buffer.duration));

    const startOffset = Math.floor(clampedStart * sampleRate);
    const endOffset = Math.floor(clampedEnd * sampleRate);
    const frameCount = Math.max(1, endOffset - startOffset);

    const ctx = this.getAudioContext();
    const slicedBuffer = ctx.createBuffer(buffer.numberOfChannels, frameCount, sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      const subArray = channelData.subarray(startOffset, endOffset);
      slicedBuffer.copyToChannel(subArray, channel, 0);
    }

    return slicedBuffer;
  }

  /**
   * Convert an AudioBuffer to a 16-bit PCM WAV Blob for HTML5 audio playback and export
   */
  audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const numSamples = buffer.length;
    const dataByteCount = numSamples * blockAlign;
    const totalByteCount = 44 + dataByteCount;

    const arrayBuffer = new ArrayBuffer(totalByteCount);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataByteCount, true);
    writeString(8, 'WAVE');

    // "fmt " sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // "data" sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataByteCount, true);

    // Interleave channels & write 16-bit PCM samples
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channels[ch][i];
        // Clip sample to [-1, 1]
        sample = Math.max(-1, Math.min(1, sample));
        // Scale to 16-bit signed integer
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}

export const audioAnalyzer = new AudioAnalyzer();
