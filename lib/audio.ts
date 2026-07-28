import { midiToHz } from './pitch';
import type { ControlPoint } from './interpolation';

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function stopAll(): void {
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}

interface PlayGlideOptions {
  times: number[];
  freqs: number[];
  speed?: number;
  onEnd?: () => void;
}

/** Play interpolated frequency glide using scheduled setValueAtTime */
export async function playGlide({
  times,
  freqs,
  speed = 1,
  onEnd,
}: PlayGlideOptions): Promise<void> {
  stopAll();
  const ctx = getContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime + 0.05;
  const duration = (times[times.length - 1] - times[0]) / speed;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
  gain.gain.setValueAtTime(0.25, now + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.frequency.setValueAtTime(Math.max(50, freqs[0]), now);
  const step = Math.max(1, Math.floor(times.length / 200));
  for (let i = step; i < times.length; i += step) {
    const t = now + (times[i] - times[0]) / speed;
    osc.frequency.setValueAtTime(Math.max(50, Math.min(2000, freqs[i])), t);
  }

  osc.start(now);
  osc.stop(now + duration + 0.1);

  osc.onended = () => {
    onEnd?.();
  };
}

/** Staccato playback of control points only */
export async function playStaccato(
  points: ControlPoint[],
  speed = 1,
  onEnd?: () => void
): Promise<void> {
  stopAll();
  const ctx = getContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const sorted = [...points].sort((a, b) => a.t - b.t);
  const noteDur = 0.18 / speed;
  const gap = 0.05 / speed;
  let start = ctx.currentTime + 0.05;

  for (const p of sorted) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = midiToHz(p.midi);
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, start + noteDur);

    osc.start(start);
    osc.stop(start + noteDur + 0.01);
    start += noteDur + gap;
  }

  const total = start - ctx.currentTime;
  setTimeout(() => onEnd?.(), total * 1000);
}

/** Export interpolated curve as WAV blob */
export function exportWav(times: number[], freqs: number[], sampleRate = 44100): Blob {
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const duration = t1 - t0;
  const numSamples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = t0 + (i / sampleRate);
    let idx = 0;
    while (idx < times.length - 1 && times[idx + 1] < t) idx++;
    const tA = times[idx];
    const tB = times[Math.min(idx + 1, times.length - 1)];
    const fA = freqs[idx];
    const fB = freqs[Math.min(idx + 1, freqs.length - 1)];
    const u = tB > tA ? (t - tA) / (tB - tA) : 0;
    const freq = fA + u * (fB - fA);
    buffer[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * 0.35;
  }

  const wavBuffer = encodeWav(buffer, sampleRate);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
