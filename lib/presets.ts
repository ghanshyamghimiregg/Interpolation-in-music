import type { ControlPoint } from './interpolation';

export interface Preset {
  id: string;
  name: string;
  description: string;
  points: ControlPoint[];
}

/** C4=60, D4=62, … frequencies from prior melomath presets, stored as MIDI */
export const PRESETS: Preset[] = [
  {
    id: 'scale',
    name: 'C major scale (even spacing)',
    description: 'Equally spaced ascending scale — Newton forward vs. spline.',
    points: [
      { t: 0, midi: 60 },
      { t: 2 / 7, midi: 62 },
      { t: 4 / 7, midi: 64 },
      { t: 6 / 7, midi: 65 },
      { t: 8 / 7, midi: 67 },
      { t: 10 / 7, midi: 69 },
      { t: 12 / 7, midi: 71 },
      { t: 2, midi: 72 },
    ],
  },
  {
    id: 'uneven',
    name: 'Uneven spacing',
    description: 'Irregular time gaps — divided difference vs. linear.',
    points: [
      { t: 0, midi: 60 },
      { t: 0.8, midi: 64 },
      { t: 1.6, midi: 67 },
      { t: 2.4, midi: 72 },
      { t: 3.2, midi: 76 },
      { t: 4, midi: 79 },
    ],
  },
  {
    id: 'runge',
    name: "Runge's phenomenon",
    description: '8 oscillating points — Lagrange overshoot vs. cubic spline.',
    points: [
      { t: 0, midi: 72 },
      { t: 0.5, midi: 60 },
      { t: 1.0, midi: 76 },
      { t: 1.5, midi: 58 },
      { t: 2.0, midi: 79 },
      { t: 2.5, midi: 55 },
      { t: 3.0, midi: 81 },
      { t: 3.5, midi: 57 },
    ],
  },
];
