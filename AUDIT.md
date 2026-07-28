# Repository Audit — Interpolation in Music

**Date:** July 2026 · **Auditor:** rebuild agent

## What exists

The repo contains a prior iteration called **MeloMath** under `melomath/`, split into a Python FastAPI backend and a React/Vite frontend. The backend (`melomath/backend/interpolation/`) implements **Lagrange**, **Newton's divided differences**, and **cubic spline** (via SciPy's `CubicSpline`) in NumPy, with a FastAPI server exposing `/api/interpolate`, `/api/presets`, and `/api/upload-midi` (Music21). A small test script (`test_interpolation.py`) smoke-tests all three methods on three musical frequency points.

The frontend (`melomath/frontend/`) duplicates the same three methods in pure JavaScript (`src/utils/interpolation.js`), including a **hand-rolled natural cubic spline** (tridiagonal solve for second derivatives — not SciPy). It also has `computeMetrics` (RMSE vs. linear reference, max deviation, smoothness). UI components use **Recharts** for scatter/line charts, **Tone.js** for audio playback, **Tailwind CSS** with a dark purple dashboard aesthetic, and **react-toastify** / **react-dropzone** for notifications and MIDI upload. Four presets are built in (C major scale, Twinkle Twinkle, sparse random, Runge's phenomenon). Points are added by clicking a Recharts scatter plot but are **not draggable**; deletion is via a list UI, not on-canvas.

## Gaps vs. assignment requirements

| Requirement | Status in existing code |
|---|---|
| Linear interpolation | **Missing** |
| Newton forward/backward (equal spacing) | **Missing** |
| Lagrange + Runge warning | Lagrange yes; no overshoot detection |
| Natural cubic spline | Yes (JS hand-rolled; Python uses SciPy) |
| Canvas/SVG click-and-drag grid | No — Recharts only |
| KaTeX live substituted formulas | No |
| Web Audio API (no Tone.js) | No — uses Tone.js |
| Next.js 14 / Vercel zero-config | No — Vite + optional Python backend |
| Academic / lab-notebook design | No — generic dark SaaS template |

## Keep vs. discard

**Keep (port to TypeScript, do not rewrite from scratch):** The algorithms in `melomath/frontend/src/utils/interpolation.js` — Lagrange, Newton divided difference (including the DD table layout), natural cubic spline tridiagonal solver, and `computeMetrics`. Preset point data from `App.jsx` / `main.py` (frequencies and timings) will be adapted to MIDI-note storage. Python backend stays in the repo as reference material for the course but will not be deployed.

**Discard for the new app:** The MeloMath React/Vite UI shell (Recharts charts, Tone.js audio, Tailwind dashboard layout, toast notifications, API mode toggle, MIDI upload). These conflict with the assignment's stack and design constraints. The new app will be a **Next.js 14 App Router** project at the repo root, client-side only, with a hand-rolled canvas grid, native Web Audio API, KaTeX math panel, and an academic instrument-panel layout.
