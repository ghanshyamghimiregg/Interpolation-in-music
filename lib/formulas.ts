import type { InterpolationMethod } from './interpolation';
import { midiToHz, midiToNoteName } from './pitch';
import type { ControlPoint } from './interpolation';
import {
  isEvenlySpaced,
  toInterpPoints,
  type DividedDifferenceResult,
  type ForwardDiffResult,
  type SplineResult,
} from './interpolation';

export interface MethodInfo {
  id: InterpolationMethod;
  label: string;
  shortLabel: string;
  generalFormula: string;
  explanation: string;
  weakness: string;
}

export const METHODS: MethodInfo[] = [
  {
    id: 'linear',
    label: 'Linear (piecewise)',
    shortLabel: 'Linear',
    generalFormula: String.raw`y(x) = y_i + \frac{y_{i+1}-y_i}{x_{i+1}-x_i}(x - x_i), \quad x \in [x_i, x_{i+1}]`,
    explanation:
      'Connects consecutive points with straight segments. Simple and stable, but the first derivative jumps at each knot — audibly “robotic” glides.',
    weakness: 'Not smooth (C⁰ only); no overshoot, but harsh transitions.',
  },
  {
    id: 'lagrange',
    label: 'Lagrange',
    shortLabel: 'Lagrange',
    generalFormula: String.raw`L(x) = \sum_{i=0}^{n} y_i \prod_{\substack{j=0\\ j \neq i}}^{n} \frac{x - x_j}{x_i - x_j}`,
    explanation:
      'Single polynomial passing exactly through every point. Elegant for small n, but high-degree polynomials oscillate between nodes (Runge’s phenomenon).',
    weakness: 'Wild overshoot with many or unevenly spaced points.',
  },
  {
    id: 'newton-divided',
    label: "Newton divided difference",
    shortLabel: 'Newton DD',
    generalFormula: String.raw`P(x) = f[x_0] + f[x_0,x_1](x-x_0) + f[x_0,x_1,x_2](x-x_0)(x-x_1) + \cdots`,
    explanation:
      'Algebraically equivalent to Lagrange but built from a divided-difference table — efficient when adding points and works for arbitrary spacing.',
    weakness: 'Same polynomial as Lagrange; same Runge issues at high degree.',
  },
  {
    id: 'newton-forward',
    label: 'Newton forward / backward',
    shortLabel: 'Newton FD',
    generalFormula: String.raw`P(x) = y_0 + p\,\Delta y_0 + \frac{p(p-1)}{2!}\,\Delta^2 y_0 + \cdots, \quad p = \frac{x-x_0}{h}`,
    explanation:
      'Specialized form for equally spaced data using forward or backward difference tables. Enabled automatically when your points are evenly spaced in time.',
    weakness: 'Only valid for equal spacing; otherwise use divided differences.',
  },
  {
    id: 'cubic-spline',
    label: 'Natural cubic spline',
    shortLabel: 'Spline',
    generalFormula: String.raw`S_i(x) = a_i + b_i(x-x_i) + c_i(x-x_i)^2 + d_i(x-x_i)^3, \quad M_i = S_i''(x_i)`,
    explanation:
      'Piecewise cubics with continuous second derivative (C²). Solves a tridiagonal system for natural end conditions M₀ = Mₙ = 0.',
    weakness: 'Not global; curve is tied to local intervals — no single closed form over all x.',
  },
];

function fmtNum(n: number, digits = 3): string {
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.01 && n !== 0)) return n.toExponential(2);
  return n.toFixed(digits);
}

export function buildSubstitutedFormula(
  method: InterpolationMethod,
  points: ControlPoint[],
  meta?: Record<string, unknown>
): string {
  if (points.length < 2) return String.raw`\text{Place at least 2 points.}`;

  const interp = toInterpPoints(points);
  const sorted = [...points].sort((a, b) => a.t - b.t);

  switch (method) {
    case 'linear': {
      const p0 = sorted[0];
      const p1 = sorted[1];
      const y0 = midiToHz(p0.midi);
      const y1 = midiToHz(p1.midi);
      const slope = (y1 - y0) / (p1.t - p0.t);
      return String.raw`\text{Segment } [${fmtNum(p0.t)}, ${fmtNum(p1.t)}]: \quad y = ${fmtNum(y0)} + ${fmtNum(slope)}(x - ${fmtNum(p0.t)})`;
    }
    case 'lagrange': {
      const terms = sorted.slice(0, Math.min(4, sorted.length)).map((pi, i) => {
        const yi = midiToHz(pi.midi);
        const denomParts = sorted
          .filter((_, j) => j !== i)
          .map((pj) => String.raw`\frac{x - ${fmtNum(pj.t)}}{${fmtNum(pi.t - pj.t)}}`)
          .join('');
        return String.raw`${fmtNum(yi)} \cdot ${denomParts || '1'}`;
      });
      const more = sorted.length > 4 ? String.raw` + \cdots` : '';
      return String.raw`L(x) = ${terms.join(' + ')}${more}`;
    }
    case 'newton-divided': {
      const div = meta?.divided as DividedDifferenceResult | undefined;
      if (!div) return String.raw`P(x) = f[x_0] + \cdots`;
      let poly = String.raw`${fmtNum(div.coefficients[0])}`;
      let product = '';
      for (let i = 1; i < Math.min(div.coefficients.length, 5); i++) {
        product += `(x - ${fmtNum(div.x[i - 1])})`;
        poly += String.raw` + ${fmtNum(div.coefficients[i])}${product}`;
      }
      if (div.coefficients.length > 5) poly += String.raw` + \cdots`;
      return String.raw`P(x) = ${poly}`;
    }
    case 'newton-forward': {
      const spacing = isEvenlySpaced(interp);
      const fwd = meta?.forward as ForwardDiffResult | undefined;
      const div = meta?.divided as DividedDifferenceResult | undefined;
      if (!spacing.even && div) {
        let poly = String.raw`${fmtNum(div.coefficients[0])}`;
        let product = '';
        for (let i = 1; i < Math.min(div.coefficients.length, 4); i++) {
          product += `(x - ${fmtNum(div.x[i - 1])})`;
          poly += String.raw` + ${fmtNum(div.coefficients[i])}${product}`;
        }
        return String.raw`\text{(Divided diff)} \quad P(x) = ${poly}`;
      }
      if (!spacing.even) {
        return String.raw`\text{Points not equally spaced } (h \text{ varies}).`;
      }
      if (!fwd) return String.raw`p = \frac{x - ${fmtNum(spacing.x0!)}}{${fmtNum(spacing.h!)}}`;
      const y0 = fwd.diffTable[0][0];
      let poly = String.raw`${fmtNum(y0)}`;
      for (let k = 1; k < Math.min(fwd.diffTable.length, 4); k++) {
        const coeff = fwd.diffTable[k][0];
        poly += String.raw` + \frac{p(p-1)\cdots(p-${k - 1})}{${k}!} \cdot ${fmtNum(coeff)}`;
      }
      return String.raw`P(x) = ${poly}, \quad p = \frac{x - ${fmtNum(fwd.x0)}}{${fmtNum(fwd.h)}}`;
    }
    case 'cubic-spline': {
      const spl = meta?.spline as SplineResult | undefined;
      if (!spl || spl.segments.length === 0) return String.raw`S_i(x) = \cdots`;
      const s = spl.segments[0];
      return String.raw`S_0(x) = ${fmtNum(s.a)} + ${fmtNum(s.b)}(x-${fmtNum(s.xStart)}) + ${fmtNum(s.c)}(x-${fmtNum(s.xStart)})^2 + ${fmtNum(s.d)}(x-${fmtNum(s.xStart)})^3`;
    }
  }
}

export function pointSummary(points: ControlPoint[]): string {
  return points
    .sort((a, b) => a.t - b.t)
    .map((p) => String.raw`(${fmtNum(p.t)},\; ${midiToNoteName(p.midi)})`)
    .join(',\\; ');
}

export function isNewtonForwardAvailable(points: ControlPoint[]): boolean {
  if (points.length < 2) return false;
  return isEvenlySpaced(toInterpPoints(points)).even;
}
