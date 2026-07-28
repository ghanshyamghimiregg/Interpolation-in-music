import { linearInterpolate, lagrangeInterpolate, type InterpPoint } from './interpolation';
import type { ControlPoint } from './interpolation';
import { midiToHz } from './pitch';

/** Chebyshev nodes on [a, b]: x_k = (a+b)/2 + (b-a)/2 · cos((2k+1)π/(2N+2)) */
export function chebyshevNodes(a: number, b: number, n: number): number[] {
  if (n < 1) return [];
  if (n === 1) return [(a + b) / 2];
  const nodes: number[] = [];
  for (let k = 0; k < n; k++) {
    const theta = ((2 * k + 1) * Math.PI) / (2 * n + 2);
    nodes.push((a + b) / 2 + ((b - a) / 2) * Math.cos(theta));
  }
  return nodes.sort((x, y) => x - y);
}

/** Equally spaced nodes on [a, b] */
export function equallySpacedNodes(a: number, b: number, n: number): number[] {
  if (n < 1) return [];
  if (n === 1) return [(a + b) / 2];
  const nodes: number[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push(a + (i / (n - 1)) * (b - a));
  }
  return nodes;
}

/** Sample pitch (Hz) from control points via piecewise linear interpolation in time */
export function samplePitchCurve(points: ControlPoint[], t: number): number {
  const interp: InterpPoint[] = [...points]
    .sort((a, b) => a.t - b.t)
    .map((p) => ({ x: p.t, y: midiToHz(p.midi) }));
  if (interp.length === 0) return midiToHz(60);
  if (interp.length === 1) return interp[0].y;
  return linearInterpolate(interp, [t])[0];
}

export interface NodeSet {
  label: string;
  points: InterpPoint[];
}

/** Build equal vs Chebyshev node sets from the same underlying pitch profile */
export function buildRungeNodeSets(
  sourcePoints: ControlPoint[],
  a: number,
  b: number
): { equal: NodeSet; chebyshev: NodeSet } {
  const sorted = [...sourcePoints].sort((a, b) => a.t - b.t);
  const n = sorted.length;
  const eqTimes = equallySpacedNodes(a, b, n);
  const chebTimes = chebyshevNodes(a, b, n);

  const equal: InterpPoint[] = eqTimes.map((x) => ({
    x,
    y: samplePitchCurve(sorted, x),
  }));

  const chebyshev: InterpPoint[] = chebTimes.map((x) => ({
    x,
    y: samplePitchCurve(sorted, x),
  }));

  return {
    equal: { label: 'Equally spaced', points: equal },
    chebyshev: { label: 'Chebyshev nodes', points: chebyshev },
  };
}

export interface RungeComparisonResult {
  xEval: number[];
  equalCurve: number[];
  chebCurve: number[];
  equalNodes: InterpPoint[];
  chebNodes: InterpPoint[];
  equalOvershoot: boolean;
  chebOvershoot: boolean;
}

export function computeRungeComparison(
  sourcePoints: ControlPoint[],
  a: number,
  b: number,
  resolution = 300
): RungeComparisonResult | null {
  if (sourcePoints.length < 3) return null;
  const { equal, chebyshev } = buildRungeNodeSets(sourcePoints, a, b);
  const xEval: number[] = [];
  for (let i = 0; i < resolution; i++) {
    xEval.push(a + (i / (resolution - 1)) * (b - a));
  }
  const equalCurve = lagrangeInterpolate(equal.points, xEval);
  const chebCurve = lagrangeInterpolate(chebyshev.points, xEval);

  const yRange = (pts: InterpPoint[]) => {
    const ys = pts.map((p) => p.y);
    return { min: Math.min(...ys), max: Math.max(...ys) };
  };
  const margin = (range: { min: number; max: number }) => (range.max - range.min) * 0.05 + 10;

  const eqR = yRange(equal.points);
  const chR = yRange(chebyshev.points);

  return {
    xEval,
    equalCurve,
    chebCurve,
    equalNodes: equal.points,
    chebNodes: chebyshev.points,
    equalOvershoot:
      Math.min(...equalCurve) < eqR.min - margin(eqR) ||
      Math.max(...equalCurve) > eqR.max + margin(eqR),
    chebOvershoot:
      Math.min(...chebCurve) < chR.min - margin(chR) ||
      Math.max(...chebCurve) > chR.max + margin(chR),
  };
}
