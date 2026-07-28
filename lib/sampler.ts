import { midiToHz } from './pitch';
import type { ControlPoint } from './interpolation';

export type InstrumentId =
  | 'piano'
  | 'guitar'
  | 'violin'
  | 'saxophone'
  | 'flute'
  | 'clarinet'
  | 'synth-brass';

export const INSTRUMENTS: { id: InstrumentId; label: string }[] = [
  { id: 'piano', label: 'Piano' },
  { id: 'guitar', label: 'Guitar' },
  { id: 'violin', label: 'Violin' },
  { id: 'saxophone', label: 'Sax' },
  { id: 'flute', label: 'Flute' },
  { id: 'clarinet', label: 'Clarinet' },
  { id: 'synth-brass', label: 'Brass' },
];

export interface CompareSegment {
  label: string;
  times: number[];
  freqs: number[];
}

declare global {
  interface Window {
    [key: string]: any;
  }
}

const GM_PRESET_KEYS: Record<InstrumentId, { cdn: string; varName: string }> = {
  'piano':      { cdn: '0000_FluidR3_GM_sf2_file',        varName: '_tone_0000_FluidR3_GM_sf2_file' },
  'guitar':     { cdn: '0250_LK_AcousticSteel_SF2_file',  varName: '_tone_0250_LK_AcousticSteel_SF2_file' },
  'violin':     { cdn: '0400_FluidR3_GM_sf2_file',        varName: '_tone_0400_FluidR3_GM_sf2_file' },
  'saxophone':  { cdn: '0650_FluidR3_GM_sf2_file',        varName: '_tone_0650_FluidR3_GM_sf2_file' },
  'flute':      { cdn: '0730_FluidR3_GM_sf2_file',        varName: '_tone_0730_FluidR3_GM_sf2_file' },
  'clarinet':   { cdn: '0710_FluidR3_GM_sf2_file',        varName: '_tone_0710_FluidR3_GM_sf2_file' },
  'synth-brass':{ cdn: '0620_FluidR3_GM_sf2_file',        varName: '_tone_0620_FluidR3_GM_sf2_file' },
};

const CDN_BASE = 'https://surikov.github.io/webaudiofontdata/sound/';

type WaveSlide = { when: number; delta: number };

let audioCtx: AudioContext | null = null;
let player: any = null;
let loadingInstruments: Set<InstrumentId> = new Set();
let loadedInstruments: Set<InstrumentId> = new Set();
let scriptLoadingPromise: Promise<boolean> | null = null;

function ensurePlayerScriptLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.WebAudioFontPlayer) return Promise.resolve(true);

  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="/WebAudioFontPlayer.js"]');
    if (existing) {
      const poll = () => {
        if (window.WebAudioFontPlayer) resolve(true);
        else setTimeout(poll, 50);
      };
      poll();
      return;
    }

    const script = document.createElement('script');
    script.src = '/WebAudioFontPlayer.js';
    script.onload = () => {
      resolve(!!window.WebAudioFontPlayer);
    };
    script.onerror = () => {
      console.error('[sampler] Failed to load /WebAudioFontPlayer.js');
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext || (window as any).webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  return audioCtx;
}

function getPlayer(): any {
  if (typeof window === 'undefined') return null;
  if (player) return player;

  if (typeof window.WebAudioFontPlayer === 'function') {
    try {
      player = new window.WebAudioFontPlayer();
    } catch (e) {
      console.warn('[sampler] WebAudioFontPlayer construction failed', e);
      return null;
    }
  } else {
    console.warn('[sampler] window.WebAudioFontPlayer not available yet');
    return null;
  }
  return player;
}

export function stopAll(): void {
  const ctx = getContext();
  if (player && player.envelopes) {
    try {
      for (const env of player.envelopes) {
        try {
          if (env.audioBufferSourceNode) {
            try { env.audioBufferSourceNode.onended = null; } catch { /* noop */ }
            try { env.audioBufferSourceNode.stop(); } catch { /* noop */ }
          }
          if (ctx && env.gain && typeof env.gain.cancelScheduledValues === 'function') {
            try { env.gain.cancelScheduledValues(ctx.currentTime); } catch { /* noop */ }
          }
        } catch { /* noop */ }
      }
      player.envelopes = [];
    } catch { /* noop */ }
  }
  if (audioCtx) {
    try { audioCtx.close(); } catch { /* noop */ }
    audioCtx = null;
    player = null;
  }
}

async function ensureInstrument(id: InstrumentId): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const scriptOk = await ensurePlayerScriptLoaded();
  if (!scriptOk) return false;

  if (loadedInstruments.has(id)) return true;

  const ctx = getContext();
  const pl = getPlayer();
  if (!ctx || !pl) return false;

  const key = GM_PRESET_KEYS[id];
  if (!key) return false;

  if (loadingInstruments.has(id)) {
    return new Promise<boolean>((resolve) => {
      const start = Date.now();
      const poll = () => {
        const preset = window[key.varName];
        const zonesReady = !!preset && !!preset.zones
          && preset.zones.every((z: any) => !!z.buffer);
        if (zonesReady) {
          loadedInstruments.add(id);
          resolve(true);
        } else if (Date.now() - start > 25000) {
          resolve(!!preset);
        } else {
          setTimeout(poll, 120);
        }
      };
      poll();
    });
  }

  loadingInstruments.add(id);
  try {
    const url = `${CDN_BASE}${key.cdn}.js`;
    console.log('[sampler] loading', id, url);
    pl.loader.startLoad(ctx, url, key.varName);
  } catch (e) {
    console.warn('[sampler] startLoad failed', id, e);
  }

  return new Promise<boolean>((resolve) => {
    const start = Date.now();
    const poll = () => {
      const preset = window[key.varName];
      const zonesReady = !!preset && !!preset.zones
        && preset.zones.every((z: any) => !!z.buffer);
      if (zonesReady) {
        loadedInstruments.add(id);
        console.log('[sampler] loaded', id);
        resolve(true);
      } else if (Date.now() - start > 25000) {
        console.warn('[sampler] load timed out for', id, 'preset present:', !!preset);
        resolve(!!preset);
      } else {
        setTimeout(poll, 120);
      }
    };
    poll();
  });
}

export async function ensureAllInstruments(): Promise<boolean> {
  const ids = Object.keys(GM_PRESET_KEYS) as InstrumentId[];
  const results = await Promise.all(ids.map(ensureInstrument));
  return results.every(Boolean);
}

function hzToMidi(hz: number): number {
  return 12 * Math.log2(Math.max(1, hz) / 440) + 69;
}

const INSTRUMENT_EXPRESSION: Record<
  InstrumentId,
  { vibratoDepthCents: number; vibratoHz: number; attackScoopCents: number }
> = {
  piano: { vibratoDepthCents: 0, vibratoHz: 0, attackScoopCents: 0 },
  guitar: { vibratoDepthCents: 12, vibratoHz: 4.8, attackScoopCents: 8 },
  violin: { vibratoDepthCents: 20, vibratoHz: 5.4, attackScoopCents: -12 },
  saxophone: { vibratoDepthCents: 16, vibratoHz: 5.0, attackScoopCents: -15 },
  flute: { vibratoDepthCents: 12, vibratoHz: 5.8, attackScoopCents: -8 },
  clarinet: { vibratoDepthCents: 10, vibratoHz: 4.6, attackScoopCents: -10 },
  'synth-brass': { vibratoDepthCents: 14, vibratoHz: 5.2, attackScoopCents: -12 },
};

function buildSlides(
  times: number[],
  freqs: number[],
  speed: number,
  startPitch: number,
  instrument: InstrumentId
): { slides: WaveSlide[]; duration: number } {
  const t0 = times[0];
  const tLast = times[times.length - 1];
  const tSpan = Math.max(0.1, tLast - t0);
  const timeScale = tSpan / speed;

  const slides: WaveSlide[] = [];
  const expr = INSTRUMENT_EXPRESSION[instrument] ?? INSTRUMENT_EXPRESSION['violin'];
  
  const vibDepthSemi = expr.vibratoDepthCents / 100;
  const scoopSemi = expr.attackScoopCents / 100;

  // Dense sampling for silky smooth pitch motion
  const targetPoints = Math.max(60, Math.floor(tSpan * 40));
  const step = Math.max(1, Math.floor(times.length / targetPoints));

  for (let j = step; j < times.length; j += step) {
    const normT = (times[j] - t0) / tSpan;
    const when = normT * timeScale;
    const basePitch = hzToMidi(freqs[j]);

    // Natural attack scoop in first 100ms
    let scoopOffset = 0;
    if (when < 0.10) {
      const u = when / 0.10;
      scoopOffset = scoopSemi * (1 - u * u);
    }

    // Expressive vibrato warming up smoothly
    const vibratoFade = Math.min(1, Math.max(0, (when - 0.05) / 0.20));
    const vibrato = Math.sin(2 * Math.PI * expr.vibratoHz * when) * vibDepthSemi * vibratoFade;

    const totalPitch = basePitch + scoopOffset + vibrato;

    slides.push({
      when: Math.max(0, when),
      delta: totalPitch - startPitch,
    });
  }

  const lastWhen = timeScale;
  if (slides.length === 0 || Math.abs(lastWhen - slides[slides.length - 1].when) > 0.01) {
    const pitch = hzToMidi(freqs[times.length - 1]);
    slides.push({ when: lastWhen, delta: pitch - startPitch });
  }

  const duration = Math.max(0.2, lastWhen);
  return { slides, duration };
}

function getPreset(id: InstrumentId): any {
  if (typeof window === 'undefined') return null;
  const key = GM_PRESET_KEYS[id];
  if (!key) return null;
  return window[key.varName] ?? null;
}

interface PlayGlideOptions {
  times: number[];
  freqs: number[];
  speed?: number;
  instrument?: InstrumentId;
  onEnd?: () => void;
}

export async function playGlide({
  times,
  freqs,
  speed = 1,
  instrument = 'piano',
  onEnd,
}: PlayGlideOptions): Promise<void> {
  if (typeof window === 'undefined') { onEnd?.(); return; }
  if (times.length < 2 || freqs.length < 2) { onEnd?.(); return; }
  stopAll();

  const ok = await ensureInstrument(instrument);
  if (!ok) {
    console.warn('[sampler] instrument not ready', instrument);
    onEnd?.();
    return;
  }
  const ctx = getContext();
  const pl = getPlayer();
  if (!ctx || !pl) {
    console.warn('[sampler] no audio ctx/player');
    onEnd?.();
    return;
  }
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* noop */ } }

  const preset = getPreset(instrument);
  if (!preset || !preset.zones || preset.zones.length === 0) {
    console.warn('[sampler] preset empty', instrument, !!preset);
    onEnd?.();
    return;
  }

  // Real acoustic piano glissando vs continuous expressive portamento for strings/winds
  if (instrument === 'piano') {
    const t0 = times[0];
    const tLast = times[times.length - 1];
    const tSpan = Math.max(0.1, tLast - t0);
    const timeScale = tSpan / speed;

    let lastMidi = Math.round(hzToMidi(freqs[0]));
    const now = ctx.currentTime + 0.04;
    let lastEnd = now;

    const sampleStep = Math.max(1, Math.floor(times.length / 60));
    for (let i = 0; i < times.length; i += sampleStep) {
      const normT = (times[i] - t0) / tSpan;
      const when = now + normT * timeScale;
      const currentMidi = Math.round(hzToMidi(freqs[i]));

      if (i === 0 || Math.abs(currentMidi - lastMidi) >= 1) {
        lastMidi = currentMidi;
        const noteDur = 0.55 / speed;
        try {
          pl.queueWaveTable(
            ctx,
            ctx.destination,
            preset,
            when,
            currentMidi,
            noteDur,
            0.62
          );
        } catch { /* noop */ }
        lastEnd = when + noteDur;
      }
    }
    const totalMs = Math.max(100, (lastEnd - ctx.currentTime + 0.5) * 1000);
    setTimeout(() => onEnd?.(), totalMs);
    return;
  }

  const startPitch = hzToMidi(freqs[0]);
  const { slides, duration } = buildSlides(times, freqs, speed, startPitch, instrument);
  const now = ctx.currentTime + 0.04;

  try {
    console.log('[sampler] playGlide humanized pitch=', startPitch, 'dur=', duration, 'slides=', slides.length);
    const env = pl.queueWaveTable(
      ctx,
      ctx.destination,
      preset,
      now,
      startPitch,
      duration + 0.6,
      0.62,
      slides
    );

    // Dynamic volume expression shaping (crescendo / decrescendo + attack/release)
    if (env && env.gain && typeof env.gain.linearRampToValueAtTime === 'function') {
      const g = env.gain;
      try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(0.35, now);
        g.linearRampToValueAtTime(0.65, now + 0.08);

        const step = Math.max(1, Math.floor(times.length / 20));
        const tSpan = times[times.length - 1] - times[0];
        for (let j = step; j < times.length; j += step) {
          const normT = (times[j] - times[0]) / (tSpan || 1);
          const tRel = now + normT * (duration || 1);
          const currentMidi = hzToMidi(freqs[j]);
          const pitchRatio = (currentMidi - startPitch) / 12;
          const vol = Math.max(0.40, Math.min(0.85, 0.62 + pitchRatio * 0.08));
          g.linearRampToValueAtTime(vol, tRel);
        }
        g.linearRampToValueAtTime(0.001, now + duration + 0.5);
      } catch { /* noop */ }
    }
  } catch (e) {
    console.warn('[sampler] queueWaveTable threw', e);
  }

  const totalMs = Math.max(100, (duration + 0.7) * 1000);
  setTimeout(() => onEnd?.(), totalMs);
}

export async function playStaccato(
  points: ControlPoint[],
  speed = 1,
  onEnd?: () => void,
  instrument: InstrumentId = 'piano'
): Promise<void> {
  if (typeof window === 'undefined') { onEnd?.(); return; }
  if (points.length === 0) { onEnd?.(); return; }
  stopAll();

  const ok = await ensureInstrument(instrument);
  if (!ok) { onEnd?.(); return; }
  const ctx = getContext();
  const pl = getPlayer();
  if (!ctx || !pl) { onEnd?.(); return; }
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* noop */ } }

  const preset = getPreset(instrument);
  if (!preset || !preset.zones || preset.zones.length === 0) { onEnd?.(); return; }

  const sorted = [...points].sort((a, b) => a.t - b.t);

  // Sustained note parameters:
  // noteDur: 0.45s / speed (warm sustain body & natural release tail)
  // minIoi: 0.60s / speed (leaves ~150ms breath/gap between notes so they remain distinct)
  const noteDur = 0.45 / speed;
  const minIoi = 0.60 / speed;
  const baseTime = ctx.currentTime + 0.05;

  const tSpan = sorted.length > 1 ? sorted[sorted.length - 1].t - sorted[0].t : 1;
  const timeScale = tSpan > 0 ? Math.max(0.65, (sorted.length * minIoi) / tSpan) : minIoi;

  let lastOnset = baseTime - minIoi;
  let lastEnd = baseTime;

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const arc = Math.sin((i / Math.max(1, sorted.length - 1)) * Math.PI);
    const vel = 0.62 + 0.25 * arc;
    const midiPitch = p.midi;

    let onset = baseTime + (p.t - sorted[0].t) * timeScale;
    if (onset < lastOnset + minIoi) {
      onset = lastOnset + minIoi;
    }
    lastOnset = onset;

    try {
      const env = pl.queueWaveTable(
        ctx,
        ctx.destination,
        preset,
        onset,
        midiPitch,
        noteDur,
        0.55 + 0.35 * vel
      );
      // Smooth decay tail for warm sustain
      if (env && env.gain && typeof env.gain.setTargetAtTime === 'function') {
        try {
          env.gain.setTargetAtTime(0.001, onset + noteDur * 0.7, 0.08);
        } catch { /* noop */ }
      }
    } catch (e) {
      console.warn('[sampler] staccato note failed', e);
    }
    lastEnd = onset + noteDur;
  }

  const totalMs = Math.max(100, (lastEnd - ctx.currentTime + 0.4) * 1000);
  setTimeout(() => onEnd?.(), totalMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function playCompare(
  segments: CompareSegment[],
  gapSec = 0.5,
  onSegmentChange?: (label: string | null) => void,
  onEnd?: () => void,
  instrument: InstrumentId = 'piano'
): Promise<void> {
  stopAll();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    onSegmentChange?.(seg.label);
    await new Promise<void>((resolve) => {
      playGlide({
        times: seg.times,
        freqs: seg.freqs,
        instrument,
        onEnd: resolve,
      });
    });
    if (i < segments.length - 1) await sleep(gapSec * 1000);
  }
  onSegmentChange?.(null);
  onEnd?.();
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export function exportWav(
  times: number[],
  freqs: number[],
  sampleRate = 44100,
  instrument: InstrumentId = 'piano'
): Blob {
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const duration = Math.max(0.1, t1 - t0);
  const extraTail = 0.5;
  const totalDur = duration + extraTail;
  const numSamples = Math.floor(totalDur * sampleRate);
  const buffer = new Float32Array(numSamples);

  const attack = 0.008;
  const release = 0.22;
  const attackN = Math.max(1, Math.floor(attack * sampleRate));
  const releaseN = Math.max(1, Math.floor(release * sampleRate));
  const releaseStart = Math.max(attackN, numSamples - releaseN);
  const peak = 0.55;

  function env(i: number): number {
    if (i < attackN) return (i / attackN) * peak;
    if (i < releaseStart) return peak;
    if (i < numSamples) {
      const u = (i - releaseStart) / Math.max(1, releaseN);
      return Math.max(0, peak * (1 - u));
    }
    return 0;
  }

  const phaseState = new Float32Array(6);
  const partialRatios = [1, 2, 3, 4, 5, 6];
  let partialGains: number[] = [];
  let lpAlpha = 0;
  switch (instrument) {
    case 'piano':
      partialGains = [1.0, 0.55, 0.32, 0.16, 0.08, 0.05];
      lpAlpha = Math.exp((-2 * Math.PI * 6200) / sampleRate);
      break;
    case 'guitar':
      partialGains = [0.95, 0.75, 0.45, 0.28, 0.15, 0.08];
      lpAlpha = Math.exp((-2 * Math.PI * 4800) / sampleRate);
      break;
    case 'violin':
      partialGains = [0.9, 0.5, 0.55, 0.22, 0.3, 0.12];
      lpAlpha = Math.exp((-2 * Math.PI * 5200) / sampleRate);
      break;
    case 'saxophone':
      partialGains = [0.75, 0.85, 0.65, 0.35, 0.18, 0.08];
      lpAlpha = Math.exp((-2 * Math.PI * 3800) / sampleRate);
      break;
    case 'flute':
      partialGains = [1.0, 0.16, 0.06, 0.025, 0.012, 0.006];
      lpAlpha = Math.exp((-2 * Math.PI * 3800) / sampleRate);
      break;
    case 'clarinet':
      partialGains = [0.95, 0.18, 0.65, 0.08, 0.4, 0.05];
      lpAlpha = Math.exp((-2 * Math.PI * 3500) / sampleRate);
      break;
    case 'synth-brass':
    default:
      partialGains = [0.85, 0.7, 0.45, 0.25, 0.12, 0.06];
      lpAlpha = Math.exp((-2 * Math.PI * 3200) / sampleRate);
      break;
  }

  let lpZ1 = 0;
  for (let i = 0; i < numSamples; i++) {
    const tSample = t0 + (i / sampleRate);
    let idx = 0;
    while (idx < times.length - 1 && times[idx + 1] < tSample) idx++;
    const tA = times[idx];
    const tB = times[Math.min(idx + 1, times.length - 1)];
    const fA = freqs[idx];
    const fB = freqs[Math.min(idx + 1, freqs.length - 1)];
    const u = tB > tA ? (tSample - tA) / (tB - tA) : 0;
    const freq = Math.max(20, fA + u * (fB - fA));

    let s = 0;
    for (let k = 0; k < partialRatios.length; k++) {
      const fk = Math.max(20, Math.min(16000, freq * partialRatios[k]));
      phaseState[k] += (2 * Math.PI * fk) / sampleRate;
      s += Math.sin(phaseState[k]) * partialGains[k];
    }
    s *= 0.35;

    lpZ1 = lpAlpha * lpZ1 + (1 - lpAlpha) * s;
    const final = lpZ1 * env(i);
    buffer[i] = Math.max(-1, Math.min(1, final));
  }

  const wavBuffer = encodeWav(buffer, sampleRate);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}
