'use client';

import KatexBlock from './KatexBlock';
import DividedDifferenceTable from './DividedDifferenceTable';
import {
  METHODS,
  buildSubstitutedFormula,
  pointSummary,
  isNewtonForwardAvailable,
} from '@/lib/formulas';
import type { ControlPoint, DividedDifferenceResult, InterpolationMethod } from '@/lib/interpolation';

interface MathPanelProps {
  method: InterpolationMethod;
  points: ControlPoint[];
  meta?: Record<string, unknown>;
  rungeWarning?: boolean;
}

export default function MathPanel({ method, points, meta, rungeWarning }: MathPanelProps) {
  const info = METHODS.find((m) => m.id === method)!;
  const substituted = buildSubstitutedFormula(method, points, meta);
  const forwardAvail = method === 'newton-forward' ? isNewtonForwardAvailable(points) : true;

  const divided =
    method === 'newton-divided'
      ? (meta?.divided as DividedDifferenceResult | undefined)
      : method === 'newton-forward' && meta?.divided
        ? (meta.divided as DividedDifferenceResult)
        : undefined;

  return (
    <aside className="math-panel">
      <h2 className="panel-title">Formula</h2>
      <p className="method-name">{info.label}</p>

      <div className="formula-block">
        <p className="formula-label">General form</p>
        <KatexBlock tex={info.generalFormula} />
      </div>

      <div className="formula-block substituted">
        <p className="formula-label">Your points</p>
        {points.length >= 2 ? (
          <>
            <KatexBlock tex={String.raw`(${pointSummary(points)})`} block={false} />
            <KatexBlock tex={substituted} />
          </>
        ) : (
          <p className="placeholder">Add at least 2 control points.</p>
        )}
      </div>

      {(method === 'newton-divided' || (method === 'newton-forward' && divided)) && divided && (
        <DividedDifferenceTable divided={divided} />
      )}

      {method === 'newton-forward' && points.length >= 2 && (
        <p className={`spacing-note ${forwardAvail ? 'ok' : 'warn'}`}>
          {forwardAvail
            ? 'Points are equally spaced — forward difference applies.'
            : 'Uneven spacing — divided-difference equivalent is shown.'}
        </p>
      )}

      {rungeWarning && method === 'lagrange' && (
        <p className="runge-warning">
          Oscillation exceeds the note range — classic Runge&apos;s phenomenon.
        </p>
      )}

      <div className="method-notes">
        <p>{info.explanation}</p>
        <p className="weakness">
          <strong>Limitation:</strong> {info.weakness}
        </p>
      </div>
    </aside>
  );
}
