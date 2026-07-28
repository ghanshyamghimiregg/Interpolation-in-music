import {
  buildEvalGrid,
  lagrangeInterpolate,
  naturalCubicSpline,
  type InterpPoint,
} from './interpolation';

export type TestFunctionId = 'sin' | 'gaussian' | 'cubic';

export interface TestFunction {
  id: TestFunctionId;
  label: string;
  /** y = f(x) on domain [0, 4] — returns value in Hz-like range mapped to MIDI band */
  fn: (x: number) => number;
  description: string;
}

/** Map a normalized f(x) ∈ ~[-1,1] or [0,1] to a MIDI-ish Hz band (C4 area ± octave) */
function toHz(normalized: number, base = 440, span = 200): number {
  return base + normalized * span;
}

export const TEST_FUNCTIONS: TestFunction[] = [
  {
    id: 'sin',
    label: 'sin(2πx)',
    fn: (x) => toHz(Math.sin(2 * Math.PI * x)),
    description: 'Smooth periodic — all methods should track well at moderate N.',
  },
  {
    id: 'gaussian',
    label: 'Gaussian bump',
    fn: (x) => toHz(Math.exp(-((x - 2) ** 2) / 0.5)),
    description: 'Localized bump — tests edge behavior and Runge at high N.',
  },
  {
    id: 'cubic',
    label: 'x³ − 4x² + 3x',
    fn: (x) => toHz(((x ** 3 - 4 * x ** 2 + 3 * x) / 4) * 2 - 1),
    description: 'Polynomial ground truth — Lagrange with Chebyshev nodes is exact at degree ≤ N−1.',
  },
];

export function sampleTestFunction(fn: TestFunction, n: number, xMin = 0, xMax = 4): InterpPoint[] {
  if (n < 2) n = 2;
  const pts: InterpPoint[] = [];
  for (let i = 0; i < n; i++) {
    const x = xMin + (i / (n - 1)) * (xMax - xMin);
    pts.push({ x, y: fn.fn(x) });
  }
  return pts;
}

export interface MethodErrors {
  maxAbs: number;
  rms: number;
}

export function computeErrors(trueY: number[], approxY: number[]): MethodErrors {
  let sumSq = 0;
  let maxAbs = 0;
  for (let i = 0; i < trueY.length; i++) {
    const e = Math.abs(trueY[i] - approxY[i]);
    sumSq += e * e;
    if (e > maxAbs) maxAbs = e;
  }
  return { maxAbs, rms: Math.sqrt(sumSq / trueY.length) };
}

export interface ErrorAnalysisSnapshot {
  xEval: number[];
  trueCurve: number[];
  lagrange: number[];
  spline: number[];
  lagrangeErrors: MethodErrors;
  splineErrors: MethodErrors;
  samplePoints: InterpPoint[];
}

export function analyzeErrors(
  testFn: TestFunction,
  n: number,
  xMin = 0,
  xMax = 4,
  resolution = 400
): ErrorAnalysisSnapshot {
  const samplePoints = sampleTestFunction(testFn, n, xMin, xMax);
  const xEval = buildEvalGrid(xMin, xMax, resolution);
  const trueCurve = xEval.map((x) => testFn.fn(x));
  const lagrange = lagrangeInterpolate(samplePoints, xEval);
  const spline = naturalCubicSpline(samplePoints, xEval).yEval;

  return {
    xEval,
    trueCurve,
    lagrange,
    spline,
    lagrangeErrors: computeErrors(trueCurve, lagrange),
    splineErrors: computeErrors(trueCurve, spline),
    samplePoints,
  };
}

/** Error vs N for convergence chart */
export function errorVsN(
  testFn: TestFunction,
  nValues: number[],
  xMin = 0,
  xMax = 4
): { n: number; lagrangeRms: number; splineRms: number }[] {
  return nValues.map((n) => {
    const snap = analyzeErrors(testFn, n, xMin, xMax, 200);
    return {
      n,
      lagrangeRms: snap.lagrangeErrors.rms,
      splineRms: snap.splineErrors.rms,
    };
  });
}

export function getTestFunction(id: TestFunctionId): TestFunction {
  return TEST_FUNCTIONS.find((f) => f.id === id)!;
}
