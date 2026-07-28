'use client';

import { useMemo } from 'react';
import KatexBlock from './KatexBlock';
import { METHODS } from '@/lib/formulas';
import {
  buildEvalGrid,
  lagrangeInterpolate,
  linearInterpolate,
  naturalCubicSpline,
  toInterpPoints,
} from '@/lib/interpolation';

const REFERENCE_POINTS = [
  { x: 0, y: 1 },
  { x: 1, y: 2 },
  { x: 2, y: 0.5 },
  { x: 3, y: 2.5 },
  { x: 4, y: 1 },
];

function MiniPlot({ methodId }: { methodId: string }) {
  const path = useMemo(() => {
    const xs = buildEvalGrid(0, 4, 80);
    let ys: number[];
    switch (methodId) {
      case 'linear':
        ys = linearInterpolate(REFERENCE_POINTS, xs);
        break;
      case 'lagrange':
        ys = lagrangeInterpolate(REFERENCE_POINTS, xs);
        break;
      case 'newton-divided':
      case 'newton-forward':
        ys = lagrangeInterpolate(REFERENCE_POINTS, xs);
        break;
      default:
        ys = naturalCubicSpline(REFERENCE_POINTS, xs).yEval;
    }
    const yMin = Math.min(...REFERENCE_POINTS.map((p) => p.y), ...ys);
    const yMax = Math.max(...REFERENCE_POINTS.map((p) => p.y), ...ys);
    const w = 200;
    const h = 80;
    const pad = 8;
    const pts = xs.map((x, i) => {
      const px = pad + (x / 4) * (w - 2 * pad);
      const py = pad + (1 - (ys[i] - yMin) / (yMax - yMin || 1)) * (h - 2 * pad);
      return `${px},${py}`;
    });
    const nodes = REFERENCE_POINTS.map((p) => {
      const px = pad + (p.x / 4) * (w - 2 * pad);
      const py = pad + (1 - (p.y - yMin) / (yMax - yMin || 1)) * (h - 2 * pad);
      return { px, py };
    });
    return { d: `M${pts.join(' L')}`, nodes, w, h };
  }, [methodId]);

  return (
    <svg width={path.w} height={path.h} className="mini-plot" aria-hidden>
      <rect x={0} y={0} width={path.w} height={path.h} fill="#f3f0ea" stroke="#d4cfc4" />
      <path d={path.d} fill="none" stroke="#b8432a" strokeWidth={1.5} />
      {path.nodes.map((n, i) => (
        <circle key={i} cx={n.px} cy={n.py} r={3} fill="#1a1814" />
      ))}
    </svg>
  );
}

export default function ReferenceSection() {
  return (
    <section className="reference-section">
      <h2 className="section-heading">How each method works</h2>
      <div className="reference-grid">
        {METHODS.map((m) => (
          <article key={m.id} className="reference-card">
            <h3>{m.shortLabel}</h3>
            <MiniPlot methodId={m.id} />
            <KatexBlock tex={m.generalFormula} block={false} />
            <p>{m.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
