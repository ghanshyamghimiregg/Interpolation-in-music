'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PitchGrid from './PitchGrid';
import MathPanel from './MathPanel';
import TransportControls, { playCompare } from './TransportControls';
import ReferenceSection from './ReferenceSection';
import ChebyshevComparison from './ChebyshevComparison';
import ErrorAnalysisPanel from './ErrorAnalysisPanel';
import PresentModeToggle from './PresentModeToggle';
import OnboardingTour, {
  hasSeenTour,
  markTourSeen,
  resetTourSeen,
  type TourStep,
} from './OnboardingTour';
import { PRESETS } from '@/lib/presets';
import { METHODS } from '@/lib/formulas';
import { playGlide, playStaccato, stopAll } from '@/lib/audio';
import {
  buildEvalGrid,
  detectRungeOvershoot,
  interpolate,
  toInterpPoints,
  type ControlPoint,
  type InterpolationMethod,
} from '@/lib/interpolation';

type AppView = 'interactive' | 'error';

export default function DemoApp() {
  const [points, setPoints] = useState<ControlPoint[]>(PRESETS[2].points);
  const [method, setMethod] = useState<InterpolationMethod>('cubic-spline');
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<AppView>('interactive');
  const [presentMode, setPresentMode] = useState(false);
  const [compareLabel, setCompareLabel] = useState<string | null>(null);
  const [tourActive, setTourActive] = useState(false);

  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        target: '[data-tour="view-tabs"]',
        title: 'Two ways to explore',
        placement: 'bottom',
        body:
          '<p>Start in <span class="mono">Interactive demo</span> — the main pitch-grid playground with formulas and audio.</p><p>Switch to <span class="mono">Error analysis</span> to compare convergence across methods and see Chebyshev vs. uniform node spacing in action.</p>',
      },
      {
        target: '[data-tour="presets"]',
        title: 'Start with a preset',
        placement: 'bottom',
        body:
          '<p>These buttons load pre-built musical shapes. Try <span class="mono">Rising</span> for a simple baseline, <span class="mono">Oscillate</span> for something more jagged, or <span class="mono">Runge</span> to see the classic overshoot problem for yourself.</p><p>You can always build your own afterward.</p>',
      },
      {
        target: '[data-tour="method-tabs"]',
        title: 'Pick your interpolation method',
        placement: 'bottom',
        body:
          '<p>Five different algorithms, all building a curve through the same notes:</p><p><span class="mono">Linear</span> is simple but jagged. <span class="mono">Lagrange</span> is a single smooth polynomial (but watch for Runge oscillation). <span class="mono">Newton DD</span> / <span class="mono">Newton FD</span> show how the same polynomial is built from a difference table. <span class="mono">Spline</span> gives the most natural musical glides.</p>',
      },
      {
        target: '[data-tour="pitch-grid"]',
        title: 'The pitch grid — your canvas',
        placement: 'top',
        body:
          '<p>This is where the music lives. Rows are musical notes. Columns are time.</p><p><strong>Click empty space</strong> to add a new note. <strong>Drag a dot</strong> to reshapen the curve. <strong>Right-click a dot</strong> to remove it. Press <span class="mono">Space</span> anywhere to hear the glide.</p><p>Try adding 4–6 points and switching methods to see the curve change in real time.</p>',
      },
      {
        target: '[data-tour="transport"]',
        title: 'Playback — hear the difference',
        placement: 'top',
        body:
          '<p><span class="mono">Play glide</span> renders the full interpolated curve as audio — the core demo. <span class="mono">Notes only</span> plays just the discrete points so you can contrast "steppy" vs. smooth.</p><p><span class="mono">Compare A/B</span> sequentially plays Linear → Spline → Lagrange on the same points — the fastest way to hear why method choice matters.</p><p><span class="mono">Export .wav</span> saves the glide for a presentation or DAW.</p>',
      },
      {
        target: '[data-tour="formula-panel"]',
        title: 'Live formulas for your points',
        placement: 'left',
        body:
          '<p>Every time you move a point or switch methods, this panel rebuilds the actual interpolation formula with your numbers substituted in.</p><p>Top: the general mathematical form. Below it: the formula computed for the points currently on the grid. Scroll right if a line runs long.</p><p>For Newton variants you also get a color-coded divided-difference table.</p>',
      },
      {
        target: '[data-tour="chebyshev"]',
        title: 'Chebyshev nodes (fix Runge)',
        placement: 'top',
        body:
          '<p>Lagrange on evenly-spaced points often blows up at the edges — <em>Runge&apos;s phenomenon</em>.</p><p>This panel places the same number of nodes at <strong>Chebyshev spacing</strong> (clustered near the ends) and shows how much the overshoot shrinks, without changing the interpolation method.</p>',
        if: () => typeof document !== 'undefined' && document.querySelector('[data-tour="chebyshev"]') !== null,
      },
      {
        target: '[data-tour="present-mode"]',
        title: 'Present mode (for lectures)',
        placement: 'bottom',
        body:
          '<p>Hides all reference prose and zooms the grid + formula panel. Ideal for a projector or lecture demo. Toggle again to bring back the notes.</p>',
      },
      {
        target: '[data-tour="reference-section"]',
        title: 'Keep going — it&apos;s real math for real audio',
        placement: 'top',
        body:
          '<p>Below the demo there are two reference sections:</p><p><strong>How each method works</strong> — mini-plots + formulas side by side. <strong>Applications &amp; Significance</strong> — why this isn&apos;t a classroom toy: sample-rate conversion, DAW automation, synth portamento, generative latent-space morphing, and future extensions.</p><p>The <span class="mono">?</span> button in the corner reopens this walkthrough at any time. Enjoy.</p>',
        if: () => typeof document !== 'undefined' && document.querySelector('[data-tour="reference-section"]') !== null,
      },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!hasSeenTour()) {
        const t = window.setTimeout(() => setTourActive(true), 350);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* noop */
    }
  }, []);

  const handleTourFinish = useCallback(() => {
    setTourActive(false);
    markTourSeen();
  }, []);

  const sorted = useMemo(
    () => [...points].sort((a, b) => a.t - b.t),
    [points]
  );

  const { curveTimes, curveFreqs, meta, rungeWarning } = useMemo(() => {
    if (sorted.length < 2) {
      return { curveTimes: [] as number[], curveFreqs: [] as number[], meta: {}, rungeWarning: false };
    }
    const tMin = sorted[0].t;
    const tMax = sorted[sorted.length - 1].t;
    const times = buildEvalGrid(tMin, tMax, 400);
    const { yEval, meta } = interpolate(method, sorted, times);
    let rungeWarning = false;
    if (method === 'lagrange') {
      rungeWarning = detectRungeOvershoot(toInterpPoints(sorted), yEval).overshoots;
    }
    return { curveTimes: times, curveFreqs: yEval, meta: meta ?? {}, rungeWarning };
  }, [sorted, method]);

  const compareSegments = useMemo(() => {
    if (sorted.length < 2) return [];
    const tMin = sorted[0].t;
    const tMax = sorted[sorted.length - 1].t;
    const times = buildEvalGrid(tMin, tMax, 400);
    const methods: { id: InterpolationMethod; label: string }[] = [
      { id: 'linear', label: 'Linear' },
      { id: 'cubic-spline', label: 'Cubic spline' },
      { id: 'lagrange', label: 'Lagrange' },
    ];
    return methods.map((m) => ({
      label: m.label,
      times,
      freqs: interpolate(m.id, sorted, times).yEval,
    }));
  }, [sorted]);

  const handlePlayGlide = useCallback(async () => {
    if (playing) {
      stopAll();
      setPlaying(false);
      setCompareLabel(null);
      return;
    }
    setPlaying(true);
    await playGlide({
      times: curveTimes,
      freqs: curveFreqs,
      onEnd: () => setPlaying(false),
    });
  }, [playing, curveTimes, curveFreqs]);

  const handlePlayStaccato = useCallback(async () => {
    stopAll();
    setCompareLabel(null);
    setPlaying(true);
    await playStaccato(sorted, 1, () => setPlaying(false));
  }, [sorted]);

  const handleStop = useCallback(() => {
    stopAll();
    setPlaying(false);
    setCompareLabel(null);
  }, []);

  const handleCompare = useCallback(async () => {
    stopAll();
    setPlaying(true);
    await playCompare(
      compareSegments,
      0.5,
      setCompareLabel,
      () => setPlaying(false)
    );
  }, [compareSegments]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName)) return;
      e.preventDefault();
      if (view === 'interactive' && sorted.length >= 2 && curveTimes.length > 1) {
        handlePlayGlide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePlayGlide, sorted.length, curveTimes.length, view]);

  const loadPreset = useCallback((id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (p) setPoints(p.points);
  }, []);

  const restartTour = () => {
    try {
      resetTourSeen();
    } catch {
      /* noop */
    }
    setTourActive(true);
  };

  return (
    <>
      <div className="toolbar-row" data-tour="toolbar">
        <div className="view-tabs" data-tour="view-tabs">
          <button
            type="button"
            className={`view-tab ${view === 'interactive' ? 'active' : ''}`}
            onClick={() => setView('interactive')}
          >
            Interactive demo
          </button>
          <button
            type="button"
            className={`view-tab ${view === 'error' ? 'active' : ''}`}
            onClick={() => setView('error')}
          >
            Error analysis
          </button>
        </div>
        <div data-tour="present-mode">
          <PresentModeToggle active={presentMode} onToggle={() => setPresentMode((p) => !p)} />
        </div>
      </div>

      {view === 'error' ? (
        <ErrorAnalysisPanel />
      ) : (
        <section className="demo-section">
          <div className="presets-row" data-tour="presets">
            <span className="presets-label">Presets</span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="preset-btn"
                onClick={() => loadPreset(p.id)}
                title={p.description}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="demo-layout">
            <div className="demo-main">
              <div className="method-tabs" data-tour="method-tabs">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`method-tab ${method === m.id ? 'active' : ''}`}
                    onClick={() => setMethod(m.id)}
                  >
                    {m.shortLabel}
                  </button>
                ))}
              </div>

              <div data-tour="pitch-grid">
                <PitchGrid
                  points={points}
                  onChange={setPoints}
                  curveTimes={curveTimes}
                  curveFreqs={curveFreqs}
                  minPointsForCurve={2}
                  method={method}
                  large={presentMode}
                />
              </div>

              <div data-tour="transport">
                <TransportControls
                  points={sorted}
                  curveTimes={curveTimes}
                  curveFreqs={curveFreqs}
                  playing={playing}
                  compareLabel={compareLabel}
                  compareSegments={compareSegments}
                  onPlayGlide={handlePlayGlide}
                  onPlayStaccato={handlePlayStaccato}
                  onStop={handleStop}
                  onCompare={handleCompare}
                />
              </div>

              <div data-tour="chebyshev">
                <ChebyshevComparison points={sorted} />
              </div>
            </div>

            <div data-tour="formula-panel">
              <MathPanel method={method} points={sorted} meta={meta} rungeWarning={rungeWarning} />
            </div>
          </div>
        </section>
      )}

      <div data-tour="reference-section">
          {!presentMode && <ReferenceSection />}
      </div>

      {!presentMode && (
        <button
          type="button"
          className="help-btn"
          onClick={restartTour}
          aria-label="Start interactive guide"
          title="Show guide"
        >
          ?
        </button>
      )}

      <OnboardingTour
        steps={tourSteps}
        active={tourActive}
        onFinish={handleTourFinish}
      />
    </>
  );
}
