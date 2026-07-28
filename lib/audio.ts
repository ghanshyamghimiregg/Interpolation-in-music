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

// ========================================================================
// Instrument presets
// Each preset defines how a single "note" is synthesized for both live
// playback and the offline WAV renderer.
// ========================================================================

export interface InstrumentPartial {
  ratio: number;
  gain: number;
  detune: number; // cents
  type?: OscillatorType; // sine (default) | triangle | sawtooth | square
  bandpass?: boolean;   // when true, route through band-pass (bow/breath feel)
}

export interface InstrumentNoise {
  gain: number;         // mix of noise (0..1)
  highpassHz: number;
  bandpassHz?: number;  // when set, use band-pass instead of HP only
  q?: number;
  attack: number;       // seconds — noise burst envelope
  decay: number;        // seconds
  sustain: number;      // 0..1 level retained after decay
}

export type InstrumentId =
  | 'piano'
  | 'guitar'
  | 'violin'
  | 'saxophone'
  | 'flute'
  | 'clarinet'
  | 'synth-brass';

export interface InstrumentFormant {
  freqHz: number;
  gain: number;   // 0..1 relative mix in the formant bus
  q: number;      // resonance Q
}

export interface InstrumentPreset {
  id: InstrumentId;
  label: string;
  partials: InstrumentPartial[];
  // Envelope (ADSR in seconds + sustain level)
  attack: number;
  decay: number;
  sustain: number;     // relative level 0..1
  release: number;
  // Master gain per voice (kept <0.5 to leave headroom)
  peakGain: number;
  // Filter applied to the summed partials + noise bus
  filterType: BiquadFilterType;
  filterHz: number;
  filterQ?: number;
  // Low-pass filter key-tracking: raises filterHz as MIDI pitch rises.
  // filterHz_final = filterHz + max(0, midi - filterKeyTrackBase) * filterKeyTrackPerMidi
  filterKeyTrackBase: number;
  filterKeyTrackPerMidi: number;
  // Velocity mapping: velocityCurve (0..1) → gain scalar + brightness scalar
  velToGain: (v: number) => number;
  velToBrightness: (v: number) => number; // multiplies higher-partial amplitudes
  // Whether to apply a gentle "slight vibrato" during sustains (bowed/breathy)
  vibratoHz?: number;
  vibratoCents?: number;
  vibratoDelay?: number;
  // Optional noise/breath component (bow scratch, breath, pick attack)
  noise?: InstrumentNoise;
  // Glide-specific overrides for envelope durations (if omitted, default to above)
  glideAttack?: number;
  glideDecay?: number;
  glideSustain?: number;
  glideRelease?: number;
  glideFilterHz?: number;

  // --- Realism extensions ---
  // Stretch tuning: cents of sharpness per octave away from A4 (MIDI 69).
  // Positive = stretched (typical piano), negative = compressed.
  stretchCentsPerOctave?: number;
  // Unison: number of slightly-detuned copies per partial. Creates chorus/thickness.
  unisonCount?: number;       // 1 (default) to 3
  unisonDetuneCents?: number; // max spread between copies (3-8 typical)
  // Pitch droop during release: slight flattening as note dies (cents).
  pitchDroopCents?: number;   // 0 to -12 typical (negative = flatten)
  pitchDroopWindow?: number;  // seconds over final release to apply droop
  // Body formants: parallel band-pass filters that resonate at fixed frequencies,
  // simulating violin body, piano soundboard, sax bell, clarinet bore, etc.
  formants?: InstrumentFormant[];
  // Release noise: triggered at key-off — dampers, key click, bow lift, tonehole thunk.
  releaseNoise?: InstrumentNoise;
  // Pluck/hammer attack click: short highpass noise burst at note-onset.
  // Applies after main envelope 0..attack window. Typical piano/guitar.
  hammerClickGain?: number;   // 0..0.2
  hammerClickHz?: number;     // highpass cutoff, 2000..8000
}

// ----------------------------------------------------------------------
// Piano — strong fundamental, hammer attack, rapid decay.
// ----------------------------------------------------------------------
const PIANO: InstrumentPreset = {
  id: 'piano',
  label: 'Piano',
  partials: [
    { ratio: 1, gain: 1.00, detune: 0 },
    { ratio: 2, gain: 0.55, detune: +2 },
    { ratio: 3, gain: 0.32, detune: -1 },
    { ratio: 4, gain: 0.16, detune: +4 },
    { ratio: 5, gain: 0.08, detune: -2 },
    { ratio: 6, gain: 0.05, detune: +3 },
  ],
  // Piano: instant attack, fast decay, low sustain (damper stops string) — natural piano character
  attack: 0.003,
  decay: 0.20,
  sustain: 0.12,
  release: 0.22,
  peakGain: 0.3,
  filterType: 'lowpass',
  filterHz: 6200,
  filterQ: 0.8,
  filterKeyTrackBase: 55,
  filterKeyTrackPerMidi: 45,
  velToGain: (v) => 0.55 + 0.55 * v,
  velToBrightness: (v) => 0.55 + 0.45 * v,
  stretchCentsPerOctave: 2.2,
  unisonCount: 3,
  unisonDetuneCents: 5,
  pitchDroopCents: -8,
  pitchDroopWindow: 0.11,
  formants: [
    { freqHz: 120, gain: 0.18, q: 2.2 },
    { freqHz: 300, gain: 0.14, q: 1.8 },
    { freqHz: 1250, gain: 0.08, q: 1.4 },
  ],
  releaseNoise: {
    gain: 0.09,
    highpassHz: 900,
    attack: 0.002,
    decay: 0.09,
    sustain: 0.0,
  },
  hammerClickGain: 0.1,
  hammerClickHz: 4200,
};

// ----------------------------------------------------------------------
// Guitar (steel-string-like) — strong 2nd harmonic, sharp pick attack,
// medium sustain, brighter high-end. Subtle pick-noise burst.
// ----------------------------------------------------------------------
const GUITAR: InstrumentPreset = {
  id: 'guitar',
  label: 'Guitar',
  partials: [
    { ratio: 1, gain: 0.95, detune: +1 },
    { ratio: 2, gain: 0.75, detune: -1 },
    { ratio: 3, gain: 0.45, detune: +2 },
    { ratio: 4, gain: 0.28, detune: -2 },
    { ratio: 5, gain: 0.15, detune: +3 },
    { ratio: 6, gain: 0.08, detune: -1 },
    { ratio: 7, gain: 0.04, detune: +2 },
  ],
  // Guitar: fast pluck attack, medium decay, moderate sustain (string rings but dampens)
  attack: 0.004,
  decay: 0.28,
  sustain: 0.35,
  release: 0.30,
  peakGain: 0.3,
  filterType: 'lowpass',
  filterHz: 4800,
  filterQ: 0.7,
  filterKeyTrackBase: 48,
  filterKeyTrackPerMidi: 55,
  velToGain: (v) => 0.5 + 0.6 * v,
  velToBrightness: (v) => 0.5 + 0.5 * v,
  noise: {
    gain: 0.18,
    highpassHz: 800,
    attack: 0.002,
    decay: 0.04,
    sustain: 0.0,
  },
  stretchCentsPerOctave: 1.0,
  unisonCount: 2,
  unisonDetuneCents: 6,
  pitchDroopCents: -6,
  pitchDroopWindow: 0.1,
  formants: [
    { freqHz: 100, gain: 0.14, q: 2.0 },
    { freqHz: 250, gain: 0.12, q: 1.6 },
    { freqHz: 820, gain: 0.09, q: 1.4 },
  ],
  releaseNoise: {
    gain: 0.05,
    highpassHz: 1400,
    attack: 0.003,
    decay: 0.07,
    sustain: 0.0,
  },
  hammerClickGain: 0.07,
  hammerClickHz: 5500,
};

// ----------------------------------------------------------------------
// Violin — bowed string: triangle-ish spectrum, strong odd harmonics,
// slow bow attack, medium vibrato, band-pass filter feel.
// ----------------------------------------------------------------------
const VIOLIN: InstrumentPreset = {
  id: 'violin',
  label: 'Violin',
  partials: [
    { ratio: 1, gain: 0.9, detune: 0, type: 'sawtooth' },
    { ratio: 2, gain: 0.5, detune: 0 },
    { ratio: 3, gain: 0.55, detune: +2 }, // odd harmonics strong in bowed strings
    { ratio: 4, gain: 0.22, detune: -1 },
    { ratio: 5, gain: 0.3, detune: +1 },
    { ratio: 6, gain: 0.12, detune: -2 },
    { ratio: 7, gain: 0.18, detune: +2 },
  ],
  // Violin: slow bow-pressure attack, high sustain (bow continuously drives string), short release
  attack: 0.09,
  decay: 0.10,
  sustain: 0.80,
  release: 0.18,
  peakGain: 0.26,
  filterType: 'bandpass',
  filterHz: 2400,
  filterQ: 1.6,
  filterKeyTrackBase: 60,
  filterKeyTrackPerMidi: 70,
  velToGain: (v) => 0.4 + 0.8 * v,
  velToBrightness: (v) => 0.4 + 0.6 * v,
  vibratoHz: 5.4,
  vibratoCents: 12,
  vibratoDelay: 0.25,
  noise: {
    gain: 0.05,
    highpassHz: 2500,
    attack: 0.04,
    decay: 0.08,
    sustain: 0.015,
  },
  glideAttack: 0.1,
  glideSustain: 0.85,   // bowed string: hold fully at volume during glide
  glideRelease: 0.20,
  stretchCentsPerOctave: 0,
  unisonCount: 2,
  unisonDetuneCents: 4.5,
  pitchDroopCents: -4,
  pitchDroopWindow: 0.12,
  formants: [
    { freqHz: 280, gain: 0.16, q: 2.4 },
    { freqHz: 520, gain: 0.12, q: 2.0 },
    { freqHz: 2200, gain: 0.1, q: 1.8 },
  ],
  releaseNoise: {
    gain: 0.045,
    highpassHz: 1800,
    attack: 0.003,
    decay: 0.06,
    sustain: 0.0,
  },
};

// ----------------------------------------------------------------------
// Saxophone — brassy woodwind: sawtooth core, strong 2nd/3rd harmonics,
// band-pass with higher Q, breath noise, vibrato.
// ----------------------------------------------------------------------
const SAX: InstrumentPreset = {
  id: 'saxophone',
  label: 'Saxophone',
  partials: [
    { ratio: 1, gain: 0.75, detune: 0, type: 'sawtooth' },
    { ratio: 2, gain: 0.85, detune: +1 }, // strong 2nd
    { ratio: 3, gain: 0.65, detune: -1 }, // strong 3rd
    { ratio: 4, gain: 0.35, detune: +2 },
    { ratio: 5, gain: 0.18, detune: -2 },
    { ratio: 6, gain: 0.08, detune: +1 },
  ],
  // Saxophone: reed attack, very high sustain (constant breath pressure), quick stop
  attack: 0.06,
  decay: 0.08,
  sustain: 0.82,
  release: 0.15,
  peakGain: 0.26,
  filterType: 'bandpass',
  filterHz: 1800,
  filterQ: 2.2,
  filterKeyTrackBase: 58,
  filterKeyTrackPerMidi: 65,
  velToGain: (v) => 0.4 + 0.8 * v,
  velToBrightness: (v) => 0.35 + 0.65 * v,
  vibratoHz: 5.0,
  vibratoCents: 14,
  vibratoDelay: 0.2,
  noise: {
    gain: 0.09,
    highpassHz: 2200,
    bandpassHz: 3800,
    q: 1.2,
    attack: 0.02,
    decay: 0.05,
    sustain: 0.03,
  },
  glideSustain: 0.88,   // saxophone: breath sustains fully during glide
  glideRelease: 0.15,
  stretchCentsPerOctave: 0,
  unisonCount: 1,
  pitchDroopCents: -10,
  pitchDroopWindow: 0.09,
  formants: [
    { freqHz: 220, gain: 0.15, q: 2.2 },
    { freqHz: 820, gain: 0.12, q: 2.0 },
    { freqHz: 1500, gain: 0.09, q: 1.6 },
  ],
  releaseNoise: {
    gain: 0.06,
    highpassHz: 1600,
    bandpassHz: 3000,
    q: 1.0,
    attack: 0.002,
    decay: 0.05,
    sustain: 0.0,
  },
};

// ----------------------------------------------------------------------
// Flute — pure sine-ish fundamental with gentle harmonics, slow
// breathy attack, very soft vibrato, subtle breath noise.
// ----------------------------------------------------------------------
const FLUTE: InstrumentPreset = {
  id: 'flute',
  label: 'Flute',
  partials: [
    { ratio: 1, gain: 1.0, detune: 0 },
    { ratio: 2, gain: 0.16, detune: 0 },
    { ratio: 3, gain: 0.06, detune: +1 },
    { ratio: 4, gain: 0.025, detune: -1 },
  ],
  // Flute: slow breathy onset, very high sustain (continuous breath), gentle fade
  attack: 0.14,
  decay: 0.06,
  sustain: 0.88,
  release: 0.18,
  peakGain: 0.28,
  filterType: 'lowpass',
  filterHz: 3800,
  filterQ: 0.6,
  filterKeyTrackBase: 60,
  filterKeyTrackPerMidi: 60,
  velToGain: (v) => 0.35 + 0.8 * v,
  velToBrightness: (v) => 0.3 + 0.7 * v,
  vibratoHz: 5.6,
  vibratoCents: 6,
  vibratoDelay: 0.35,
  noise: {
    gain: 0.07,
    highpassHz: 3000,
    attack: 0.04,
    decay: 0.15,
    sustain: 0.02,
  },
  glideSustain: 0.90,   // flute: breath sustains fully during glide
  glideRelease: 0.20,
  stretchCentsPerOctave: 0,
  unisonCount: 1,
  pitchDroopCents: -6,
  pitchDroopWindow: 0.1,
  formants: [
    { freqHz: 450, gain: 0.1, q: 1.8 },
    { freqHz: 1600, gain: 0.07, q: 1.6 },
  ],
  releaseNoise: {
    gain: 0.04,
    highpassHz: 2200,
    attack: 0.002,
    decay: 0.06,
    sustain: 0.0,
  },
};

// ----------------------------------------------------------------------
// Clarinet — odd harmonics dominant (closed-pipe), clarinet-like formant
// filter. Warm and hollow.
// ----------------------------------------------------------------------
const CLARINET: InstrumentPreset = {
  id: 'clarinet',
  label: 'Clarinet',
  partials: [
    { ratio: 1, gain: 0.95, detune: 0, type: 'triangle' },
    { ratio: 3, gain: 0.65, detune: +1 }, // strong 3rd
    { ratio: 5, gain: 0.4, detune: -1 },  // strong 5th
    { ratio: 2, gain: 0.18, detune: +1 }, // weak even harmonics
    { ratio: 7, gain: 0.22, detune: +2 },
    { ratio: 4, gain: 0.08, detune: -1 },
    { ratio: 9, gain: 0.1, detune: +1 },
  ],
  // Clarinet: reed onset, very high sustain (continuous reed vibration), abrupt stop
  attack: 0.05,
  decay: 0.08,
  sustain: 0.82,
  release: 0.14,
  peakGain: 0.28,
  filterType: 'bandpass',
  filterHz: 1500,
  filterQ: 2.8,
  filterKeyTrackBase: 55,
  filterKeyTrackPerMidi: 55,
  velToGain: (v) => 0.4 + 0.8 * v,
  velToBrightness: (v) => 0.35 + 0.65 * v,
  vibratoHz: 4.6,
  vibratoCents: 9,
  vibratoDelay: 0.25,
  noise: {
    gain: 0.035,
    highpassHz: 1800,
    attack: 0.02,
    decay: 0.04,
    sustain: 0.01,
  },
  glideSustain: 0.88,   // clarinet: reed sustains fully during glide
  glideRelease: 0.16,
  stretchCentsPerOctave: 0,
  unisonCount: 1,
  pitchDroopCents: -8,
  pitchDroopWindow: 0.1,
  formants: [
    { freqHz: 140, gain: 0.13, q: 2.0 },
    { freqHz: 1100, gain: 0.1, q: 2.4 },
  ],
  releaseNoise: {
    gain: 0.05,
    highpassHz: 1500,
    attack: 0.003,
    decay: 0.07,
    sustain: 0.0,
  },
};

// ----------------------------------------------------------------------
// Synth brass — bright sawtooth stack with LP filter, used as a
// non-orchestral "other" option in the picker.
// ----------------------------------------------------------------------
const SYNTH_BRASS: InstrumentPreset = {
  id: 'synth-brass',
  label: 'Synth Brass',
  partials: [
    { ratio: 1, gain: 0.85, detune: 0, type: 'sawtooth' },
    { ratio: 2, gain: 0.7, detune: +3 },
    { ratio: 3, gain: 0.45, detune: -2 },
    { ratio: 4, gain: 0.25, detune: +2 },
    { ratio: 5, gain: 0.12, detune: -1 },
  ],
  // Synth Brass: punchy attack with filter sweep, sustained pad tone, moderate release
  attack: 0.04,
  decay: 0.12,
  sustain: 0.70,
  release: 0.20,
  peakGain: 0.28,
  filterType: 'lowpass',
  filterHz: 3200,
  filterQ: 1.1,
  filterKeyTrackBase: 48,
  filterKeyTrackPerMidi: 80,
  velToGain: (v) => 0.45 + 0.7 * v,
  velToBrightness: (v) => 0.35 + 0.65 * v,
  vibratoHz: 4.8,
  vibratoCents: 6,
  vibratoDelay: 0.2,
  glideSustain: 0.75,   // synth brass: full pad sustain during glide
  glideRelease: 0.22,
  stretchCentsPerOctave: 0,
  unisonCount: 2,
  unisonDetuneCents: 7,
  pitchDroopCents: -3,
  pitchDroopWindow: 0.1,
  formants: [
    { freqHz: 180, gain: 0.1, q: 1.8 },
    { freqHz: 700, gain: 0.08, q: 1.6 },
  ],
};

export const INSTRUMENTS: { id: InstrumentId; label: string }[] = [
  { id: 'piano', label: 'Piano' },
  { id: 'guitar', label: 'Guitar' },
  { id: 'violin', label: 'Violin' },
  { id: 'saxophone', label: 'Sax' },
  { id: 'flute', label: 'Flute' },
  { id: 'clarinet', label: 'Clarinet' },
  { id: 'synth-brass', label: 'Brass' },
];

export function getInstrument(id: InstrumentId): InstrumentPreset {
  switch (id) {
    case 'guitar': return GUITAR;
    case 'violin': return VIOLIN;
    case 'saxophone': return SAX;
    case 'flute': return FLUTE;
    case 'clarinet': return CLARINET;
    case 'synth-brass': return SYNTH_BRASS;
    case 'piano':
    default:
      return PIANO;
  }
}

// ========================================================================
// Voice factory (AudioContext live synthesis)
// ========================================================================

interface CreateVoiceOptions {
  instrument: InstrumentPreset;
  freq: number;
  midiPitch?: number;
  startTime: number;
  velocity?: number;   // 0..1
  lengthSec?: number;  // total intended length; helps schedule release
  // Override envelope/filter for a specific usage (e.g. glide vs. staccato)
  attackOverride?: number;
  decayOverride?: number;
  sustainOverride?: number;
  releaseOverride?: number;
  filterHzOverride?: number;
  onEnded?: () => void;
}

interface Voice {
  partials: { osc: OscillatorNode; gain: GainNode; baseRatio: number; baseDetuneCents: number }[];
  vibratoLfo?: OscillatorNode;
  vibratoDepth?: GainNode;
  noise?: { source: AudioBufferSourceNode | null; hp: BiquadFilterNode; gain: GainNode };
  releaseNoise?: { source: AudioBufferSourceNode | null; hp: BiquadFilterNode; gain: GainNode };
  hammerClick?: { source: AudioBufferSourceNode | null; hp: BiquadFilterNode; gain: GainNode };
  formantBusses?: { bp: BiquadFilterNode; gain: GainNode }[];
  filter: BiquadFilterNode;
  master: GainNode;
}

function buildBufferNoise(ctx: AudioContext, seconds = 1): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function createVoice(ctx: AudioContext, opts: CreateVoiceOptions): Voice {
  const { instrument, freq, midiPitch, startTime, velocity = 0.8 } = opts;
  const midi = midiPitch ?? Math.max(0, Math.round(Math.log2(freq / 440) * 12 + 69));

  const attack = opts.attackOverride ?? instrument.attack;
  const decay = opts.decayOverride ?? instrument.decay;
  const sustain = opts.sustainOverride ?? instrument.sustain;
  const release = opts.releaseOverride ?? instrument.release;
  const filterHz = opts.filterHzOverride
    ?? instrument.filterHz + Math.max(0, midi - instrument.filterKeyTrackBase) * instrument.filterKeyTrackPerMidi;

  const gainMul = instrument.velToGain(velocity);
  const brightness = instrument.velToBrightness(velocity);

  // Stretch tuning: deviation from A4 (MIDI 69) gives cents offset.
  const stretchPerOct = instrument.stretchCentsPerOctave ?? 0;
  const stretchCents = stretchPerOct !== 0 ? ((midi - 69) / 12) * stretchPerOct : 0;

  // Unison: how many copies per partial, spread across the detune range.
  const unisonCount = Math.max(1, Math.min(3, instrument.unisonCount ?? 1));
  const unisonDetune = instrument.unisonDetuneCents ?? 0;

  const partials: Voice['partials'] = [];
  const partialsBus = ctx.createGain();
  partialsBus.gain.value = 1;

  let activeCount = 0;
  const tryCallEnded = () => {
    activeCount--;
    if (activeCount <= 0) opts.onEnded?.();
  };

  for (let i = 0; i < instrument.partials.length; i++) {
    const p = instrument.partials[i];
    const velRoll = Math.max(0.15, 1 - i * (1 - velocity) * 0.14);
    const baseLevel = p.gain * brightness * velRoll;

    for (let u = 0; u < unisonCount; u++) {
      // Spread unison copies across [-unisonDetune/2, +unisonDetune/2]
      const unisonSpread = unisonCount > 1
        ? ((u / (unisonCount - 1)) - 0.5) * unisonDetune
        : 0;
      const level = baseLevel / Math.sqrt(unisonCount);

      const g = ctx.createGain();
      g.gain.value = level;

      const osc = ctx.createOscillator();
      osc.type = p.type ?? 'sine';
      osc.frequency.value = Math.max(20, freq * p.ratio);
      // Apply: preset partial detune + stretch tuning + unison spread
      osc.detune.value = p.detune + stretchCents + unisonSpread;

      osc.connect(g);
      g.connect(partialsBus);
      partials.push({ osc, gain: g, baseRatio: p.ratio, baseDetuneCents: p.detune });
      activeCount++;
      osc.onended = tryCallEnded;
    }
  }

  const filter = ctx.createBiquadFilter();
  filter.type = instrument.filterType;
  filter.Q.value = instrument.filterQ ?? 0.8;
  filter.frequency.value = Math.max(60, Math.min(18000, filterHz));

  // Formant busses: parallel band-pass filters feeding master with fixed resonant peaks
  let formantBusses: Voice['formantBusses'] | undefined;
  if (instrument.formants && instrument.formants.length > 0) {
    formantBusses = [];
  }

  const master = ctx.createGain();
  master.gain.value = 0;

  // Optional vibrato — global detune LFO applied to all partial oscillators
  let vibratoLfo: OscillatorNode | undefined;
  let vibratoDepth: GainNode | undefined;
  if (instrument.vibratoHz && instrument.vibratoCents && instrument.vibratoCents > 0) {
    vibratoLfo = ctx.createOscillator();
    vibratoLfo.type = 'sine';
    vibratoLfo.frequency.value = instrument.vibratoHz;
    vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = 0;
    const delay = instrument.vibratoDelay ?? 0;
    vibratoDepth.gain.setValueAtTime(0, startTime);
    vibratoDepth.gain.linearRampToValueAtTime(instrument.vibratoCents, startTime + delay + 0.12);
    vibratoLfo.connect(vibratoDepth);
    for (const { osc } of partials) vibratoDepth.connect(osc.detune);
    vibratoLfo.start(startTime);
    vibratoLfo.stop(startTime + (opts.lengthSec ?? 2) + 0.1);
  }

  // ADSR on master gain + pitch-droop window calculation (done before scheduling)
  const totalLen = opts.lengthSec ?? (attack + decay + 0.2);
  const t0 = startTime;
  const tAttack = t0 + attack;
  const tDecay = tAttack + decay;
  const tRelease = t0 + Math.max(totalLen - release, tDecay);
  const tEnd = tRelease + release;
  const peak = instrument.peakGain * gainMul;

  // Pitch droop: ramp cents flat during the final droop window of release
  const droopCents = instrument.pitchDroopCents ?? 0;
  const droopWindow = Math.min(release, instrument.pitchDroopWindow ?? Math.min(0.12, release));
  const tDroopStart = Math.max(tRelease, tEnd - droopWindow);
  if (droopCents !== 0 && partials.length > 0) {
    for (const { osc } of partials) {
      osc.detune.setValueAtTime(osc.detune.value, tDroopStart);
      osc.detune.linearRampToValueAtTime(osc.detune.value + droopCents, tEnd);
    }
  }

  // Optional noise bus (pick attack, breath, bow scratch)
  let noise: Voice['noise'] | undefined;
  let hammerClick: Voice['hammerClick'] | undefined;
  let releaseNoise: Voice['releaseNoise'] | undefined;

  partialsBus.connect(filter);

  // Build formant parallel busses: each taps the filter output, applies band-pass
  // at fixed freq, then sums into master.
  if (formantBusses && instrument.formants) {
    for (const fDef of instrument.formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.max(40, Math.min(16000, fDef.freqHz));
      bp.Q.value = Math.max(0.5, fDef.q);
      const fg = ctx.createGain();
      fg.gain.value = Math.max(0, Math.min(1, fDef.gain));
      filter.connect(bp);
      bp.connect(fg);
      fg.connect(master);
      formantBusses.push({ bp, gain: fg });
    }
  }

  filter.connect(master);

  // ADSR on master gain
  master.gain.setValueAtTime(0, t0);
  if (attack > 0) {
    master.gain.linearRampToValueAtTime(peak, tAttack);
  } else {
    master.gain.setValueAtTime(peak, tAttack);
  }
  master.gain.linearRampToValueAtTime(Math.max(0, peak * sustain), tDecay);
  master.gain.setValueAtTime(Math.max(0, peak * sustain), tRelease);
  master.gain.linearRampToValueAtTime(0, tEnd);

  for (const { osc } of partials) {
    osc.start(t0);
    osc.stop(tEnd + 0.02);
  }

  return { partials, vibratoLfo, vibratoDepth, noise, releaseNoise, hammerClick, formantBusses, filter, master };
}

/** Shift all partials' frequencies in lock-step over a glide using linear pitch ramps. */
function scheduleVoiceGlide(
  voice: Voice,
  times: number[],
  freqs: number[],
  baseT: number,
  speed: number,
  step: number
): void {
  for (const p of voice.partials) {
    const { osc, baseRatio, baseDetuneCents } = p;
    const startF = Math.max(20, Math.min(12000, freqs[0] * baseRatio));
    osc.frequency.cancelScheduledValues(baseT);
    osc.frequency.setValueAtTime(startF, baseT);
    void baseDetuneCents;

    for (let j = step; j < times.length; j += step) {
      const t = baseT + (times[j] - times[0]) / speed;
      const targetF = Math.max(20, Math.min(12000, freqs[j] * baseRatio));
      osc.frequency.linearRampToValueAtTime(targetF, t);
    }
  }
}

// ========================================================================
// Public playback API
// ========================================================================

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
  stopAll();
  const ctx = getContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const preset = getInstrument(instrument);
  const now = ctx.currentTime + 0.05;
  const duration = Math.max(0.1, (times[times.length - 1] - times[0]) / speed);

  // Continuous physical synthesis voice for ALL instruments (including Piano)
  const voice = createVoice(ctx, {
    instrument: preset,
    freq: Math.max(50, freqs[0]),
    startTime: now,
    velocity: 0.82,
    lengthSec: duration,
    attackOverride: preset.glideAttack,
    decayOverride: preset.glideDecay,
    sustainOverride: preset.glideSustain,
    releaseOverride: preset.glideRelease,
    filterHzOverride: preset.glideFilterHz,
    onEnded: () => onEnd?.(),
  });
  voice.master.connect(ctx.destination);

  const scheduleStep = Math.max(1, Math.floor(times.length / 150));
  scheduleVoiceGlide(voice, times, freqs, now, speed, scheduleStep);

  const totalMs = (duration + 0.4) * 1000;
  setTimeout(() => onEnd?.(), totalMs);
}

export async function playStaccato(
  points: ControlPoint[],
  speed = 1,
  onEnd?: () => void,
  instrument: InstrumentId = 'piano'
): Promise<void> {
  stopAll();
  const ctx = getContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const preset = getInstrument(instrument);
  const sorted = [...points].sort((a, b) => a.t - b.t);

  // Staccato notes: short crisp duration with ~50% gap between notes
  const noteDur = 0.25 / speed;
  const minIoi = 0.50 / speed;
  const baseTime = ctx.currentTime + 0.05;

  const tSpan = sorted.length > 1 ? sorted[sorted.length - 1].t - sorted[0].t : 1;
  const timeScale = tSpan > 0 ? Math.max(0.65, (sorted.length * minIoi) / tSpan) : minIoi;

  let lastOnset = baseTime - minIoi;
  let lastEnd = baseTime;

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const midi = p.midi;
    const arc = Math.sin((i / Math.max(1, sorted.length - 1)) * Math.PI);
    const vel = 0.60 + 0.28 * arc;

    let onset = baseTime + (p.t - sorted[0].t) * timeScale;
    if (onset < lastOnset + minIoi) {
      onset = lastOnset + minIoi;
    }
    lastOnset = onset;

    const voice = createVoice(ctx, {
      instrument: preset,
      freq: midiToHz(midi),
      midiPitch: midi,
      startTime: onset,
      velocity: Math.max(0.15, Math.min(1, vel)),
      lengthSec: noteDur,
      // Force short staccato sustain regardless of preset — keeps notes crisp and distinct
      sustainOverride: 0.10,
      releaseOverride: 0.12,
    });
    voice.master.connect(ctx.destination);
    lastEnd = onset + noteDur;
  }

  const totalMs = Math.max(100, (lastEnd - ctx.currentTime + 0.4) * 1000);
  setTimeout(() => onEnd?.(), totalMs);
}

export interface CompareSegment {
  label: string;
  times: number[];
  freqs: number[];
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

// ========================================================================
// Offline WAV rendering — same instrument model, sample by sample.
// ========================================================================

export function exportWav(
  times: number[],
  freqs: number[],
  sampleRate = 44100,
  instrument: InstrumentId = 'piano'
): Blob {
  const preset = getInstrument(instrument);
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const duration = Math.max(0.1, t1 - t0);
  const numSamples = Math.floor((duration + Math.max(0.4, preset.release)) * sampleRate);
  const buffer = new Float32Array(numSamples);

  const attackN = Math.max(1, Math.floor((preset.glideAttack ?? preset.attack) * sampleRate));
  const decayN = Math.max(1, Math.floor((preset.glideDecay ?? preset.decay) * sampleRate));
  const releaseN = Math.max(1, Math.floor((preset.glideRelease ?? preset.release) * sampleRate));
  const sustainLevel = preset.glideSustain ?? preset.sustain;

  let avgF = 0;
  for (let i = 0; i < freqs.length; i++) avgF += freqs[i];
  avgF /= Math.max(1, freqs.length);
  const avgMidi = Math.max(0, Math.round(Math.log2(avgF / 440) * 12 + 69));
  const filterHz = Math.max(
    60,
    Math.min(
      18000,
      (preset.glideFilterHz ?? preset.filterHz) +
        Math.max(0, avgMidi - preset.filterKeyTrackBase) * preset.filterKeyTrackPerMidi
    )
  );

  const releaseStart = Math.max(attackN + decayN, numSamples - releaseN);
  const peak = preset.peakGain * preset.velToGain(0.85);
  function env(i: number): number {
    if (i < attackN) return (i / attackN) * peak;
    if (i < attackN + decayN) {
      const u = (i - attackN) / Math.max(1, decayN);
      return peak * (1 - u * (1 - sustainLevel));
    }
    if (i < releaseStart) return peak * sustainLevel;
    if (i < numSamples) {
      const u = (i - releaseStart) / Math.max(1, releaseN);
      return Math.max(0, peak * sustainLevel * (1 - u));
    }
    return 0;
  }

  const stretchPerOct = preset.stretchCentsPerOctave ?? 0;
  const stretchCents = stretchPerOct !== 0 ? ((avgMidi - 69) / 12) * stretchPerOct : 0;

  const unisonCount = Math.max(1, Math.min(3, preset.unisonCount ?? 1));
  const unisonDetune = preset.unisonDetuneCents ?? 0;

  const P = preset.partials.length;
  const phases = new Float32Array(P * unisonCount);
  const brightness = preset.velToBrightness(0.85);
  const hasVib = preset.vibratoHz && preset.vibratoCents && preset.vibratoCents > 0;
  const vibAngVel = hasVib ? (2 * Math.PI * (preset.vibratoHz ?? 0)) / sampleRate : 0;
  const vibCents = preset.vibratoCents ?? 0;
  const vibDelayN = (preset.vibratoDelay ?? 0) * sampleRate;

  const droopCents = preset.pitchDroopCents ?? 0;
  const droopWindowS = Math.min(preset.release ?? 0.2, preset.pitchDroopWindow ?? 0.12);
  const droopStart = Math.max(releaseStart, numSamples - Math.floor(droopWindowS * sampleRate));
  function droopAt(i: number): number {
    if (droopCents === 0 || i < droopStart) return 0;
    const u = numSamples > droopStart ? (i - droopStart) / (numSamples - droopStart) : 0;
    return droopCents * Math.max(0, Math.min(1, u));
  }

  const f0 = Math.min(filterHz, sampleRate / 3);
  const lpA1 = Math.exp((-2 * Math.PI * f0) / sampleRate);
  const lpA1Hi = Math.exp((-2 * Math.PI * 1200) / sampleRate);
  let lpZ1 = 0;
  let lpZ1Hi = 0;

  // Per-formant band-pass states (simple resonator approximation)
  const formantStates: { z1: number; z2: number; a1: number; a2: number; b0: number; gain: number }[] = [];
  if (preset.formants) {
    for (const fDef of preset.formants) {
      const fr = Math.max(40, Math.min(sampleRate / 3, fDef.freqHz));
      const q = Math.max(0.5, fDef.q);
      const omega = (2 * Math.PI * fr) / sampleRate;
      const alpha = Math.sin(omega) / (2 * q);
      const cosw = Math.cos(omega);
      const b0 = alpha;
      const a1 = -2 * cosw;
      const a2 = 1 - alpha;
      const norm = 1 + a1 + a2;
      formantStates.push({
        z1: 0, z2: 0,
        a1: a1 / (1 + a1 + a2),
        a2: a2 / (1 + a1 + a2),
        b0: b0 / norm,
        gain: fDef.gain,
      });
    }
  }

  const noiseCfg = preset.noise;
  let noiseRateAtk = 1 / Math.max(1, Math.floor((noiseCfg?.attack ?? 0.01) * sampleRate));
  let noiseRateDec = 1 / Math.max(1, Math.floor((noiseCfg?.decay ?? 0.05) * sampleRate));
  let noiseEnv = 0;

  const releaseNoiseCfg = preset.releaseNoise;
  const relNoiseAtkN = releaseNoiseCfg ? Math.floor(releaseNoiseCfg.attack * sampleRate) : 0;
  const relNoiseDecN = releaseNoiseCfg ? Math.floor(releaseNoiseCfg.decay * sampleRate) : 0;
  const relNoiseRateAtk = releaseNoiseCfg ? 1 / Math.max(1, relNoiseAtkN) : 0;
  const relNoiseRateDec = releaseNoiseCfg ? 1 / Math.max(1, relNoiseDecN) : 0;
  let relNoiseEnv = 0;

  const hammerGain = preset.hammerClickGain ?? 0;
  const hammerHz = preset.hammerClickHz ?? 4000;
  const hammerHpA1 = hammerGain > 0 ? Math.exp((-2 * Math.PI * hammerHz) / sampleRate) : 0;
  let hammerHpZ1 = 0;

  for (let i = 0; i < numSamples; i++) {
    const tSample = t0 + (i / sampleRate);
    let idx = 0;
    while (idx < times.length - 1 && times[idx + 1] < tSample) idx++;
    const tA = times[idx];
    const tB = times[Math.min(idx + 1, times.length - 1)];
    const fA = freqs[idx];
    const fB = freqs[Math.min(idx + 1, freqs.length - 1)];
    const uInterp = tB > tA ? (tSample - tA) / (tB - tA) : 0;
    const freq = Math.max(20, fA + uInterp * (fB - fA));
    const fNorm = Math.min(1, freq / 1500);

    const curMidi = Math.log2(freq / 440) * 12 + 69;
    const dynamicStretch = stretchPerOct !== 0
      ? ((curMidi - 69) / 12) * stretchPerOct
      : stretchCents;

    let vibCentsNow = 0;
    if (hasVib) {
      const ramp = Math.max(0, Math.min(1, (i - vibDelayN) / (0.12 * sampleRate + 1)));
      vibCentsNow = Math.sin(i * vibAngVel) * vibCents * ramp;
    }
    const droopNow = droopAt(i);

    let s = 0;
    for (let k = 0; k < P; k++) {
      const p = preset.partials[k];
      const velRoll = Math.max(0.15, 1 - k * (1 - 0.85) * 0.14);
      const partialLevel = p.gain * brightness * velRoll;

      for (let uni = 0; uni < unisonCount; uni++) {
        const uniSpread = unisonCount > 1
          ? ((uni / (unisonCount - 1)) - 0.5) * unisonDetune
          : 0;
        const totalCents = vibCentsNow + droopNow + p.detune + dynamicStretch + uniSpread;
        const fk = Math.max(20, Math.min(16000, freq * p.ratio * Math.pow(2, totalCents / 1200)));
        const roll = Math.max(0, 1 - (fk * 1.2 - 2000) / 15000) * (1 - 0.25 * fNorm);
        const amp = (partialLevel / Math.sqrt(unisonCount)) * Math.max(0, Math.min(1, roll));
        const pi = k * unisonCount + uni;
        phases[pi] += (2 * Math.PI * fk) / sampleRate;

        let w = Math.sin(phases[pi]);
        if (p.type === 'sawtooth') {
          const saw = 2 * ((phases[pi] / (2 * Math.PI)) - Math.floor(phases[pi] / (2 * Math.PI) + 0.5));
          w = w * 0.55 + saw * 0.55;
        } else if (p.type === 'triangle') {
          const x = phases[pi] / (2 * Math.PI);
          const tri = 4 * Math.abs(x - Math.floor(x + 0.5)) - 1;
          w = w * 0.5 + tri * 0.7;
        }
        s += w * amp;
      }
    }
    s *= 0.48;

    if (noiseCfg) {
      const envDurAtk = Math.floor(noiseCfg.attack * sampleRate);
      if (i < envDurAtk) noiseEnv = Math.min(noiseCfg.gain, noiseEnv + noiseCfg.gain * noiseRateAtk);
      else if (noiseEnv > noiseCfg.gain * noiseCfg.sustain) noiseEnv = Math.max(noiseCfg.gain * noiseCfg.sustain, noiseEnv - noiseCfg.gain * noiseRateDec);
      if (i >= releaseStart) {
        const uR = (i - releaseStart) / Math.max(1, numSamples - releaseStart);
        noiseEnv = Math.max(0, noiseEnv * (1 - uR));
      }
      const n = (Math.random() * 2 - 1);
      const nHi = n - lpZ1Hi;
      lpZ1Hi = lpZ1Hi + (1 - lpA1Hi) * nHi * 0.55;
      s += nHi * noiseEnv * 0.9;
    }

    if (hammerGain > 0 && i < attackN + Math.floor(0.05 * sampleRate)) {
      const hAtkN = Math.max(1, Math.floor(0.001 * sampleRate));
      const hDecN = Math.max(1, Math.floor((0.001 + (preset.glideAttack ?? preset.attack) * 1.5) * sampleRate));
      let hEnv = 0;
      if (i < hAtkN) hEnv = (i / hAtkN) * hammerGain;
      else if (i < hDecN) {
        const uu = (i - hAtkN) / Math.max(1, hDecN - hAtkN);
        hEnv = hammerGain * (1 - uu);
      }
      const n = (Math.random() * 2 - 1);
      const hpHp = n - hammerHpZ1;
      hammerHpZ1 = hammerHpZ1 + (1 - hammerHpA1) * hpHp;
      s += hpHp * hEnv;
    }

    if (releaseNoiseCfg && i >= releaseStart) {
      const relI = i - releaseStart;
      if (relI < relNoiseAtkN) {
        relNoiseEnv = Math.min(releaseNoiseCfg.gain, relNoiseEnv + releaseNoiseCfg.gain * relNoiseRateAtk);
      } else if (relNoiseEnv > releaseNoiseCfg.gain * releaseNoiseCfg.sustain) {
        relNoiseEnv = Math.max(releaseNoiseCfg.gain * releaseNoiseCfg.sustain, relNoiseEnv - releaseNoiseCfg.gain * relNoiseRateDec);
      }
      if (relNoiseEnv < releaseNoiseCfg.gain * releaseNoiseCfg.sustain * 0.005) relNoiseEnv = 0;
      const n = (Math.random() * 2 - 1);
      const nHi = n - lpZ1Hi * 0.6;
      s += nHi * relNoiseEnv * 0.8;
    }

    const sRaw = s;
    lpZ1 = lpA1 * lpZ1 + (1 - lpA1) * sRaw;
    let sFiltered;
    if (preset.filterType === 'bandpass') {
      sFiltered = (sRaw - lpZ1) * 1.15;
    } else {
      sFiltered = lpZ1;
    }

    let sFormants = 0;
    for (let fi = 0; fi < formantStates.length; fi++) {
      const fs = formantStates[fi];
      const outF = fs.b0 * sFiltered - fs.a1 * fs.z1 - fs.a2 * fs.z2;
      fs.z2 = fs.z1;
      fs.z1 = outF;
      sFormants += outF * fs.gain;
    }

    const final = (sFiltered + sFormants) * env(i);
    buffer[i] = Math.max(-1, Math.min(1, final));
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
