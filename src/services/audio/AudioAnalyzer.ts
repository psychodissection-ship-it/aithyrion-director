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
   * Extract 6 to 10 meaningful cinematic cue points based on energy inflection, drops, and build-ups
   */
  private extractInflectionPoints(
    frames: { time: number; energy: number }[],
    onsets: { time: number; strength: number }[],
    duration: number,
    bpm: number
  ): TimelinePoint[] {
    if (frames.length === 0) return [];

    const candidates: {
      time: number;
      energy: number;
      energyTrend: EnergyTrend;
      onsetStrength: number;
      section: string;
      description: string;
    }[] = [];

    // Helper to sample frame at time
    const getEnergyAt = (t: number): number => {
      const idx = Math.min(frames.length - 1, Math.max(0, Math.floor((t / duration) * frames.length)));
      return frames[idx]?.energy || 0.1;
    };

    // Helper to calculate energy trend over window
    const getTrendAt = (t: number): EnergyTrend => {
      const current = getEnergyAt(t);
      const past = getEnergyAt(Math.max(0, t - 1.5));
      const delta = current - past;

      if (delta > 0.25) return 'rapidly_rising';
      if (delta > 0.08) return 'rising';
      if (delta < -0.12) return 'falling';
      if (current > 0.75) return 'plateau';
      return 'stable';
    };

    // Helper to get nearest onset strength
    const getOnsetAt = (t: number): number => {
      const nearby = onsets.filter((o) => Math.abs(o.time - t) < 0.6);
      if (nearby.length === 0) return 0.2;
      return Math.max(...nearby.map((o) => o.strength));
    };

    // 1. Initial Intro point (at 10% or 3-5 seconds)
    const introTime = Math.min(4.0, +(duration * 0.08).toFixed(2));
    candidates.push({
      time: introTime,
      energy: getEnergyAt(introTime),
      energyTrend: 'rising',
      onsetStrength: getOnsetAt(introTime),
      section: 'Intro Pad',
      description: 'Opening atmosphere & scene establishment',
    });

    // 2. Find Peak Climax / Drop point
    let peakIdx = 0;
    let peakEnergy = 0;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].energy > peakEnergy) {
        peakEnergy = frames[i].energy;
        peakIdx = i;
      }
    }
    const peakTime = frames[peakIdx]?.time || duration * 0.6;

    // 3. Build-up start (prior to peak)
    const buildStartTime = +(peakTime * 0.5).toFixed(2);
    candidates.push({
      time: buildStartTime,
      energy: getEnergyAt(buildStartTime),
      energyTrend: 'rising',
      onsetStrength: getOnsetAt(buildStartTime),
      section: 'Build A',
      description: 'Bass entry & gradual rhythmic build-up',
    });

    // 4. Pre-peak acceleration
    const accelTime = +(peakTime * 0.78).toFixed(2);
    candidates.push({
      time: accelTime,
      energy: getEnergyAt(accelTime),
      energyTrend: 'rapidly_rising',
      onsetStrength: Math.max(0.6, getOnsetAt(accelTime)),
      section: 'Build B',
      description: 'Percussion acceleration & tension spike',
    });

    // 5. Pre-drop tension (1-2 seconds before peak hit)
    const preDropTime = Math.max(accelTime + 1.0, +(peakTime - 1.8).toFixed(2));
    if (preDropTime < peakTime) {
      candidates.push({
        time: preDropTime,
        energy: getEnergyAt(preDropTime),
        energyTrend: 'rising',
        onsetStrength: getOnsetAt(preDropTime),
        section: 'Pre-Drop Tension',
        description: 'Pre-drop ambiguity & diagnostic tension',
      });
    }

    // 6. Main Climax / Drop Hit
    candidates.push({
      time: +peakTime.toFixed(2),
      energy: Math.max(0.9, peakEnergy),
      energyTrend: 'plateau',
      onsetStrength: 0.95,
      section: 'Main Drop',
      description: 'Climax / Drop Hit (Decisive Impact)',
    });

    // 7. Post-drop breakdown / release (few seconds after peak)
    const releaseTime = Math.min(duration - 3.0, +(peakTime + 4.5).toFixed(2));
    if (releaseTime < duration) {
      candidates.push({
        time: releaseTime,
        energy: Math.max(0.25, getEnergyAt(releaseTime)),
        energyTrend: 'falling',
        onsetStrength: Math.min(0.4, getOnsetAt(releaseTime)),
        section: 'Post-Drop Breakdown',
        description: 'Post-drop breath & visual release',
      });
    }

    // 8. Outro if duration permits
    const outroTime = +(duration * 0.92).toFixed(2);
    if (outroTime > releaseTime + 3.0) {
      candidates.push({
        time: outroTime,
        energy: Math.max(0.1, getEnergyAt(outroTime)),
        energyTrend: 'falling',
        onsetStrength: 0.15,
        section: 'Outro Fade',
        description: 'Outro decay & closing transition',
      });
    }

    // Sort by time and remove duplicates within 1.5 seconds
    candidates.sort((a, b) => a.time - b.time);
    const filtered: typeof candidates = [];
    for (const c of candidates) {
      if (filtered.length === 0 || c.time - filtered[filtered.length - 1].time >= 2.0) {
        filtered.push(c);
      }
    }

    // Map to TimelinePoint[] with nextMajorChange calculation
    return filtered.map((c, idx) => {
      const nextTime = idx + 1 < filtered.length ? filtered[idx + 1].time : duration;
      const nextMajorChange = +(nextTime - c.time).toFixed(2);

      const musicState: MusicState = {
        time: c.time,
        energy: +c.energy.toFixed(2),
        energyTrend: c.energyTrend,
        onsetStrength: +c.onsetStrength.toFixed(2),
        nextMajorChange,
        bpm,
        section: c.section,
      };

      return {
        id: `custom-pt-${idx + 1}`,
        time: c.time,
        description: c.description,
        musicState,
      };
    });
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
