# Interpolation in Music — Project Overview

> Give this document to an AI (e.g. Claude) to build a presentation.
> It covers: motivation, problems solved, mathematics, audio engineering, tech stack, and design decisions.

---

## 1. What Is This Project?

**Interpolation in Music** is an interactive web application that makes numerical interpolation methods *visible and audible* at the same time. The core idea is simple:

- You place control points on a pitch-time grid (like musical notes on a staff)
- A mathematical interpolation curve is drawn through those points
- The curve is then **played as actual music** — you hear the interpolation as a melody or glide

This bridges a gap that every numerical methods student faces: interpolation is usually taught as a graph on paper with abstract numbers. This project makes you **hear** what cubic spline sounds like versus Lagrange, or why Runge's phenomenon is a real problem and not just a textbook curiosity.

---

## 2. Why I Built This

**The core motivation:** Interpolation is one of the most fundamental concepts in numerical mathematics, but it is almost always taught in a completely abstract way — you see a polynomial curve, some error numbers, maybe an oscillating graph showing Runge's phenomenon. It is very hard to build intuition for *why* one method is better than another just from looking at graphs.

Music gave me the perfect domain to make this concrete:
- **Pitch is frequency**, and humans perceive pitch on a **logarithmic scale** — exactly like MIDI numbers
- A musical glide (portamento/vibrato) is literally a continuous frequency function over time — the exact thing interpolation computes
- Different interpolation methods produce curves with very different "smoothness" properties, and those properties are **directly audible** as smoother or harsher-sounding transitions

So instead of asking "which interpolation method has a lower L-infinity error on this test function?", I can ask "which method makes a melody sound more natural?" — and immediately hear the answer.

---

## 3. What Problems I Solved

### Problem 1: Runge's Phenomenon is Hard to Explain
**Problem:** Lagrange interpolation with many points "oscillates wildly" between data points — the famous Runge's phenomenon. Students see the graph but don't feel why it matters.

**Solution:** In this app, if you place several points and switch to Lagrange interpolation, you *hear* the melody pitch shooting up and down to extreme values between the notes you placed. The oscillations are audible as unintended high/low pitch swings. This makes the problem viscerally real.

### Problem 2: Cubic Spline vs Linear — "Why does smoothness matter?"
**Problem:** Linear interpolation is smooth enough to look at on a graph, but feels "robotic" in animation.

**Solution:** When you play your points with Linear interpolation, the glide sounds like a step-function — it moves straight then suddenly changes direction, which sounds mechanical and unnatural. With Cubic Spline, the glide curves smoothly, just like how a real musician would slide between notes. The difference is immediately obvious to any listener.

### Problem 3: Newton Forward Difference requires equal spacing
**Problem:** The Newton Forward Difference formula only works when your data points are evenly spaced in time. Students often forget this constraint.

**Solution:** The app automatically detects whether your control points are evenly spaced. If they are, Newton Forward/Backward Difference is enabled and shows you the difference table. If not, it silently falls back to divided differences — and the UI explains why with a tooltip.

### Problem 4: Synthesized instruments sounded fake and robotic
**Problem:** The first version used pure oscillator synthesis (sine/sawtooth waves with ADSR envelopes). No matter how much the ADSR, formants, and harmonic partials were tuned, all instruments sounded like variations of the same synthetic tone. The glide interpolation sounded robotic because the pitch transitions between oscillator frequencies were too mechanical.

**Solution:** Switched to **WebAudioFont** — a library of real recorded FluidR3_GM soundfont samples. Each instrument is loaded from actual MIDI soundfont recordings:
- Piano: `0000_FluidR3_GM_sf2_file`
- Guitar: `0250_LK_AcousticSteel_SF2_file`
- Violin: `0400_FluidR3_GM_sf2_file`
- Saxophone: `0650_FluidR3_GM_sf2_file`
- Flute: `0730_FluidR3_GM_sf2_file`
- Clarinet: `0710_FluidR3_GM_sf2_file`
- Synth Brass: `0620_FluidR3_GM_sf2_file`

The glide uses WebAudioFont's `queueWaveTable` with a **slides array** — a sequence of pitch deltas scheduled over time — so the sample's playback rate is continuously pitch-shifted following the interpolation curve. This is how real VST samplers work: you pitch-shift a real recording rather than generating a fake wave.

### Problem 5: Ghost metronome-like clicking
**Problem:** The early oscillator engine had `hammerClick`, `releaseNoise`, and noise burst generators attached to each note voice. These created a regular clicking sound between notes, like a metronome was running in the background.

**Solution:** The noise burst generators were producing their attack transients at exactly the note onset time. With multiple rapid notes, the clicks appeared rhythmically. The fix was to remove the noise buses from the staccato note path and use only the sampled instrument (which has its own natural attack transient baked in from the recording).

### Problem 6: All instruments sounded identical after ADSR tuning
**Problem:** When sustain levels were reduced uniformly across all instruments (to reduce long ring), all instruments collapsed to the same short-attack/no-sustain character. Piano, violin, and flute all sounded like the same blip.

**Solution (fundamental fix):** Switched to the sample-based engine. The ADSR values on oscillators were trying to simulate instrument character that the oscillators fundamentally cannot produce. Real instrument identity comes from the unique harmonic evolution, attack transients, and formant resonances baked into actual recordings — not from ADSR curves.

---

## 4. The Mathematics Used

### 4.1 Pitch to Frequency Conversion

Music uses a **logarithmic pitch scale**. The MIDI standard defines:

```
f(midi) = 440 × 2^((midi - 69) / 12)
```

Where MIDI 69 = A4 = 440 Hz. This means each octave doubles the frequency.

**Why this matters for interpolation:** If you naively interpolate *frequencies in Hz*, equal pitch intervals don't feel equal — a glide from 220 Hz to 440 Hz (one octave) feels the same size as a glide from 440 Hz to 660 Hz (only a fifth), even though both are 220 Hz apart. The app interpolates in **MIDI space** (linear perceptual pitch) and then converts to Hz for audio playback, which makes glides sound perceptually even.

### 4.2 Linear Interpolation

The simplest method. Between two control points:

```
y(x) = y_i + ((y_{i+1} - y_i) / (x_{i+1} - x_i)) × (x - x_i)
```

- **Continuity:** C0 (values match at knots, but derivative jumps)
- **Sound:** Abrupt direction changes at each note — sounds mechanical
- **Use case:** Useful as a baseline to hear what non-smooth interpolation sounds like

### 4.3 Lagrange Interpolation

A single polynomial passing through all n+1 points:

```
L(x) = sum_i { y_i × prod_{j≠i} (x - x_j) / (x_i - x_j) }
```

- **Continuity:** Infinitely smooth within the polynomial, but **Runge's phenomenon** can cause violent oscillations between points with many/uneven data
- **Sound:** Can sound musical with few notes but produces extreme pitch excursions with many points (the Runge oscillations are audible as wild pitch swings)
- **Key insight:** The app makes Runge's phenomenon literally audible for the first time

### 4.4 Newton Divided Differences

Algebraically equivalent to Lagrange but uses a recursive divided-difference table:

```
f[x_i, x_{i+1}] = (f[x_{i+1}] - f[x_i]) / (x_{i+1} - x_i)
P(x) = f[x_0] + f[x_0,x_1](x-x_0) + f[x_0,x_1,x_2](x-x_0)(x-x_1) + ...
```

- **Advantage over Lagrange:** Incremental — adding a new point requires O(n) work, not rebuilding from scratch
- **Sound:** Same as Lagrange (same polynomial), but the divided-difference table is shown as an interactive visual in the Math Panel
- **Visual:** The app renders the full triangular divided-difference table so you can see exactly how the polynomial coefficients are computed

### 4.5 Newton Forward/Backward Difference

Special form for **equally spaced** data using forward (delta) or backward (nabla) difference operators:

```
p = (x - x_0) / h   [normalized position within interval]
P(x) = y_0 + p·Δy_0 + p(p-1)/2! · Δ²y_0 + ...
```

- **Requirement:** Points must be evenly spaced in time (step size h)
- **Advantage:** Computationally simpler for tabulated data; natural for data that comes at regular time intervals
- **App behavior:** Automatically enabled when you place your control points at equal time intervals; the difference table is shown in real time

### 4.6 Natural Cubic Spline

The star of the show. A piecewise cubic polynomial where each segment is:

```
S_i(x) = a_i + b_i(x-x_i) + c_i(x-x_i)^2 + d_i(x-x_i)^3
```

Subject to:
- Passes through all data points: S_i(x_i) = y_i
- Continuous first derivative at interior knots
- Continuous second derivative at interior knots
- Natural boundary conditions: second derivative = 0 at endpoints

The coefficients are found by solving a tridiagonal linear system.

- **Why it sounds best:** C2 continuity means the acceleration (second derivative) of pitch is continuous. To the ear, this sounds like a natural, smooth portamento — the same quality a skilled singer achieves when sliding between notes
- **Comparison:** Linear = C0 (jerky), Lagrange = smooth but overshoots, Cubic Spline = C2 and stays bounded

### 4.7 Chebyshev Node Distribution

The app includes a comparison showing that placing control points at **Chebyshev nodes** instead of equally spaced nodes significantly reduces Runge's oscillation in Lagrange interpolation.

Chebyshev nodes on [-1, 1]:
```
x_k = cos((2k+1)π / (2n+2)),  for k = 0, 1, ..., n
```

This is a key insight in numerical analysis: the choice of interpolation *nodes* matters as much as the choice of method.

### 4.8 Error Analysis

The Error Analysis panel shows how interpolation error scales with the number of nodes n:
- For Lagrange on smooth functions: error can grow exponentially with n (Runge's phenomenon)
- For cubic spline: error decreases monotonically as O(h^4) with h = node spacing
- The app plots error vs n curves for test functions: sin(x), Runge function 1/(1+25x^2), exponential, and polynomial

---

## 5. How the Audio Engine Works

### Two Playback Modes

**"Play Notes" (Staccato):** Plays the control points one at a time as individual notes, using the sampled instrument's natural ADSR. Each note is a separate `queueWaveTable` call with a short duration.

**"Play Glide" (Portamento):** Plays a single sustained note that continuously pitch-shifts following the interpolation curve, using WebAudioFont's `slides` parameter — an array of `{when, delta}` pairs where `delta` is the pitch change in MIDI semitones from the starting note.

### Why Real Samples Matter

A real violin recording contains:
- Natural bow attack transient (the bow hair catching the string)
- Spectral evolution over time (harmonics shift as bow pressure varies)
- Subtle inharmonicity (real strings are not perfectly harmonic)
- Room acoustics and body resonance

No amount of oscillator synthesis can replicate this. The sample engine uses the real recording and simply changes its playback rate to shift pitch — the same technique used in every professional DAW and sampler.

### Sample Loading

Instrument samples are loaded on-demand from `surikov.github.io/webaudiofontdata` — a public CDN of the FluidR3_GM soundfont in WebAudioFont format. The `WebAudioFontPlayer.js` library handles:
- Loading the .js soundfont file (which contains base64-encoded audio data)
- Decoding audio buffers
- Scheduling playback with the Web Audio API
- Applying real-time pitch shifting via playback rate ramps

---

## 6. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | React server components, good for math-heavy rendering |
| Language | TypeScript | Type safety for math data structures (ControlPoint, InterpolationMethod) |
| Styling | Vanilla CSS | Maximum control over the custom grid layout |
| Math rendering | KaTeX | LaTeX formula rendering in the Math Panel |
| Audio playback | Web Audio API + WebAudioFont | Real instrument samples with precise scheduling |
| Soundfont | FluidR3_GM via webaudiofontdata CDN | Industry-standard General MIDI soundfont, 128 instruments |
| Fonts | Source Serif 4 + JetBrains Mono | Serif for readability, mono for formula/number display |

---

## 7. Key Features

1. **Interactive pitch grid** — drag control points to place notes; the interpolation curve updates in real time
2. **5 interpolation methods** — Linear, Lagrange, Newton Divided Difference, Newton Forward/Backward, Natural Cubic Spline
3. **Live Math Panel** — shows the formula, polynomial coefficients, and divided-difference or difference tables updating as you move points
4. **7 instrument timbres** — Piano, Guitar, Violin, Saxophone, Flute, Clarinet, Synth Brass (all real soundfont samples)
5. **Dual playback mode** — "Notes" (staccato) and "Glide" (portamento), so you can hear both discrete and continuous interpretation
6. **Error Analysis view** — plots interpolation error vs n for real mathematical test functions, with overlay of true vs interpolated curves
7. **Runge phenomenon detection** — automatic warning when Lagrange/Newton overshoot the pitch range significantly
8. **Chebyshev comparison** — side-by-side visual showing equal spacing vs Chebyshev nodes for Lagrange
9. **WAV export** — export the interpolated melody as a WAV audio file

---

## 8. Architecture Summary

```
app/
  layout.tsx           Root layout, fonts, header
  page.tsx             Renders DemoApp

components/
  DemoApp.tsx          Main state (points, method, instrument, playing)
  PitchGrid.tsx        SVG interactive canvas for placing/dragging notes
  MathPanel.tsx        Live formula + coefficient display (KaTeX)
  TransportControls.tsx  Play/stop buttons, instrument selector, WAV export
  ErrorAnalysisPanel.tsx Error-vs-n curves for test functions
  ChebyshevComparison.tsx  Equal vs Chebyshev node visual
  ReferenceSection.tsx   Textbook-style explanations of each method
  OnboardingTour.tsx   First-visit guided walkthrough

lib/
  interpolation.ts     All 5 interpolation algorithm implementations
  pitch.ts             MIDI to Hz conversion, note names, grid constants
  formulas.ts          Method metadata, LaTeX formula strings, explanation text
  sampler.ts           WebAudioFont sampler engine (real instrument samples)
  audio.ts             Oscillator synth engine (kept as educational reference)
  errorAnalysis.ts     Error measurement vs ground truth for test functions
  presets.ts           Preset control-point configurations (scale, melody, etc.)

public/
  WebAudioFontPlayer.js  Local copy of the WebAudioFont player runtime
```

---

## 9. Key Design Decisions

### Why MIDI numbers instead of Hz for interpolation?
Human pitch perception is logarithmic (octave = 2x frequency). Interpolating in Hz creates uneven-feeling glides. Interpolating in MIDI (linear semitones) creates perceptually even glides — matching how musicians actually think about pitch distance.

### Why cubic spline sounds most "musical"?
A skilled musician (or a professional glide effect) produces pitch transitions with continuous acceleration — the second derivative of pitch is smooth. Cubic spline is the lowest-degree polynomial family that guarantees C2 continuity, which is why it matches natural musical expression.

### Why WebAudioFont instead of Tone.js or other libraries?
- Tone.js abstracts away Web Audio API details and has a large bundle; direct control over scheduling was needed
- WebAudioFont is extremely lightweight and provides direct access to FluidR3_GM samples, which are the standard used in professional MIDI production
- The slides mechanism in WebAudioFont maps perfectly to the output of the interpolation engine: a time series of pitch values

### Why keep the oscillator engine (audio.ts)?
It serves as an educational reference and a working example of how additive synthesis and ADSR work — topics that are themselves mathematical (Fourier series, exponential decay envelopes). It also works offline without a CDN connection.

---

## 10. Summary — What This Project Demonstrates

1. **Numerical methods are not abstract** — they have real, perceivable consequences when applied to sound
2. **Cubic spline is optimal for smooth curves** — both mathematically (C2 continuity) and perceptually (natural-sounding glides)
3. **Runge's phenomenon is real and consequential** — high-degree polynomial interpolation goes wrong in audible ways
4. **The choice of spacing matters** — Chebyshev nodes reduce Runge overshoot; equal spacing enables forward differences
5. **Logarithmic pitch perception is why MIDI exists** — it linearizes the perceptual frequency scale
6. **Real samples beat synthesis** — instrument identity comes from recorded acoustic properties, not ADSR curves
