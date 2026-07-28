'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TIME_MIN,
  TIME_MAX,
  MIDI_MIN,
  MIDI_MAX,
  clampTime,
  clampMidi,
  midiToNoteName,
} from '@/lib/pitch';
import type { ControlPoint } from '@/lib/interpolation';

const PAD = { left: 52, right: 16, top: 16, bottom: 36 };

interface PitchGridProps {
  points: ControlPoint[];
  onChange: (points: ControlPoint[]) => void;
  curveTimes: number[];
  curveFreqs: number[];
  minPointsForCurve: number;
}

export default function PitchGrid({
  points,
  onChange,
  curveTimes,
  curveFreqs,
  minPointsForCurve,
}: PitchGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: Math.floor(cr.width), h: Math.floor(cr.width * 0.56) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dataToCanvas = useCallback(
    (t: number, midi: number) => {
      const plotW = size.w - PAD.left - PAD.right;
      const plotH = size.h - PAD.top - PAD.bottom;
      const cx = PAD.left + ((t - TIME_MIN) / (TIME_MAX - TIME_MIN)) * plotW;
      const cy = PAD.top + ((MIDI_MAX - midi) / (MIDI_MAX - MIDI_MIN)) * plotH;
      return { cx, cy };
    },
    [size]
  );

  const canvasToData = useCallback(
    (cx: number, cy: number) => {
      const plotW = size.w - PAD.left - PAD.right;
      const plotH = size.h - PAD.top - PAD.bottom;
      const t = TIME_MIN + ((cx - PAD.left) / plotW) * (TIME_MAX - TIME_MIN);
      const midi = MIDI_MAX - ((cy - PAD.top) / plotH) * (MIDI_MAX - MIDI_MIN);
      return { t: clampTime(t), midi: clampMidi(midi) };
    },
    [size]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#faf8f4';
    ctx.fillRect(0, 0, size.w, size.h);

    const plotW = size.w - PAD.left - PAD.right;
    const plotH = size.h - PAD.top - PAD.bottom;

    ctx.strokeStyle = '#d4cfc4';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6b6560';
    ctx.font = '11px var(--font-mono)';

    for (let m = MIDI_MIN; m <= MIDI_MAX; m += 3) {
      const { cy } = dataToCanvas(TIME_MIN, m);
      ctx.beginPath();
      ctx.moveTo(PAD.left, cy);
      ctx.lineTo(PAD.left + plotW, cy);
      ctx.stroke();
      if (m % 12 === 0) {
        ctx.fillText(midiToNoteName(m), 4, cy + 4);
      }
    }

    for (let s = 0; s <= TIME_MAX; s++) {
      const { cx } = dataToCanvas(s, MIDI_MIN);
      ctx.beginPath();
      ctx.moveTo(cx, PAD.top);
      ctx.lineTo(cx, PAD.top + plotH);
      ctx.stroke();
      ctx.fillText(`${s}s`, cx - 8, size.h - 8);
    }

    ctx.strokeStyle = '#1a1814';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PAD.left, PAD.top, plotW, plotH);

    if (points.length >= minPointsForCurve && curveTimes.length > 1) {
      ctx.strokeStyle = '#b8432a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < curveTimes.length; i++) {
        const midi = 69 + 12 * Math.log2(curveFreqs[i] / 440);
        const { cx, cy } = dataToCanvas(curveTimes[i], midi);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    points.forEach((p, i) => {
      const { cx, cy } = dataToCanvas(p.t, p.midi);
      ctx.fillStyle = i === dragIndex ? '#b8432a' : '#1a1814';
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#faf8f4';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [size, points, curveTimes, curveFreqs, dragIndex, minPointsForCurve, dataToCanvas]);

  useEffect(() => {
    draw();
  }, [draw]);

  const hitTest = (cx: number, cy: number): number | null => {
    for (let i = points.length - 1; i >= 0; i--) {
      const { cx: px, cy: py } = dataToCanvas(points[i].t, points[i].midi);
      if ((cx - px) ** 2 + (cy - py) ** 2 < 144) return i;
    }
    return null;
  };

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const { cx, cy } = getPos(e);
    const idx = hitTest(cx, cy);
    if (idx !== null) {
      setDragIndex(idx);
      return;
    }
    if (points.length >= 12) return;
    const { t, midi } = canvasToData(cx, cy);
    onChange([...points, { t, midi }]);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragIndex === null) return;
    const { cx, cy } = getPos(e);
    const { t, midi } = canvasToData(cx, cy);
    const next = points.map((p, i) => (i === dragIndex ? { t, midi } : p));
    onChange(next);
  };

  const onMouseUp = () => setDragIndex(null);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const { cx, cy } = getPos(e);
    const idx = hitTest(cx, cy);
    if (idx !== null) onChange(points.filter((_, i) => i !== idx));
  };

  return (
    <div ref={containerRef} className="grid-wrap">
      <canvas
        ref={canvasRef}
        className="pitch-canvas"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onContextMenu={onContextMenu}
      />
      <p className="grid-hint">
        Click to add · drag to move · right-click to delete · {points.length} point
        {points.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
