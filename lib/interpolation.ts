import { midiToHz } from './pitch';

export interface ControlPoint {
  t: number;
  midi: number;
}

export interface InterpPoint {
  x: number;
  y: number;
}

export type InterpolationMethod =
  | 'linear'
  | 'lagrange'
  | 'newton-divided'
  | 'newton-forward'
  | 'cubic-spline';

export function toInterpPoints(points: ControlPoint[]): InterpPoint[] {
  return [...points]
    .sort((a, b) => a.t - b.t)
    .map((p) => ({ x: p.t, y: midiToHz(p.midi) }));
}

export function sortInterpPoints(points: InterpPoint[]): InterpPoint[] {
  return [...points].sort((a, b) => a.x - b.x);
}

export function buildEvalGrid(xMin: number, xMax: number, resolution = 400): number[] {
  if (xMax <= xMin) return [xMin];
  const xs: number[] = [];
  for (let i = 0; i < resolution; i++) {
    xs.push(xMin + (i / (resolution - 1)) * (xMax - xMin));
  }
  return xs;
}

/** Piecewise linear interpolation */
export function linearInterpolate(points: InterpPoint[], xEval: number[]): number[] {
  const sorted = sortInterpPoints(points);
  const x = sorted.map((p) => p.x);
  const y = sorted.map((p) => p.y);

  return xEval.map((xVal) => {
    if (xVal <= x[0]) return y[0];
    if (xVal >= x[x.length - 1]) return y[y.length - 1];
    let i = 0;
    while (i < x.length - 1 && xVal > x[i + 1]) i++;
    const t = (xVal - x[i]) / (x[i + 1] - x[i]);
    return y[i] * (1 - t) + y[i + 1] * t;
  });
}

/** Lagrange interpolation — single polynomial through all points */
export function lagrangeInterpolate(points: InterpPoint[], xEval: number[]): number[] {
  const sorted = sortInterpPoints(points);
  const x = sorted.map((p) => p.x);
  const y = sorted.map((p) => p.y);
  const n = sorted.length;

  return xEval.map((xVal) => {
    let result = 0;
    for (let i = 0; i < n; i++) {
      let term = y[i];
      for (let j = 0; j < n; j++) {
        if (i !== j) term *= (xVal - x[j]) / (x[i] - x[j]);
      }
      result += term;
    }
    return result;
  });
}

export interface DividedDifferenceResult {
  yEval: number[];
  ddTable: (number | null)[][];
  coefficients: number[];
  x: number[];
}

/** Newton's divided-difference form */
export function newtonDividedDifference(
  points: InterpPoint[],
  xEval: number[]
): DividedDifferenceResult {
  const sorted = sortInterpPoints(points);
  const x = sorted.map((p) => p.x);
  const y = sorted.map((p) => p.y);
  const n = sorted.length;

  const ddTable: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) ddTable[i][0] = y[i];

  for (let j = 1; j < n; j++) {
    for (let i = 0; i < n - j; i++) {
      ddTable[i][j] = (ddTable[i + 1][j - 1]! - ddTable[i][j - 1]!) / (x[i + j] - x[i]);
    }
  }

  const coefficients = ddTable[0].map((c) => c ?? 0);

  const yEval = xEval.map((xVal) => {
    let result = ddTable[0][0]!;
    let product = 1;
    for (let i = 1; i < n; i++) {
      product *= xVal - x[i - 1];
      result += ddTable[0][i]! * product;
    }
    return result;
  });

  return { yEval, ddTable, coefficients, x };
}

export interface ForwardDiffResult {
  yEval: number[];
  diffTable: number[][];
  h: number;
  x0: number;
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function fallingFactorial(p: number, k: number): number {
  let result = 1;
  for (let i = 0; i < k; i++) result *= p - i;
  return result;
}

function risingFactorial(p: number, k: number): number {
  let result = 1;
  for (let i = 0; i < k; i++) result *= p + i;
  return result;
}

/** Build forward difference table (columns = Δ⁰, Δ¹, …) */
function buildForwardDiffTable(y: number[]): number[][] {
  const n = y.length;
  const table: number[][] = [y.slice()];
  for (let order = 1; order < n; order++) {
    const prev = table[order - 1];
    const col: number[] = [];
    for (let i = 0; i < n - order; i++) {
      col.push(prev[i + 1] - prev[i]);
    }
    table.push(col);
  }
  return table;
}

/** Build backward difference table */
function buildBackwardDiffTable(y: number[]): number[][] {
  const n = y.length;
  const table: number[][] = [y.slice()];
  for (let order = 1; order < n; order++) {
    const prev = table[order - 1];
    const col: number[] = [];
    for (let i = 0; i < n - order; i++) {
      col.push(prev[i] - prev[i + 1]);
    }
    table.push(col);
  }
  return table;
}

export function isEvenlySpaced(
  points: InterpPoint[],
  tolerance = 1e-6
): { even: boolean; h?: number; x0?: number } {
  const sorted = sortInterpPoints(points);
  if (sorted.length < 2) return { even: false };
  const h = sorted[1].x - sorted[0].x;
  if (h <= 0) return { even: false };
  for (let i = 2; i < sorted.length; i++) {
    const hi = sorted[i].x - sorted[i - 1].x;
    if (Math.abs(hi - h) > tolerance) return { even: false };
  }
  return { even: true, h, x0: sorted[0].x };
}

/** Newton forward difference — equal spacing only */
export function newtonForwardDifference(
  points: InterpPoint[],
  xEval: number[]
): ForwardDiffResult | null {
  const spacing = isEvenlySpaced(points);
  if (!spacing.even || spacing.h === undefined || spacing.x0 === undefined) return null;

  const sorted = sortInterpPoints(points);
  const y = sorted.map((p) => p.y);
  const { h, x0 } = spacing;
  const diffTable = buildForwardDiffTable(y);
  const n = y.length;

  const yEval = xEval.map((xVal) => {
    const p = (xVal - x0) / h;
    let result = diffTable[0][0];
    for (let k = 1; k < n; k++) {
      result += (fallingFactorial(p, k) / factorial(k)) * diffTable[k][0];
    }
    return result;
  });

  return { yEval, diffTable, h, x0 };
}

export interface BackwardDiffResult {
  yEval: number[];
  diffTable: number[][];
  h: number;
  xn: number;
}

/** Newton backward difference — equal spacing only */
export function newtonBackwardDifference(
  points: InterpPoint[],
  xEval: number[]
): BackwardDiffResult | null {
  const spacing = isEvenlySpaced(points);
  if (!spacing.even || spacing.h === undefined) return null;

  const sorted = sortInterpPoints(points);
  const y = sorted.map((p) => p.y);
  const h = spacing.h;
  const xn = sorted[sorted.length - 1].x;
  const diffTable = buildBackwardDiffTable(y);
  const n = y.length;

  const yEval = xEval.map((xVal) => {
    const p = (xVal - xn) / h;
    let result = diffTable[0][n - 1];
    for (let k = 1; k < n; k++) {
      result += (risingFactorial(p, k) / factorial(k)) * diffTable[k][n - 1 - k];
    }
    return result;
  });

  return { yEval, diffTable, h, xn };
}

export interface SplineSegment {
  xStart: number;
  xEnd: number;
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface SplineResult {
  yEval: number[];
  segments: SplineSegment[];
}

/** Natural cubic spline — ported from melomath/frontend/src/utils/interpolation.js */
export function naturalCubicSpline(points: InterpPoint[], xEval: number[]): SplineResult {
  const sorted = sortInterpPoints(points);
  const x = sorted.map((p) => p.x);
  const y = sorted.map((p) => p.y);
  const n = sorted.length;

  if (n === 2) {
    const yEval = linearInterpolate(sorted, xEval);
    return {
      yEval,
      segments: [
        {
          xStart: x[0],
          xEnd: x[1],
          a: y[0],
          b: (y[1] - y[0]) / (x[1] - x[0]),
          c: 0,
          d: 0,
        },
      ],
    };
  }

  const h: number[] = [];
  for (let i = 0; i < n - 1; i++) h[i] = x[i + 1] - x[i];

  const alpha = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (y[i + 1] - y[i]) - (3 / h[i - 1]) * (y[i] - y[i - 1]);
  }

  const l = new Array(n).fill(1);
  const mu = new Array(n).fill(0);
  const z = new Array(n).fill(0);

  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  const b = new Array(n - 1).fill(0);
  const c = new Array(n).fill(0);
  const d = new Array(n - 1).fill(0);

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (y[j + 1] - y[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  const segments: SplineSegment[] = [];
  for (let i = 0; i < n - 1; i++) {
    segments.push({
      xStart: x[i],
      xEnd: x[i + 1],
      a: y[i],
      b: b[i],
      c: c[i],
      d: d[i],
    });
  }

  const yEval = xEval.map((xVal) => {
    let i = 0;
    while (i < n - 1 && xVal > x[i + 1]) i++;
    if (i === n - 1) i = n - 2;
    const dx = xVal - x[i];
    return y[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  });

  return { yEval, segments };
}

/** Detect Runge-style overshoot beyond control-point y range */
export function detectRungeOvershoot(
  points: InterpPoint[],
  yEval: number[]
): { overshoots: boolean; yMin: number; yMax: number; curveMin: number; curveMax: number } {
  const ys = points.map((p) => p.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const margin = (yMax - yMin) * 0.05 + 10;
  const curveMin = Math.min(...yEval);
  const curveMax = Math.max(...yEval);
  const overshoots = curveMin < yMin - margin || curveMax > yMax + margin;
  return { overshoots, yMin, yMax, curveMin, curveMax };
}

export function interpolate(
  method: InterpolationMethod,
  points: ControlPoint[],
  xEval: number[]
): {
  yEval: number[];
  meta?: Record<string, unknown>;
} {
  const interp = toInterpPoints(points);
  switch (method) {
    case 'linear':
      return { yEval: linearInterpolate(interp, xEval) };
    case 'lagrange':
      return { yEval: lagrangeInterpolate(interp, xEval) };
    case 'newton-divided': {
      const r = newtonDividedDifference(interp, xEval);
      return { yEval: r.yEval, meta: { divided: r } };
    }
    case 'newton-forward': {
      const r = newtonForwardDifference(interp, xEval);
      if (!r) {
        const div = newtonDividedDifference(interp, xEval);
        return { yEval: div.yEval, meta: { fallback: 'divided', divided: div } };
      }
      return { yEval: r.yEval, meta: { forward: r } };
    }
    case 'cubic-spline': {
      const r = naturalCubicSpline(interp, xEval);
      return { yEval: r.yEval, meta: { spline: r } };
    }
  }
}

/** Self-checks — run once on module load in dev */
export function runInterpolationSelfChecks(): void {
  const pts: InterpPoint[] = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 4 },
  ];
  const xEval = [0, 0.5, 1, 1.5, 2];
  const lag = lagrangeInterpolate(pts, xEval);
  console.assert(Math.abs(lag[2] - 1) < 1e-10, 'Lagrange at x=1');
  console.assert(Math.abs(lag[4] - 4) < 1e-10, 'Lagrange at x=2');

  const lin = linearInterpolate(pts, [1]);
  console.assert(Math.abs(lin[0] - 1) < 1e-10, 'Linear at knot');

  const eqPts: InterpPoint[] = [
    { x: 0, y: 1 },
    { x: 1, y: 4 },
    { x: 2, y: 9 },
  ];
  const fwd = newtonForwardDifference(eqPts, [0, 1, 2]);
  console.assert(fwd !== null, 'Forward diff spacing');
  if (fwd) {
    console.assert(Math.abs(fwd.yEval[0] - 1) < 1e-6, 'Forward at x0');
    console.assert(Math.abs(fwd.yEval[2] - 9) < 1e-4, 'Forward at x2');
  }

  const spl = naturalCubicSpline(pts, [1]);
  console.assert(Math.abs(spl.yEval[0] - 1) < 1e-6, 'Spline through point');
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  runInterpolationSelfChecks();
}
