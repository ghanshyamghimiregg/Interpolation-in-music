'use client';

import { useMemo } from 'react';
import { computeRungeComparison } from '@/lib/chebyshev';
import type { ControlPoint } from '@/lib/interpolation';
import { TIME_MIN, TIME_MAX } from '@/lib/pitch';

interface ChebyshevComparisonProps {
  points: ControlPoint[];
}

function MiniLagrangePlot({
  title,
  xEval,
  curve,
  nodes,
  overshoots,
}: {
  title: string;
  xEval: number[];
  curve: number[];
  nodes: { x: number; y: number }[];
  overshoots: boolean;
}) {
  const path = useMemo(() => {
    const allY = [...curve, ...nodes.map((n) => n.y)];
    const yMin = Math.min(...allY);
    const yMax = Math.max(...allY);
    const pad = 12;
    const w = 340;
    const h = 120;
    const range = yMax - yMin || 1;

    const toPx = (x: number, y: number) => ({
      px: pad + ((x - TIME_MIN) / (TIME_MAX - TIME_MIN)) * (w - 2 * pad),
      py: pad + (1 - (y - yMin) / range) * (h - 2 * pad),
    });

    const curvePath = xEval
      .map((x, i) => {
        const { px, py } = toPx(x, curve[i]);
        return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');

    return { w, h, curvePath, nodes: nodes.map((n) => toPx(n.x, n.y)) };
  }, [xEval, curve, nodes]);

  return (
    <div className="cheb-plot-block">
      <div className="cheb-plot-header">
        <span className="cheb-plot-title">{title}</span>
        {overshoots && <span className="cheb-overshoot-badge">Runge oscillation</span>}
      </div>
      <svg width={path.w} height={path.h} className="cheb-plot" aria-hidden>
        <rect x={0} y={0} width={path.w} height={path.h} fill="#faf8f4" stroke="#d4cfc4" />
        <path d={path.curvePath} fill="none" stroke="#b8432a" strokeWidth={1.5} />
        {path.nodes.map((n, i) => (
          <circle key={i} cx={n.px} cy={n.py} r={4} fill="#1a1814" />
        ))}
      </svg>
    </div>
  );
}

export default function ChebyshevComparison({ points }: ChebyshevComparisonProps) {
  const result = useMemo(
    () => computeRungeComparison(points, TIME_MIN, TIME_MAX),
    [points]
  );

  if (!result) {
    return (
      <div className="cheb-section">
        <h3 className="cheb-heading">Node spacing comparison</h3>
        <p className="cheb-placeholder">Add at least 3 points to compare equally spaced vs. Chebyshev nodes.</p>
      </div>
    );
  }

  return (
    <div className="cheb-section">
      <h3 className="cheb-heading">Lagrange: equally spaced vs. Chebyshev nodes</h3>
      <p className="cheb-explanation">
        Equally spaced high-degree polynomial interpolation is numerically unstable at the interval
        edges (Runge&apos;s phenomenon). Clustering nodes near the boundaries (Chebyshev nodes)
        minimizes the interpolation error bound.
      </p>
      <div className="cheb-plots">
        <MiniLagrangePlot
          title="Equally spaced nodes"
          xEval={result.xEval}
          curve={result.equalCurve}
          nodes={result.equalNodes}
          overshoots={result.equalOvershoot}
        />
        <MiniLagrangePlot
          title="Chebyshev nodes"
          xEval={result.xEval}
          curve={result.chebCurve}
          nodes={result.chebNodes}
          overshoots={result.chebOvershoot}
        />
      </div>
    </div>
  );
}
