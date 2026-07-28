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

interface PianoPartial {
  ratio: number;   // harmonic multiple of fundamental
  gain: number;    // relative amplitude
  detune: number;  // cents detune (for the natural "stretched" piano sound)
}

// Piano-style additive spectrum.
// Fundamental is the loudest, then 2nd/3rd harmonics strong,
// higher harmonics fall off. Slight detune gives a warm, imperfect
// string-bank feel without sounding chorus-y.
const PIANO_PARTIALS: PianoPartial[] = [
  { ratio: 1,   gain: 1.00, detune: 0 },
  { ratio: 2,   gain: 0.55, detune: +2 },
  { ratio: 3,   gain: 0.32, detune: -1 },
  { ratio: 4,   gain: 0.16, detune: +4 },
  { ratio: 5,   gain: 0.08, detune: -2 },
  { ratio: 6,   gain: 0.05, detune: +3 },
];

interface PianoVoiceOptions {
  freq: number;
  startTime: number;        // AudioContext time
  attackDur?: number;       // hammer-style quick attack (default 3ms)
  decayDur?: number;        // decay to sustain level (default 220ms)
  sustainLevel?: number;    // relative level after decay (default 0.28)
  releaseDur?: number;      // tail-off (default 280ms)
  peakGain?: number;        // master gain per voice (default 0.35)
  velocityCurve?: number;   // 0..1, affects peak gain and high-partial brightness
  lowpassHz?: number;       // low-pass filter to mellow the timbre
  lengthSec?: number;       // total intended length (used for scheduled release)
  onEnded?: () => void;
}

/**
 * Build a piano-like voice (stacked detuned partials + low-pass + ADSR)
 * and wire it into the AudioContext graph. Returns the top-level gain
 * node whose frequency (via its child oscillators) the caller can then
 * automate for glide/portamento effects.
 */
function createPianoVoice(
  ctx: AudioContext,
  {
    freq,
    startTime,
    attackDur = 0.003,
    decayDur = 0.22,
    sustainLevel = 0.28,
    releaseDur = 0.28,
    peakGain = 0.35,
    velocityCurve = 0.8,
    lowpassHz = 6200,
    lengthSec,
    onEnded,
  }: PianoVoiceOptions
): {
  oscs: OscillatorNode[];
  partialGains: GainNode[];
  filter: BiquadFilterNode;
  master: GainNode;
} {
  const oscs: OscillatorNode[] = [];
  const partialGains: GainNode[] = [];

  const partialsBus = ctx.createGain();
  partialsBus.gain.value = 1;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.8;
  filter.frequency.value = lowpassHz;

  const master = ctx.createGain();
  master.gain.value = 0;

  const brightness = 0.55 + 0.45 * velocityCurve;
  const masterLevel = peakGain * (0.55 + 0.55 * velocityCurve);

  let activeCount = 0;
  const tryCallEnded = () => {
    activeCount--;
    if (activeCount <= 0) onEnded?.();
  };

  for (let i = 0; i < PIANO_PARTIALS.length; i++) {
    const p = PIANO_PARTIALS[i];
    // Roll off high partials as velocity drops — mimics real piano
    // where softer playing produces fewer harmonics.
    const velRoll = Math.max(0.15, 1 - i * (1 - velocityCurve) * 0.12);
    const partialLevel = p.gain * brightness * velRoll;

    const g = ctx.createGain();
    g.gain.value = partialLevel;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = Math.max(20, freq * p.ratio);
    if (p.detune !== 0) osc.detune.value = p.detune;

    osc.connect(g);
    g.connect(partialsBus);

    oscs.push(osc);
    partialGains.push(g);
    activeCount++;
    osc.onended = tryCallEnded;
  }

  partialsBus.connect(filter);
  filter.connect(master);

  // --- ADSR envelope on master gain ---
  const t0 = startTime;
  const tAttack = t0 + attackDur;
  const tDecay = tAttack + decayDur;
  const totalLen = lengthSec ?? decayDur + 0.1;
  const tRelease = t0 + Math.max(totalLen - releaseDur, tDecay);
  const tEnd = tRelease + releaseDur;

  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(masterLevel, tAttack);
  master.gain.linearRampToValueAtTime(masterLevel * sustainLevel, tDecay);
  master.gain.setValueAtTime(masterLevel * sustainLevel, tRelease);
  master.gain.linearRampToValueAtTime(0, tEnd);

  for (const osc of oscs) {
    osc.start(t0);
    osc.stop(tEnd + 0.02);
  }

  return { oscs, partialGains, filter, master };
}

/**
 * Shift the fundamental frequency of a running piano voice.
 * We step every partial's frequency individually so the harmonic
 * relationship stays coherent as the pitch glides.
 */
function scheduleGlideVoice(
  voice: { oscs: OscillatorNode[] },
  times: number[],
  freqs: number[],
  baseT: number,
  speed: number,
  step: number
): void {
  for (let i = 0; i < PIANO_PARTIALS.length; i++) {
    const ratio = PIANO_PARTIALS[i].ratio;
    const osc = voice.oscs[i];
    if (!osc) continue;
    osc.frequency.setValueAtTime(Math.max(20, freqs[0] * ratio), baseT);
    for (let j = step; j < times.length; j += step) {
      const t = baseT + (times[j] - times[0]) / speed;
      osc.frequency.setValueAtTime(
        Math.max(20, Math.min(10000, freqs[j] * ratio)),
        t
      );
    }
  }
}

// ---------------------------------------------------------------------
// Public playback API
// ---------------------------------------------------------------------

interface PlayGlideOptions {
  times: number[];
  freqs: number[];
  speed?: number;
  onEnd?: () => void;
}

/** Play interpolated frequency glide with a piano-like timbre */
export async function playGlide({
  times,
  freqs,
  speed = 1,
  onEnd,
}: PlayGlideOptions): Promise<void> {
  stopAll();
  const ctx = getContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const now = ctx.currentTime + 0.05;
  const duration = Math.max(0.1, (times[times.length - 1] - times[0]) / speed);

  const voice = createPianoVoice(ctx, {
    freq: Math.max(50, freqs[0]),
    startTime: now,
    attackDur: 0.004,
    decayDur: Math.min(0.25, duration * 0.22),
    sustainLevel: 0.34,
    releaseDur: 0.3,
    peakGain: 0.3,
    velocityCurve: 0.82,
    lowpassHz: 6800,
    lengthSec: duration,
    onEnded: () => onEnd?.(),
  });
  voice.master.connect(ctx.destination);

  const scheduleStep = Math.max(1, Math.floor(times.length / 300));
  scheduleGlideVoice(voice, times, freqs, now, speed, scheduleStep);
}

/** Staccato playback of control points only — each note is a piano voice */
export async function playStaccato(
  points: ControlPoint[],
  speed = 1,
  onEnd?: () => void
): Promise<void> {
  stopAll();
  const ctx = getContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const sorted = [...points].sort((a, b) => a.t - b.t);
  const noteDur = 0.42 / speed;
  const ioi = 0.22 / speed;
  let start = ctx.currentTime + 0.05;

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const midi = p.midi;
    const vel = 0.62 + 0.25 * Math.sin((i / Math.max(1, sorted.length - 1)) * Math.PI);
    const voice = createPianoVoice(ctx, {
      freq: midiToHz(midi),
      startTime: start,
      attackDur: 0.003,
      decayDur: 0.24,
      sustainLevel: 0.18,
      releaseDur: 0.45,
      peakGain: 0.33,
      velocityCurve: vel,
      lowpassHz: 5600 + Math.max(0, midi - 55) * 80,
      lengthSec: noteDur,
    });
    voice.master.connect(ctx.destination);
    start += ioi;
  }

  const totalMs = (start - ctx.currentTime + noteDur + 0.1) * 1000;
  setTimeout(() => onEnd?.(), totalMs);
}

// ---------------------------------------------------------------------
// WAV export — render the same piano timbre offline as samples
// ---------------------------------------------------------------------

/** Export interpolated curve as WAV blob using piano-like synthesis */
export function exportWav(times: number[], freqs: number[], sampleRate = 44100): Blob {
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const duration = Math.max(0.1, t1 - t0);
  const numSamples = Math.floor((duration + 0.4) * sampleRate);
  const buffer = new Float32Array(numSamples);

  // Per-sample ADSR envelope matching playGlide()
  const attackN = Math.floor(0.004 * sampleRate);
  const decayN = Math.floor(Math.min(0.25, duration * 0.22) * sampleRate);
  const releaseN = Math.floor(0.3 * sampleRate);
  const releaseStart = Math.max(attackN + decayN, numSamples - releaseN);
  const sustainLevel = 0.34;
  const peakGain = 0.3;

  function env(i: number): number {
    if (i < attackN) return (i / Math.max(1, attackN)) * peakGain;
    if (i < attackN + decayN) {
      const u = (i - attackN) / Math.max(1, decayN);
      return peakGain * (1 - u * (1 - sustainLevel));
    }
    if (i < releaseStart) return peakGain * sustainLevel;
    if (i < numSamples) {
      const u = (i - releaseStart) / Math.max(1, releaseN);
      return Math.max(0, peakGain * sustainLevel * (1 - u));
    }
    return 0;
  }

  // Phase accumulator per partial (avoids clicks from recalculating sin each sample)
  const phases = new Float32Array(PIANO_PARTIALS.length);

  for (let i = 0; i < numSamples; i++) {
    const tSample = t0 + (i / sampleRate);

    // --- look up current glide frequency via piecewise linear lookup ---
    let idx = 0;
    while (idx < times.length - 1 && times[idx + 1] < tSample) idx++;
    const tA = times[idx];
    const tB = times[Math.min(idx + 1, times.length - 1)];
    const fA = freqs[idx];
    const fB = freqs[Math.min(idx + 1, freqs.length - 1)];
    const u = tB > tA ? (tSample - tA) / (tB - tA) : 0;
    const freq = fA + u * (fB - fA);

    // --- low-pass brightness curve ---
    const fNormalized = Math.min(1, freq / 1000);
    const brightness = 0.55 + 0.45 * 0.82;

    let s = 0;
    for (let k = 0; k < PIANO_PARTIALS.length; k++) {
      const p = PIANO_PARTIALS[k];
      const fk = Math.max(20, Math.min(20000, freq * p.ratio));
      // Cent detune as fractional frequency offset
      const fkDetuned = fk * Math.pow(2, p.detune / 1200);
      const partialLevel = p.gain * brightness * Math.max(0.15, 1 - k * (1 - 0.82) * 0.12);
      // Smooth low-pass-style roll-off for high partials as freq rises
      const roll = Math.max(0, 1 - (fk * 1.4 - 3500) / 14000) * (1 - 0.25 * fNormalized);
      const amp = partialLevel * Math.max(0, Math.min(1, roll));
      phases[k] += (2 * Math.PI * fkDetuned) / sampleRate;
      s += Math.sin(phases[k]) * amp;
    }
    // Normalize composite roughly so 6 partials sum to ~master peak
    s *= 0.52;
    buffer[i] = Math.max(-1, Math.min(1, s * env(i)));
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

export interface CompareSegment {
  label: string;
  times: number[];
  freqs: number[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Play methods back-to-back with gap; calls onSegmentChange for UI label */
export async function playCompare(
  segments: CompareSegment[],
  gapSec = 0.5,
  onSegmentChange?: (label: string | null) => void,
  onEnd?: () => void
): Promise<void> {
  stopAll();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    onSegmentChange?.(seg.label);
    await new Promise<void>((resolve) => {
      playGlide({ times: seg.times, freqs: seg.freqs, onEnd: resolve });
    });
    if (i < segments.length - 1) await sleep(gapSec * 1000);
  }
  onSegmentChange?.(null);
  onEnd?.();
}
