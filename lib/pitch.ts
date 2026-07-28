/** Pitch ↔ frequency helpers (A4 = 440 Hz, MIDI 69). */

export const A4_MIDI = 69;
export const A4_HZ = 440;

export function midiToHz(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

export function hzToMidi(hz: number): number {
  return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  return `${name}${octave}`;
}

export function snapMidi(midi: number): number {
  return Math.round(midi);
}

/** Grid range for the demo */
export const TIME_MIN = 0;
export const TIME_MAX = 4;
export const MIDI_MIN = 48; // C3
export const MIDI_MAX = 84; // C6

export function clampTime(t: number): number {
  return Math.max(TIME_MIN, Math.min(TIME_MAX, t));
}

export function clampMidi(m: number): number {
  return Math.max(MIDI_MIN, Math.min(MIDI_MAX, snapMidi(m)));
}
