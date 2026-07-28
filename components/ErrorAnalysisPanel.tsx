'use client';

import { useMemo, useState } from 'react';
import {
  TEST_FUNCTIONS,
  analyzeErrors,
  errorVsN,
  type TestFunctionId,
} from '@/lib/errorAnalysis';

export default function ErrorAnalysisPanel() {
  const [fnId, setFnId] = useState<TestFunctionId>('sin');
  const [n, setN] = useState(8);

  const testFn = TEST_FUNCTIONS.find((f) => f.id === fnId)!;

  const snapshot = useMemo(() => analyzeErrors(testFn, n), [testFn, n]);

  const convergence = useMemo(
    () => errorVsN(testFn, [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20]),
    [testFn]
  );

  const overlayPath = useMemo(() => {
    const { xEval, trueCurve, lagrange, spline } = snapshot;
    const allY = [...trueCurve, ...lagrange, ...spline];
    const yMin = Math.min(...allY);
    const yMax = Math.max(...allY);
    const pad = 16;
    const w = 560;
    const h = 180;
    const range = yMax - yMin || 1;
    const xMin = xEval[0];
    const xMax = xEval[xEval.length - 1];

    const toPath = (ys: number[], stroke: string) => {
      const d = ys
        .map((y, i) => {
          const px = pad + ((xEval[i] - xMin) / (xMax - xMin)) * (w - 2 * pad);
          const py = pad + (1 - (y - yMin) / range) * (h - 2 * pad);
          return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
        })
        .join(' ');
      return { d, stroke };
    };

    return {
      w,
      h,
      truePath: toPath(trueCurve, '#1a1814'),
      lagPath: toPath(lagrange, '#b8432a'),
      splPath: toPath(spline, '#3d6b4f'),
      nodes: snapshot.samplePoints.map((p) => {
        const px = pad + ((p.x - xMin) / (xMax - xMin)) * (w - 2 * pad);
        const py = pad + (1 - (p.y - yMin) / range) * (h - 2 * pad);
        return { px, py };
      }),
    };
  }, [snapshot]);

  const convChart = useMemo(() => {
    const pad = 20;
    const w = 560;
    const h = 140;
    const maxRms = Math.max(...convergence.map((c) => c.lagrangeRms), 1);
    const nMin = convergence[0].n;
    const nMax = convergence[convergence.length - 1].n;

    const toPts = (key: 'lagrangeRms' | 'splineRms') =>
      convergence
        .map((c, i) => {
          const px = pad + ((c.n - nMin) / (nMax - nMin)) * (w - 2 * pad);
          const py = pad + (1 - c[key] / maxRms) * (h - 2 * pad);
          return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
        })
        .join(' ');

    return { w, h, lagPath: toPts('lagrangeRms'), splPath: toPts('splineRms'), maxRms };
  }, [convergence]);

  return (
    <section className="error-section">
      <h2 className="section-heading">Error &amp; convergence analysis</h2>
      <p className="error-intro">
        Sample a known smooth function, interpolate with N equally spaced nodes, and quantify
        reconstruction error. Lagrange error typically grows at high N (Runge); spline error stays
        bounded.
      </p>

      <div className="error-controls">
        <label className="error-control">
          <span>True function</span>
          <select value={fnId} onChange={(e) => setFnId(e.target.value as TestFunctionId)}>
            {TEST_FUNCTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="error-control">
          <span>N nodes = {n}</span>
          <input
            type="range"
            min={4}
            max={20}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="error-fn-desc">{testFn.description}</p>

      <div className="error-chart-block">
        <p className="formula-label">True curve vs. reconstruction</p>
        <svg width={overlayPath.w} height={overlayPath.h} className="error-chart">
          <rect x={0} y={0} width={overlayPath.w} height={overlayPath.h} fill="#faf8f4" stroke="#d4cfc4" />
          <path d={overlayPath.truePath.d} fill="none" stroke={overlayPath.truePath.stroke} strokeWidth={2} strokeDasharray="4 3" />
          <path d={overlayPath.lagPath.d} fill="none" stroke={overlayPath.lagPath.stroke} strokeWidth={1.5} />
          <path d={overlayPath.splPath.d} fill="none" stroke={overlayPath.splPath.stroke} strokeWidth={1.5} />
          {overlayPath.nodes.map((nd, i) => (
            <circle key={i} cx={nd.px} cy={nd.py} r={3} fill="#1a1814" />
          ))}
        </svg>
        <div className="error-legend">
          <span><i className="leg true" /> True</span>
          <span><i className="leg lag" /> Lagrange</span>
          <span><i className="leg spl" /> Cubic spline</span>
        </div>
      </div>

      <table className="error-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Max |error| (Hz)</th>
            <th>RMS error (Hz)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lagrange</td>
            <td>{snapshot.lagrangeErrors.maxAbs.toFixed(2)}</td>
            <td>{snapshot.lagrangeErrors.rms.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Cubic spline</td>
            <td>{snapshot.splineErrors.maxAbs.toFixed(2)}</td>
            <td>{snapshot.splineErrors.rms.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div className="error-chart-block">
        <p className="formula-label">RMS error vs. N (Lagrange diverges, spline bounded)</p>
        <svg width={convChart.w} height={convChart.h} className="error-chart">
          <rect x={0} y={0} width={convChart.w} height={convChart.h} fill="#faf8f4" stroke="#d4cfc4" />
          <path d={convChart.lagPath} fill="none" stroke="#b8432a" strokeWidth={1.5} />
          <path d={convChart.splPath} fill="none" stroke="#3d6b4f" strokeWidth={1.5} />
        </svg>
        <div className="error-legend">
          <span><i className="leg lag" /> Lagrange RMS</span>
          <span><i className="leg spl" /> Spline RMS</span>
          <span className="conv-max">max RMS scale: {convChart.maxRms.toFixed(1)} Hz</span>
        </div>
      </div>
    </section>
  );
}
