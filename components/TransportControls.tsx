'use client';

import { playGlide, playStaccato, stopAll, exportWav } from '@/lib/audio';
import type { ControlPoint } from '@/lib/interpolation';

interface TransportControlsProps {
  points: ControlPoint[];
  curveTimes: number[];
  curveFreqs: number[];
  playing: boolean;
  onPlayGlide: () => void;
  onPlayStaccato: () => void;
  onStop: () => void;
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <path d="M3 1.5v11l9-5.5L3 1.5z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="8" height="8" />
    </svg>
  );
}

export default function TransportControls({
  points,
  curveTimes,
  curveFreqs,
  playing,
  onPlayGlide,
  onPlayStaccato,
  onStop,
}: TransportControlsProps) {
  const canPlay = points.length >= 2 && curveTimes.length > 1;

  const handleExport = () => {
    const blob = exportWav(curveTimes, curveFreqs);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interpolation-glide.wav';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="transport">
      <button
        type="button"
        className="transport-btn primary"
        disabled={!canPlay}
        onClick={playing ? onStop : onPlayGlide}
        title="Space"
      >
        {playing ? <StopIcon /> : <PlayIcon />}
        {playing ? 'Stop glide' : 'Play glide'}
      </button>
      <button type="button" className="transport-btn" disabled={points.length < 1} onClick={onPlayStaccato}>
        <PlayIcon />
        Notes only
      </button>
      <button type="button" className="transport-btn" disabled={!canPlay} onClick={handleExport}>
        Export .wav
      </button>
    </div>
  );
}

export { playGlide, playStaccato, stopAll };
