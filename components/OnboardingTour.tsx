'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'bottom-right' | 'top-right';

export interface TourStep {
  target: string;
  title: string;
  body: string;
  placement?: Placement;
  if?: () => boolean;
}

export const TOUR_STORAGE_KEY = 'melo-interp:tour-seen';
export const TOUR_VERSION = 1;

const PLACEMENT_GAP = 14;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTargetRect(selector: string): Rect | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function computeTooltip(
  target: Rect | null,
  placement: Placement,
  tooltipW: number,
  tooltipH: number,
  viewport: { w: number; h: number }
) {
  if (!target) {
    return {
      tTop: Math.round(viewport.h / 2 - tooltipH / 2),
      tLeft: Math.round(viewport.w / 2 - tooltipW / 2),
      arrowTop: 0,
      arrowLeft: 0,
      arrowDir: 'none' as Placement | 'none',
    };
  }
  const { top, left, width, height } = target;
  let tTop = 0;
  let tLeft = 0;
  let arrowDir: Placement | 'none' = placement;
  switch (placement) {
    case 'top':
      tTop = top - tooltipH - PLACEMENT_GAP;
      tLeft = left + width / 2 - tooltipW / 2;
      break;
    case 'bottom':
      tTop = top + height + PLACEMENT_GAP;
      tLeft = left + width / 2 - tooltipW / 2;
      break;
    case 'left':
      tTop = top + height / 2 - tooltipH / 2;
      tLeft = left - tooltipW - PLACEMENT_GAP;
      break;
    case 'right':
      tTop = top + height / 2 - tooltipH / 2;
      tLeft = left + width + PLACEMENT_GAP;
      break;
    case 'bottom-right':
      tTop = top + height + PLACEMENT_GAP;
      tLeft = left + width - Math.min(tooltipW, width);
      break;
    case 'top-right':
      tTop = top - tooltipH - PLACEMENT_GAP;
      tLeft = left + width - Math.min(tooltipW, width);
      break;
  }
  const pad = 12;
  if (tLeft < pad) tLeft = pad;
  if (tLeft + tooltipW > viewport.w - pad) tLeft = viewport.w - pad - tooltipW;
  if (tTop < pad) {
    tTop = top + height + PLACEMENT_GAP;
    arrowDir = 'top';
  }
  if (tTop + tooltipH > viewport.h - pad) {
    tTop = top - tooltipH - PLACEMENT_GAP;
    arrowDir = 'bottom';
  }
  let arrowTop = 0;
  let arrowLeft = 0;
  if (arrowDir === 'top' || arrowDir === 'bottom') {
    const targetCx = left + width / 2;
    arrowLeft = Math.max(18, Math.min(tooltipW - 18, targetCx - tLeft));
  } else if (arrowDir === 'left' || arrowDir === 'right') {
    const targetCy = top + height / 2;
    arrowTop = Math.max(18, Math.min(tooltipH - 18, targetCy - tTop));
  }
  return { tTop, tLeft, arrowTop, arrowLeft, arrowDir };
}

export function hasSeenTour(): boolean {
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.v === TOUR_VERSION && parsed?.seen === true;
  } catch {
    return false;
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify({ v: TOUR_VERSION, seen: true }));
  } catch {
    /* noop */
  }
}

export function resetTourSeen() {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

interface OnboardingTourProps {
  steps: TourStep[];
  active: boolean;
  onFinish: () => void;
  onStepChange?: (index: number) => void;
}

export default function OnboardingTour({ steps, active, onFinish, onStepChange }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<Rect | null>(null);
  const [tipPos, setTipPos] = useState<{
    tTop: number;
    tLeft: number;
    arrowTop: number;
    arrowLeft: number;
    arrowDir: Placement | 'none';
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const visibleSteps = useMemo(() => {
    return steps.filter((s) => (s.if ? s.if() : true));
  }, [steps]);

  const current = visibleSteps[stepIndex];

  const updatePositions = useCallback(() => {
    if (!current) return;
    const rect = current.target ? getTargetRect(current.target) : null;
    setHighlight(rect);
    const viewport = { w: window.innerWidth, h: window.innerHeight };
    const tip = tooltipRef.current;
    const tw = tip?.offsetWidth ?? 340;
    const th = tip?.offsetHeight ?? 180;
    const placement: Placement = current.placement ?? 'bottom';
    const pos = computeTooltip(rect, placement, tw, th, viewport);
    setTipPos(pos);
  }, [current]);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      updatePositions();
      rafRef.current = window.setTimeout(tick, 120) as unknown as number;
    };
    tick();
    const onResize = () => updatePositions();
    const onScroll = () => updatePositions();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [active, stepIndex, visibleSteps.length, updatePositions]);

  useEffect(() => {
    if (!active) return;
    if (!current) return;
    const el = current.target ? document.querySelector<HTMLElement>(current.target) : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [stepIndex, active, current]);

  useEffect(() => {
    onStepChange?.(stepIndex);
  }, [stepIndex, onStepChange]);

  const handleNext = () => {
    if (stepIndex >= visibleSteps.length - 1) {
      onFinish();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const handleSkip = () => {
    onFinish();
  };

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      setHighlight(null);
      setTipPos(null);
      return;
    }
    if (stepIndex >= visibleSteps.length) {
      setStepIndex(0);
    }
  }, [active, visibleSteps.length, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onFinish();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handleBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onFinish, stepIndex, visibleSteps.length]);

  if (!active || !current) return null;

  const isLast = stepIndex === visibleSteps.length - 1;
  const isFirst = stepIndex === 0;
  const progress = ((stepIndex + 1) / visibleSteps.length) * 100;

  return (
    <div className="tour-overlay" aria-modal="true" role="dialog" aria-label="Interactive tour">
      {highlight && (
        <div
          className="tour-highlight"
          style={{
            top: `${highlight.top - 4}px`,
            left: `${highlight.left - 4}px`,
            width: `${highlight.width + 8}px`,
            height: `${highlight.height + 8}px`,
          }}
        />
      )}
      <div
        ref={tooltipRef}
        className="tour-tooltip"
        style={
          tipPos
            ? {
                top: `${tipPos.tTop}px`,
                left: `${tipPos.tLeft}px`,
              }
            : undefined
        }
      >
        {tipPos && tipPos.arrowDir !== 'none' && (
          <div
            className={`tour-arrow tour-arrow-${tipPos.arrowDir}`}
            style={
              tipPos.arrowDir === 'top' || tipPos.arrowDir === 'bottom'
                ? { left: `${tipPos.arrowLeft}px` }
                : { top: `${tipPos.arrowTop}px` }
            }
          />
        )}
        <div className="tour-head">
          <div className="tour-badge">
            <span className="tour-badge-step">{stepIndex + 1}</span>
            <span className="tour-badge-sep">/</span>
            <span>{visibleSteps.length}</span>
            <span className="tour-badge-label">getting started</span>
          </div>
          <button
            type="button"
            className="tour-close"
            aria-label="Close tour"
            onClick={handleSkip}
          >
            ×
          </button>
        </div>
        <div className="tour-progress">
          <div className="tour-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <h3 className="tour-title">{current.title}</h3>
        <div className="tour-body">{current.body}</div>
        <div className="tour-foot">
          <button
            type="button"
            className="tour-btn tour-btn-ghost"
            onClick={handleSkip}
          >
            Skip tour
          </button>
          <div className="tour-nav">
            <button
              type="button"
              className="tour-btn tour-btn-ghost"
              onClick={handleBack}
              disabled={isFirst}
            >
              Back
            </button>
            <button
              type="button"
              className="tour-btn tour-btn-primary"
              onClick={handleNext}
              autoFocus
            >
              {isLast ? 'Done' : 'Next →'}
            </button>
          </div>
        </div>
        <div className="tour-hints">
          <span>← Back</span>
          <span>Next → / Enter</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
