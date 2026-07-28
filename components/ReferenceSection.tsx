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

function SRDiagram() {
  const w = 360;
  const h = 110;
  const padL = 28;
  const padR = 28;
  const padT = 22;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const xMin = 0;
  const xMax = 10;
  const f = (x: number) => 0.45 * Math.sin(0.9 * x) + 0.35 * Math.cos(0.4 * x) + 0.5;
  const xsSrc = [0, 10 / 7, 20 / 7, 30 / 7, 40 / 7, 50 / 7, 60 / 7, 10];
  const xsDst = [0, 10 / 9, 20 / 9, 30 / 9, 40 / 9, 50 / 9, 60 / 9, 70 / 9, 80 / 9, 10];
  const pxX = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * innerW;
  const pxY = (y: number) => padT + (1 - y) * innerH;
  const curvePts: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const x = (i / 200) * (xMax - xMin) + xMin;
    curvePts.push(`${pxX(x).toFixed(1)},${pxY(f(x)).toFixed(1)}`);
  }
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="sr-diagram" aria-hidden>
      <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="#d4cfc4" strokeWidth={1} />
      <line x1={padL} y1={padT} x2={padL} y2={h - padB} stroke="#d4cfc4" strokeWidth={1} />
      <path d={`M${curvePts.join(' L')}`} fill="none" stroke="#b8432a" strokeWidth={1.2} strokeDasharray="3 2.5" opacity={0.65} />
      {xsSrc.map((x, i) => (
        <g key={`s${i}`}>
          <line x1={pxX(x)} y1={h - padB} x2={pxX(x)} y2={pxY(f(x))} stroke="#6b6560" strokeWidth={0.6} strokeDasharray="1.5 1.5" />
          <circle cx={pxX(x)} cy={pxY(f(x))} r={3} fill="#1a1814" />
        </g>
      ))}
      {xsDst.map((x, i) => (
        <g key={`d${i}`}>
          <line x1={pxX(x)} y1={pxY(f(x))} x2={pxX(x)} y2={h - padB + 10} stroke="#3d6b4f" strokeWidth={0.8} />
          <circle cx={pxX(x)} cy={pxY(f(x))} r={2.2} fill="#3d6b4f" />
        </g>
      ))}
      <text x={padL + 1} y={padT - 7} fontFamily="var(--font-mono)" fontSize={8} fill="#6b6560">
        44.1 kHz → interpolate → 48 kHz
      </text>
      <text x={padL - 2} y={h - 8} fontFamily="var(--font-mono)" fontSize={6.5} fill="#1a1814">
        t
      </text>
      <circle cx={padL - 14} cy={pxY(0.6)} r={2.5} fill="#1a1814" />
      <text x={padL - 24} y={pxY(0.82)} fontFamily="var(--font-mono)" fontSize={6} fill="#1a1814" textAnchor="middle">
        src
      </text>
      <circle cx={padL - 14} cy={pxY(0.22)} r={2} fill="#3d6b4f" />
      <text x={padL - 24} y={pxY(0.13)} fontFamily="var(--font-mono)" fontSize={6} fill="#3d6b4f" textAnchor="middle">
        dst
      </text>
    </svg>
  );
}

export default function ReferenceSection() {
  return (
    <>
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

      <section className="apps-section">
        <h2 className="section-heading">Applications &amp; Significance</h2>
        <p className="apps-lede">
          The interpolation math in this demo is not a classroom toy. It is the numerical backbone of
          real audio and music software — from CD-quality sample rates to AI music generation.
        </p>

        <div className="apps-grid">
          <article className="apps-card">
            <h3 className="apps-subheading">Where it&apos;s used</h3>
            <ul className="apps-list">
              <li>
                <span className="term">Sample-rate conversion.</span> Every time audio moves between
                44.1 kHz (CD), 48 kHz (video/streaming), or 96 kHz (studio), software reconstructs a
                continuous signal from discrete samples and re-samples it — usually sinc interpolation
                (per the Nyquist–Shannon sampling theorem), approximated in practice by windowed sinc,
                cubic, or linear forms depending on CPU budget.
              </li>
              <li>
                <span className="term">Synthesizer portamento / pitch glide.</span> When a synth glides
                from one note to another instead of jumping, it interpolates pitch over time — exactly
                what this grid shows. Analog synths used capacitor curves; modern digital synths use
                linear or exponential ramps.
              </li>
              <li>
                <span className="term">DAW automation curves.</span> Volume fades, filter sweeps, panning
                in Ableton, Logic, and FL Studio are rendered with spline, Bezier, or Hermite
                interpolation between drawn control points — because it must sound smooth, not
                mechanical.
              </li>
              <li>
                <span className="term">Rompler synthesizers.</span> Sample-based synths store one
                recording per few semitones to save memory; notes in between are produced by
                pitch-shifting / interpolating the nearest recorded samples.
              </li>
              <li>
                <span className="term">Time-stretching &amp; pitch-shifting</span> (tempo without pitch
                change, or vice versa) reconstructs audio at new time or frequency positions by
                interpolating between known sample points.
              </li>
              <li>
                <span className="term">Packet-loss concealment in streaming.</span> When a call or
                stream drops packets, the receiver interpolates across the millisecond-scale gap
                (typically linear or spline extrapolation) instead of inserting silence or a click.
              </li>
              <li>
                <span className="term">Latent-space morphing in generative music models</span> such as
                Google&apos;s MusicVAE interpolate between learned vector representations of entire
                musical phrases. The core idea — a continuous path between discrete known points — is
                identical to the Lagrange / Newton / spline math taught here, just in vastly higher
                dimension.
              </li>
            </ul>
          </article>

          <article className="apps-card">
            <h3 className="apps-subheading">Why it matters</h3>
            <ul className="apps-list">
              <li>
                <span className="term">The method is directly audible.</span> A cheap linear resampler
                introduces aliasing or zipper-noise in envelopes that a well-chosen spline or
                windowed-sinc interpolator avoids. Audio engineers choose interpolation methods the
                same way this app does — trading accuracy, smoothness, and computational cost.
              </li>
              <li>
                <span className="term">Computational cost is a hard constraint.</span> Linear
                interpolation is O(1) per sample; cubic spline requires solving a tridiagonal system
                up front; high-degree Lagrange is the most expensive and, as this app demonstrates,
                often the worst choice anyway (Runge&apos;s phenomenon). Real-time systems — games,
                live effects, streaming — must be numerically well-behaved <em>and</em> cheap enough to
                run thousands of times per second.
              </li>
              <li>
                <span className="term">A concrete, checkable instance of interpolation theory.</span>
                Everything in the numerical-methods course about error bounds, node spacing, and
                polynomial degree applies directly and audibly here. This app is not a metaphor for
                the math — it is a direct application of it, which is why the error-convergence and
                Chebyshev-node sections exist.
              </li>
            </ul>
            <div className="sr-diagram-wrap">
              <SRDiagram />
              <p className="sr-caption">
                Sample-rate conversion: 8 source samples (black) → reconstructed continuous curve
                (dashed red, interpolation) → 10 destination samples (green) at the new rate.
                Waveform-level applications are context for why the technique matters; this specific
                app interpolates <em>note-level pitch curves</em>, not raw audio.
              </p>
            </div>
          </article>

          <article className="apps-card">
            <h3 className="apps-subheading">What could be extended</h3>
            <ul className="apps-list">
              <li>
                <span className="term">Full waveform resampling.</span> A natural next step is applying
                these same interpolation methods to real audio samples — resample a short recorded
                clip using linear vs. cubic vs. sinc and let the user hear the artifact-quality
                difference, closer to how production software actually uses interpolation.
              </li>
              <li>
                <span className="term">Sinc / windowed-sinc comparison.</span> The theoretically
                correct method for band-limited signal reconstruction (Nyquist–Shannon) was out of
                scope for the note-based demo but is the real standard in professional audio
                resampling and worth a side-by-side comparison.
              </li>
              <li>
                <span className="term">Quantified computational cost.</span> Add an operations-count or
                per-method timing comparison alongside the accuracy metrics — because real systems
                balance both.
              </li>
              <li>
                <span className="term">Higher-dimensional interpolation.</span> Interpolating full
                timbral / spectral content rather than only pitch, as generative music models do, is
                the broader mathematical context this technique fits into — a natural bridge beyond a
                numerical-methods course.
              </li>
              <li>
                <span className="term">Formal error-bound analysis.</span> Connect the empirical
                error / convergence chart to the theoretical Lagrange remainder{' '}
                <KatexBlock
                  tex={String.raw`R_n(x) = \frac{f^{(n+1)}(\xi)}{(n+1)!} \prod_{i=0}^{n}(x - x_i)`}
                  block={false}
                />{' '}
                and compare the bound to measured error on a known test function.
              </li>
            </ul>
          </article>
        </div>
      </section>
    </>
  );
}
