'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PitchGrid from './PitchGrid';
import MathPanel from './MathPanel';
import TransportControls, { playGlide, playStaccato, stopAll } from './TransportControls';
import ReferenceSection from './ReferenceSection';
import { PRESETS } from '@/lib/presets';
import { METHODS } from '@/lib/formulas';
import {
  buildEvalGrid,
  detectRungeOvershoot,
  interpolate,
  toInterpPoints,
  type ControlPoint,
  type InterpolationMethod,
} from '@/lib/interpolation';

export default function DemoApp() {
  const [points, setPoints] = useState<ControlPoint[]>(PRESETS[0].points);
  const [method, setMethod] = useState<InterpolationMethod>('cubic-spline');
  const [playing, setPlaying] = useState(false);

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

  const handlePlayGlide = useCallback(async () => {
    if (playing) {
      stopAll();
      setPlaying(false);
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
    setPlaying(true);
    await playStaccato(sorted, 1, () => setPlaying(false));
  }, [sorted]);

  const handleStop = useCallback(() => {
    stopAll();
    setPlaying(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
      e.preventDefault();
      if (sorted.length >= 2 && curveTimes.length > 1) {
        handlePlayGlide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePlayGlide, sorted.length, curveTimes.length]);

  const loadPreset = useCallback((id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (p) setPoints(p.points);
  }, []);

  return (
    <>
      <section className="demo-section">
        <div className="presets-row">
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
            <div className="method-tabs">
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

            <PitchGrid
              points={points}
              onChange={setPoints}
              curveTimes={curveTimes}
              curveFreqs={curveFreqs}
              minPointsForCurve={2}
            />

            <TransportControls
              points={sorted}
              curveTimes={curveTimes}
              curveFreqs={curveFreqs}
              playing={playing}
              onPlayGlide={handlePlayGlide}
              onPlayStaccato={handlePlayStaccato}
              onStop={handleStop}
            />
          </div>

          <MathPanel method={method} points={sorted} meta={meta} rungeWarning={rungeWarning} />
        </div>
      </section>

      <ReferenceSection />
    </>
  );
}
