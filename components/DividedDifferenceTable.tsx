'use client';

import { useState } from 'react';
import type { DividedDifferenceResult } from '@/lib/interpolation';

interface DividedDifferenceTableProps {
  divided: DividedDifferenceResult;
}

/** Column header labels for divided-difference table */
function colLabel(j: number): string {
  if (j === 0) return 'f[x]';
  if (j === 1) return 'f[x,x]';
  return `f[${'x,'.repeat(j + 1).slice(0, -1)}]`;
}

export default function DividedDifferenceTable({ divided }: DividedDifferenceTableProps) {
  const { ddTable, x } = divided;
  const n = ddTable.length;
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);

  const isParent = (r: number, c: number, hr: number, hc: number): boolean => {
    if (hr === r && hc === c) return false;
    if (hc === 0) return false;
    // cell (r,c) built from (r,c-1) and (r+1,c-1)
    if (hr === r && hc === c - 1) return true;
    if (hr === r + 1 && hc === c - 1) return true;
    return false;
  };

  const isDiagonal = (r: number, c: number) => r === 0 && c < n;

  return (
    <div className="dd-table-wrap">
      <p className="formula-label">Divided-difference table</p>
      <div className="dd-table-scroll">
        <table className="dd-table">
          <thead>
            <tr>
              <th>t</th>
              {Array.from({ length: n }, (_, j) => (
                <th key={j}>{colLabel(j)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ddTable.map((row, i) => (
              <tr key={i}>
                <td className="dd-x-col">{x[i].toFixed(3)}</td>
                {row.map((cell, j) => {
                  if (cell === null) return <td key={j} className="dd-empty" />;
                  const highlighted =
                    hover && (hover.row === i && hover.col === j);
                  const parent =
                    hover && isParent(hover.row, hover.col, i, j);
                  const diagonal = isDiagonal(i, j);
                  return (
                    <td
                      key={j}
                      className={[
                        'dd-cell',
                        diagonal ? 'dd-diagonal' : '',
                        highlighted ? 'dd-hover' : '',
                        parent ? 'dd-parent' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onMouseEnter={() => setHover({ row: i, col: j })}
                      onMouseLeave={() => setHover(null)}
                    >
                      {cell.toFixed(4)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dd-hint">
        Highlighted diagonal entries are the Newton polynomial coefficients. Hover a cell to see its
        two parent differences.
      </p>
    </div>
  );
}
