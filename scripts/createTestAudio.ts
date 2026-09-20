import fs from 'fs';
import path from 'path';

function createSineWaveWav(filePath: string, durationSec: number = 20, freq: number = 440) {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSec);
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate a dynamic beat-like waveform
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beat = (t % 0.5 < 0.1 ? 0.8 : 0.2); // 120 bpm rhythm
    const val = Math.sin(2 * Math.PI * freq * t) * beat * 0.5;
    const sample = Math.max(-32768, Math.min(32767, Math.floor(val * 32767)));
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  console.log('Created test wav at:', filePath);
}

const target = path.join(process.cwd(), 'public', 'test_track.wav');
createSineWaveWav(target, 25, 220);
