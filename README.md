# Interpolation in Music

A browser-based numerical methods demo for Kathmandu University. Place musical notes on a pitch–time grid, choose an interpolation method, and see (and hear) how it fills the space between the notes.

## Methods implemented

- **Linear** — piecewise connect-the-dots
- **Lagrange** — single polynomial (Runge warning when overshooting)
- **Newton divided difference** — general uneven spacing
- **Newton forward / backward** — auto-applies when points are equally spaced in time
- **Natural cubic spline** — C² smooth tridiagonal solve

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

## Deploy on Vercel

No environment variables or backend required — everything runs client-side.

1. Push this repository to GitHub (`ghanshyamghimiregg/Interpolation-in-music`).
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. Click **Add New Project** → import the repository.
4. Leave all defaults (Framework Preset: **Next.js**, Root Directory: `.`, Build Command: `next build`, Output: automatic).
5. Click **Deploy**.

The app will be live at a `*.vercel.app` URL. Subsequent pushes to the default branch redeploy automatically.

## Project structure

| Path | Purpose |
|------|---------|
| `app/` | Next.js 14 App Router pages and layout |
| `components/` | Canvas grid, math panel (KaTeX), audio transport |
| `lib/interpolation.ts` | Pure interpolation functions (ported from prior MeloMath JS) |
| `melomath/` | Earlier React/Vite + Python prototype (kept for reference) |
| `AUDIT.md` | Notes on what was reused vs. replaced |

## Credits

Ghanshyam Ghimire · BTech AI, 4th Semester · Kathmandu University  
Course project for Sandesh Thakuri
