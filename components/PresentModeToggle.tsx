'use client';

import { useEffect } from 'react';

interface PresentModeToggleProps {
  active: boolean;
  onToggle: () => void;
}

export default function PresentModeToggle({ active, onToggle }: PresentModeToggleProps) {
  useEffect(() => {
    document.documentElement.classList.toggle('present-mode', active);
    return () => document.documentElement.classList.remove('present-mode');
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && active) onToggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onToggle]);

  return (
    <button
      type="button"
      className={`present-btn ${active ? 'active' : ''}`}
      onClick={onToggle}
      title={active ? 'Exit present mode (Esc)' : 'Present mode — projector layout'}
    >
      {active ? 'Exit present' : 'Present mode'}
    </button>
  );
}
